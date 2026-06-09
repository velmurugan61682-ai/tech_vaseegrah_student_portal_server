const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Attendance = require('../models/Attendance');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All report routes require admin privileges
router.use(verifyToken, isAdmin);

// @desc    Get task completion rates by student
// @route   GET /api/reports/task-completion
router.get('/task-completion', asyncHandler(async (req, res) => {
  const { department, batch } = req.query;

  const studentFilter = { isActive: true };
  if (department) studentFilter.department = department;
  if (batch) studentFilter.batch = batch;

  const students = await Student.find(studentFilter)
    .populate('department')
    .populate('batch')
    .sort({ name: 1 });

  const report = [];

  for (const student of students) {
    const assigned = await Task.countDocuments({ assignedTo: student._id });
    const submitted = await TaskSubmission.countDocuments({ student: student._id });
    const approved = await TaskSubmission.countDocuments({ student: student._id, status: 'approved' });
    const completionRate = assigned > 0 ? Math.round((approved / assigned) * 100) : 0;

    report.push({
      studentId: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      dept: student.department ? student.department.code : 'N/A',
      batch: student.batch ? student.batch.name : 'N/A',
      assigned,
      submitted,
      approved,
      completionRate
    });
  }

  res.status(200).json({ success: true, data: report });
}));

// @desc    Get attendance summary stacked by date
// @route   GET /api/reports/attendance-summary
router.get('/attendance-summary', asyncHandler(async (req, res) => {
  const { startDate, endDate, department, batch } = req.query;

  const studentFilter = { isActive: true };
  if (department) studentFilter.department = department;
  if (batch) studentFilter.batch = batch;

  const students = await Student.find(studentFilter);
  const studentIds = students.map(s => s._id);

  const attendanceFilter = { student: { $in: studentIds } };
  if (startDate || endDate) {
    attendanceFilter.date = {};
    if (startDate) attendanceFilter.date.$gte = new Date(startDate);
    if (endDate) attendanceFilter.date.$lte = new Date(endDate);
  }

  const records = await Attendance.find(attendanceFilter);

  const group = {};
  records.forEach(r => {
    const dateStr = r.date.toISOString().split('T')[0];
    if (!group[dateStr]) {
      group[dateStr] = { present: 0, absent: 0, total: 0 };
    }
    if (r.status === 'present') {
      group[dateStr].present++;
    } else if (r.status === 'absent') {
      group[dateStr].absent++;
    }
    group[dateStr].total++;
  });

  const summaryList = Object.keys(group).map(date => {
    const total = group[date].total;
    const present = group[date].present;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    
    return {
      date,
      present,
      absent: group[date].absent,
      total,
      attendanceRate
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  res.status(200).json({ success: true, data: summaryList });
}));

// @desc    Get daily submission counts over the last 30 days
// @route   GET /api/reports/daily-submissions
router.get('/daily-submissions', asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const submissions = await TaskSubmission.find({
    submittedAt: { $gte: thirtyDaysAgo }
  });

  const group = {};
  submissions.forEach(sub => {
    const dateObj = new Date(sub.submittedAt);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    group[dateStr] = (group[dateStr] || 0) + 1;
  });

  const results = [];
  // Ensure every day in the last 30 days is rendered (no gaps)
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    results.push({
      date: dateStr,
      count: group[dateStr] || 0
    });
  }

  res.status(200).json({ success: true, data: results });
}));

// @desc    Get complete performance scorecard for all students
// @route   GET /api/reports/student-performance
router.get('/student-performance', asyncHandler(async (req, res) => {
  const students = await Student.find({ isActive: true })
    .populate('department')
    .populate('batch')
    .sort({ name: 1 });

  const report = [];

  for (const student of students) {
    const assigned = await Task.countDocuments({ assignedTo: student._id });
    const submissions = await TaskSubmission.find({ student: student._id });
    const submitted = submissions.length;
    const approved = submissions.filter(s => s.status === 'approved').length;

    const gradedSubmissions = submissions.filter(s => s.adminMark !== undefined && s.adminMark !== null);
    const avgMark = gradedSubmissions.length > 0
      ? Math.round(gradedSubmissions.reduce((sum, s) => sum + s.adminMark, 0) / gradedSubmissions.length)
      : 0;

    const attendanceRecords = await Attendance.find({ student: student._id });
    const totalAttendance = attendanceRecords.length;
    const presentAttendance = attendanceRecords.filter(r => r.status === 'present').length;
    const attendancePercentage = totalAttendance > 0
      ? Math.round((presentAttendance / totalAttendance) * 100)
      : 100;

    report.push({
      studentId: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      dept: student.department ? student.department.code : 'N/A',
      batch: student.batch ? student.batch.name : 'N/A',
      assigned,
      submitted,
      approved,
      avgMark,
      attendancePercentage
    });
  }

  res.status(200).json({ success: true, data: report });
}));

module.exports = router;
