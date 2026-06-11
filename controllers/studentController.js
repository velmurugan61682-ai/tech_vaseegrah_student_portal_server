const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');

// @desc    Get Student Dashboard Metrics
// @route   GET /api/student/dashboard
exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentCourse = req.user.course || '';

    // 1. Calculate Attendance Rate
    const records = await Attendance.find({ studentId });
    const totalLogged = records.length;
    const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const attendanceRate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 100;

    // 2. Fetch Tasks and Submissions count
    const allTasks = await Task.find();
    
    // Filter tasks assigned to this student
    const assignedTasks = allTasks.filter(t => {
      return (
        t.assignmentType === 'all' ||
        (t.assignmentType === 'course' && t.course === studentCourse) ||
        (t.assignmentType === 'student' && t.assignedTo.some(id => id.toString() === studentId.toString()))
      );
    });

    const approvedSubmissions = assignedTasks.filter(t => 
      t.submissions.some(sub => sub.studentId.toString() === studentId.toString() && sub.status === 'Approved')
    );

    const submittedSubmissions = assignedTasks.filter(t => 
      t.submissions.some(sub => sub.studentId.toString() === studentId.toString())
    );

    const pendingTasksCount = assignedTasks.length - submittedSubmissions.length;
    const taskCompletionRate = assignedTasks.length > 0 
      ? Math.round((approvedSubmissions.length / assignedTasks.length) * 100) 
      : 100;

    res.status(200).json({
      success: true,
      pendingTasks: pendingTasksCount,
      attendanceRate,
      taskCompletionRate,
      data: {
        pendingTasks: pendingTasksCount,
        attendanceRate,
        taskCompletionRate
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current student profile
// @route   GET /api/student/profile
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(200).json({ success: true, data: student, student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student profile (phone, college, branch)
// @route   PUT /api/student/profile
exports.updateStudentProfile = async (req, res) => {
  try {
    const { name, phone, college, department, branch, batch, profilePhoto } = req.body;
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (name !== undefined) student.name = name;
    if (phone !== undefined) student.phone = phone;
    if (college !== undefined) student.college = college;
    if (department !== undefined) student.department = department;
    if (branch !== undefined) student.branch = branch;
    if (batch !== undefined) student.batch = batch;
    if (profilePhoto !== undefined) student.profilePhoto = profilePhoto;

    if (req.file) {
      student.profilePhoto = req.file.path || '/uploads/' + req.file.filename;
    }

    await student.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully', 
      data: student,
      student 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Student Directory
// @route   GET /api/students
// @access  Private/Admin
exports.getStudentsDirectory = async (req, res) => {
  try {
    const { course, branch, batch, search } = req.query;
    let query = {};
    
    if (course) {
      query.$or = [{ internshipTrack: course }, { course: course }];
    }
    if (branch) {
      query.branch = { $regex: new RegExp(branch, 'i') };
    }
    if (batch) {
      query.batch = batch;
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { college: searchRegex }
      ];
    }

    const students = await Student.find(query).sort({ name: 1 });
    
    const mapped = students.map(s => {
      const obj = s.toObject();
      obj.profileImage = s.profileImage || s.profilePhoto || '';
      obj.profilePhoto = s.profilePhoto || s.profileImage || '';
      obj.internshipTrack = s.internshipTrack || s.course || '';
      obj.course = s.course || s.internshipTrack || '';
      obj.taskPercentage = s.taskPercentage !== undefined ? s.taskPercentage : s.taskCompletionPercentage || 0;
      obj.taskCompletionPercentage = s.taskCompletionPercentage !== undefined ? s.taskCompletionPercentage : s.taskPercentage || 0;
      return obj;
    });

    res.status(200).json({ success: true, count: mapped.length, students: mapped, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add New Student
// @route   POST /api/students
// @access  Private/Admin
exports.addStudent = async (req, res) => {
  try {
    const { name, email, password, phone, college, department, branch, internshipTrack, course, batch } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in required fields (Name, Email, Password)' });
    }

    const User = require('../models/User');
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address already registered' });
    }

    let profileImage = '';
    if (req.file) {
      profileImage = req.file.path || '/uploads/' + req.file.filename;
    }

    const track = internshipTrack || course || '';

    const student = new Student({
      name,
      email: email.toLowerCase(),
      password, // bcrypt will hash it
      phone: phone || '',
      college: college || '',
      department: department || '',
      branch: branch || '',
      internshipTrack: track,
      course: track,
      batch: batch || '',
      profileImage,
      profilePhoto: profileImage,
      status: 'Active',
      attendancePercentage: 100,
      taskPercentage: 0
    });

    await student.save();

    // Sync to User collection
    const userCred = new User({
      _id: student._id,
      name,
      email: email.toLowerCase(),
      password,
      role: 'student'
    });
    await userCred.save();

    res.status(201).json({ success: true, message: 'Student registered successfully', student, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Student Details
// @route   PUT /api/students/:id
// @access  Private/Admin
exports.updateStudent = async (req, res) => {
  try {
    const { name, email, phone, college, department, branch, internshipTrack, course, batch, status, attendancePercentage, taskPercentage, taskCompletionPercentage } = req.body;
    
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (name !== undefined) student.name = name;
    if (email !== undefined) student.email = email.toLowerCase();
    if (phone !== undefined) student.phone = phone;
    if (college !== undefined) student.college = college;
    if (department !== undefined) student.department = department;
    if (branch !== undefined) student.branch = branch;
    
    const track = internshipTrack || course;
    if (track !== undefined) {
      student.internshipTrack = track;
      student.course = track;
    }
    
    if (batch !== undefined) student.batch = batch;
    if (status !== undefined) student.status = status;
    if (attendancePercentage !== undefined) student.attendancePercentage = attendancePercentage;
    
    const taskPct = taskPercentage !== undefined ? taskPercentage : taskCompletionPercentage;
    if (taskPct !== undefined) {
      student.taskPercentage = taskPct;
      student.taskCompletionPercentage = taskPct;
    }

    if (req.file) {
      const imgPath = req.file.path || '/uploads/' + req.file.filename;
      student.profileImage = imgPath;
      student.profilePhoto = imgPath;
    }

    await student.save();

    // Sync details in User collection
    const User = require('../models/User');
    const uCred = await User.findById(student._id);
    if (uCred) {
      if (name !== undefined) uCred.name = name;
      if (email !== undefined) uCred.email = email.toLowerCase();
      if (req.file) {
        uCred.profilePhoto = student.profilePhoto;
      }
      await uCred.save();
    }

    res.status(200).json({ success: true, message: 'Student record updated successfully', student, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Student Record
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await Student.findByIdAndDelete(req.params.id);

    // Sync deletion to User collection
    const User = require('../models/User');
    await User.findOneAndDelete({ email: student.email.toLowerCase() });

    // Remove attendance logs
    await Attendance.deleteMany({ studentId: req.params.id });

    // Pull submissions
    await Task.updateMany(
      {},
      { $pull: { submissions: { studentId: req.params.id } } }
    );

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
