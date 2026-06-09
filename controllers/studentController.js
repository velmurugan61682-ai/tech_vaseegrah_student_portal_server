const User = require('../models/User');
const Attendance = require('../models/Attendance');

// Helper to get local date in YYYY-MM-DD
const getLocalDateString = () => {
  const date = new Date();
  // Adjust timezone offset to get local YYYY-MM-DD
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

// @desc    Get All Students (with filters)
// @route   GET /api/students
// @access  Private/Admin
exports.getAllStudents = async (req, res) => {
  try {
    const { course, branch, batch, attendanceStatus } = req.query;

    // Build query object
    let query = { role: 'student' };

    if (course) query.course = course;
    if (branch) query.branch = branch;
    if (batch) query.batch = batch;

    // Filter by today's attendance status
    if (attendanceStatus) {
      const todayStr = getLocalDateString();
      
      // Get today's attendance entries
      const todayAttendance = await Attendance.find({ date: todayStr });
      const presentStudentIds = todayAttendance
        .filter(record => record.status === 'present')
        .map(record => record.studentId.toString());

      const absentStudentIds = todayAttendance
        .filter(record => record.status === 'absent')
        .map(record => record.studentId.toString());

      if (attendanceStatus === 'present') {
        query._id = { $in: presentStudentIds };
      } else if (attendanceStatus === 'absent') {
        // Students marked absent OR not marked at all
        const allStudents = await User.find({ role: 'student' }).select('_id');
        const allStudentIds = allStudents.map(student => student._id.toString());
        const markedPresentOrAbsent = [...presentStudentIds, ...absentStudentIds];
        const unmarkedIds = allStudentIds.filter(id => !markedPresentOrAbsent.includes(id));
        
        // Absent = explicitly marked absent + unmarked
        query._id = { $in: [...absentStudentIds, ...unmarkedIds] };
      }
    }

    const students = await User.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: students.length,
      students
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Single Student
// @route   GET /api/students/:id
// @access  Private (Admin or Owner Student)
exports.getStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check auth permission (admin or self)
    if (req.user.role !== 'admin' && req.user.id !== student.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this profile' });
    }

    res.status(200).json({
      success: true,
      student
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Student
// @route   PUT /api/students/:id
// @access  Private (Admin or Owner Student)
exports.updateStudent = async (req, res) => {
  try {
    let student = await User.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check auth permission (admin or self)
    if (req.user.role !== 'admin' && req.user.id !== student.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this profile' });
    }

    // Prepare fields to update
    const fieldsToUpdate = {};
    const allowedFields = ['name', 'phone', 'college', 'branch', 'course', 'batch', 'profilePhoto', 'isActive'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Only admin can change course/branch/batch/isActive, except student can update general if allowed
        // Let's allow self-update of name, phone, college, branch, batch, profilePhoto
        if (req.user.role !== 'admin' && ['course', 'isActive'].includes(field)) {
          return; // Skip if student is trying to change course or status
        }
        fieldsToUpdate[field] = req.body[field];
      }
    });

    student = await User.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      student
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Student
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Remove user
    await User.findByIdAndDelete(req.params.id);

    // Delete student attendance and submissions
    await Attendance.deleteMany({ studentId: req.params.id });
    // Note: We can import Submission model and clean that up as well if needed.
    // To prevent reference issues, we can delete them.

    res.status(200).json({
      success: true,
      message: 'Student record and associated records deleted'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
