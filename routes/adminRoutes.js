const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalInterns = await Student.countDocuments();
    
    // Normalize today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPresent = await Attendance.countDocuments({ date: today, status: { $in: ['present', 'late'] } });
    const todayAbsent = await Attendance.countDocuments({ date: today, status: 'absent' });

    // Count tasks submitted today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const tasks = await Task.find({
      'submissions.submittedAt': { $gte: startOfToday }
    });
    
    let tasksSubmittedToday = 0;
    tasks.forEach(t => {
      t.submissions.forEach(sub => {
        if (new Date(sub.submittedAt) >= startOfToday) {
          tasksSubmittedToday++;
        }
      });
    });

    // Breakdown lists
    const students = await Student.find();
    const byCourse = {};
    const byBranch = {};
    students.forEach(s => {
      const course = s.course || 'Unassigned';
      byCourse[course] = (byCourse[course] || 0) + 1;
      const branch = s.branch || 'Unassigned';
      byBranch[branch] = (byBranch[branch] || 0) + 1;
    });

    // Today's attendance list
    const records = await Attendance.find({ date: today });
    const recordsMap = {};
    records.forEach(r => {
      recordsMap[r.studentId.toString()] = r.status;
    });

    const todayAttendanceList = students.map(s => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      course: s.course,
      branch: s.branch,
      batch: s.batch,
      status: recordsMap[s._id.toString()] || 'unmarked'
    }));

    res.status(200).json({
      success: true,
      stats: {
        totalInterns,
        todayPresent,
        todayAbsent: totalInterns - todayPresent, // total active students minus present
        tasksSubmittedToday,
        byCourse,
        byBranch
      },
      // For compatibility
      totalInterns,
      todayPresent,
      todayAbsent: totalInterns - todayPresent,
      tasksSubmittedToday,
      byCourse,
      byBranch,
      todayAttendanceList
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get Student Directory
// @route   GET /api/admin/students
// @access  Private/Admin
router.get('/students', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { course, branch, batch, todayStatus } = req.query;
    
    const students = await Student.find().sort({ name: 1 });
    const allAttendance = await Attendance.find();
    const allTasks = await Task.find();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const studentsList = [];
    
    // Group attendance by student ID
    const attendanceByStudent = {};
    allAttendance.forEach(att => {
      const sId = att.studentId.toString();
      if (!attendanceByStudent[sId]) {
        attendanceByStudent[sId] = [];
      }
      attendanceByStudent[sId].push(att);
    });

    students.forEach(s => {
      const sId = s._id.toString();
      const records = attendanceByStudent[sId] || [];
      const totalLogged = records.length;
      const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendanceRate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 100;
      
      const todayRecord = records.find(r => new Date(r.date).getTime() === today.getTime());
      const todayStatusVal = todayRecord ? todayRecord.status : 'unmarked';
      
      // Find recent submissions
      const submissions = [];
      allTasks.forEach(task => {
        const sub = task.submissions.find(sub => sub.studentId.toString() === sId);
        if (sub) {
          submissions.push({
            taskId: task._id,
            taskTitle: task.title,
            solution: sub.solution,
            submittedAt: sub.submittedAt,
            status: sub.status,
            rejectionReason: sub.rejectionReason
          });
        }
      });
      submissions.sort((a, b) => b.submittedAt - a.submittedAt);
      
      studentsList.push({
        _id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        college: s.college,
        branch: s.branch,
        batch: s.batch,
        course: s.course,
        role: s.role,
        attendanceRate,
        todayStatus: todayStatusVal,
        recentTasks: submissions
      });
    });

    // Apply filters
    let filtered = studentsList;
    if (course) {
      filtered = filtered.filter(s => s.course === course);
    }
    if (branch) {
      filtered = filtered.filter(s => s.branch === branch);
    }
    if (batch) {
      filtered = filtered.filter(s => s.batch === batch);
    }
    if (todayStatus) {
      filtered = filtered.filter(s => s.todayStatus === todayStatus);
    }

    res.status(200).json({ success: true, students: filtered, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete student record
// @route   DELETE /api/admin/students/:id
// @access  Private/Admin
router.delete('/students/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    await Student.findByIdAndDelete(req.params.id);
    
    // Also delete attendance records
    await Attendance.deleteMany({ studentId: req.params.id });
    
    // Also pull their submissions from tasks
    await Task.updateMany(
      {},
      { $pull: { submissions: { studentId: req.params.id } } }
    );

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
