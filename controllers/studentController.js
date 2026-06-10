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
