const Attendance = require('../models/Attendance');
const User = require('../models/User');

// Helper to get local date in YYYY-MM-DD
const getLocalDateString = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

// @desc    Mark Daily Attendance
// @route   POST /api/attendance/mark
// @access  Private (Student)
exports.markAttendance = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['present', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid status: present or absent' });
    }

    const todayStr = getLocalDateString();

    // Check if user already marked attendance for today
    const existingRecord = await Attendance.findOne({
      studentId: req.user.id,
      date: todayStr
    });

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: `Attendance already marked as ${existingRecord.status} for today (${todayStr})`
      });
    }

    // Create attendance record
    const attendance = await Attendance.create({
      studentId: req.user.id,
      date: todayStr,
      status,
      markedByStudent: true,
      markedAt: new Date()
    });

    res.status(201).json({
      success: true,
      attendance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Today's Attendance List
// @route   GET /api/attendance/today
// @access  Private/Admin
exports.getTodayAttendance = async (req, res) => {
  try {
    const todayStr = req.query.date || getLocalDateString();

    // Get all students
    const students = await User.find({ role: 'student' }).select('name email course branch batch profilePhoto');
    
    // Get all marked attendance for today
    const attendanceRecords = await Attendance.find({ date: todayStr });

    // Map records for quick lookup
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.studentId.toString()] = {
        status: record.status,
        markedAt: record.markedAt,
        markedByStudent: record.markedByStudent,
        id: record._id
      };
    });

    // Combine student details with today's status
    const list = students.map(student => {
      const record = attendanceMap[student._id.toString()];
      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        course: student.course,
        branch: student.branch,
        batch: student.batch,
        profilePhoto: student.profilePhoto,
        attendance: record ? {
          _id: record.id,
          status: record.status,
          markedAt: record.markedAt,
          markedByStudent: record.markedByStudent
        } : {
          status: 'unmarked',
          markedAt: null,
          markedByStudent: false
        }
      };
    });

    const presentCount = list.filter(item => item.attendance.status === 'present').length;
    const absentCount = list.filter(item => item.attendance.status === 'absent').length;
    const unmarkedCount = list.filter(item => item.attendance.status === 'unmarked').length;

    res.status(200).json({
      success: true,
      date: todayStr,
      summary: {
        total: list.length,
        present: presentCount,
        absent: absentCount + unmarkedCount, // Unmarked are considered absent/not checked in
        explicitAbsent: absentCount,
        unmarked: unmarkedCount
      },
      list
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Student's Own Attendance History
// @route   GET /api/attendance/student/:id
// @access  Private (Admin or Owner Student)
exports.getStudentAttendanceHistory = async (req, res) => {
  try {
    const studentId = req.params.id;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to attendance history' });
    }

    const history = await Attendance.find({ studentId }).sort({ date: -1 });

    // Calculate percentage
    const totalDays = history.length;
    const presentDays = history.filter(record => record.status === 'present').length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    res.status(200).json({
      success: true,
      totalDays,
      presentDays,
      attendancePercentage,
      history
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Full Attendance Report
// @route   GET /api/attendance/report
// @access  Private/Admin
exports.getAttendanceReport = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('name email course branch batch');
    const allAttendance = await Attendance.find({});

    // Build statistics mapping
    const reportData = students.map(student => {
      const studentRecords = allAttendance.filter(
        record => record.studentId.toString() === student._id.toString()
      );

      const totalMarked = studentRecords.length;
      const presentCount = studentRecords.filter(r => r.status === 'present').length;
      const absentCount = studentRecords.filter(r => r.status === 'absent').length;
      const percentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 100;

      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        course: student.course,
        branch: student.branch,
        batch: student.batch,
        totalMarked,
        presentCount,
        absentCount,
        percentage
      };
    });

    res.status(200).json({
      success: true,
      report: reportData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
