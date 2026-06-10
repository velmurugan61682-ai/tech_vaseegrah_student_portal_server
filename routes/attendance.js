const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Helper to strip time from date and set to start of day
const normalizeDate = (dateString) => {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
};

// @desc    Mark attendance for current logged-in student (self)
// @route   POST /api/attendance/mark
// @access  Private (Student)
router.post('/mark', verifyToken, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status || !['present', 'absent'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Please provide valid status (present or absent)' });
  }

  // Get current date normalized (start of day)
  const today = normalizeDate(new Date());

  // Check if attendance already marked for today
  let record = await Attendance.findOne({
    student: req.user.id,
    date: today
  });

  if (record) {
    record.status = status;
    record.markedBy = req.user.id;
    record.markedByStudent = true;
    await record.save();
  } else {
    record = new Attendance({
      student: req.user.id,
      date: today,
      status,
      markedBy: req.user.id,
      markedByStudent: true
    });
    await record.save();
  }

  const student = await Student.findById(req.user.id);
  if (student) {
    const Log = require('../models/Log');
    const log = new Log({
      studentId: student._id,
      studentName: student.name,
      course: student.course || '',
      action: 'attendance',
      details: `Marked attendance as ${status}`
    });
    await log.save().catch(err => console.error('Failed to save activity log:', err));
  }

  res.status(200).json({
    success: true,
    message: `Attendance marked as ${status} successfully`,
    data: record
  });
}));

// @desc    Mark attendance (bulk)
// @route   POST /api/attendance
// @access  Private/Admin
router.post('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { date, records } = req.body;

  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ success: false, message: 'Please provide date and records array' });
  }

  const normalizedDate = normalizeDate(date);
  const updatedRecords = [];

  for (const rec of records) {
    const item = await Attendance.findOneAndUpdate(
      { student: rec.studentId, date: normalizedDate },
      { status: rec.status, markedBy: req.user.id },
      { upsert: true, new: true }
    );
    updatedRecords.push(item);
  }

  res.status(200).json({ 
    success: true, 
    message: 'Attendance marked successfully', 
    count: records.length 
  });
}));

// @desc    Get attendance summary and list for today/selected date
// @route   GET /api/attendance/today
// @access  Private/Admin
router.get('/today', verifyToken, asyncHandler(async (req, res) => {
  let { date } = req.query;
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  const normalizedDate = normalizeDate(date);

  // Find all active students
  const students = await Student.find({ isActive: true })
    .populate('department')
    .populate('batch')
    .sort({ name: 1 });

  // Find all attendance records for this date
  const records = await Attendance.find({ date: normalizedDate });

  const recordMap = {};
  records.forEach(r => {
    recordMap[r.student.toString()] = {
      status: r.status,
      markedAt: r.updatedAt || r.createdAt
    };
  });

  let presentCount = 0;
  let absentCount = 0;

  const list = students.map(student => {
    const attRecord = recordMap[student._id.toString()] || { status: 'not-marked', markedAt: null };
    if (attRecord.status === 'present') {
      presentCount++;
    } else if (attRecord.status === 'absent') {
      absentCount++;
    }
    return {
      _id: student._id,
      name: student.name,
      email: student.email,
      course: student.course,
      branch: student.department ? student.department.code : 'N/A',
      batch: student.batch ? student.batch.name : 'N/A',
      attendance: {
        status: attRecord.status,
        markedAt: attRecord.markedAt
      }
    };
  });

  res.status(200).json({
    success: true,
    list,
    summary: {
      total: students.length,
      present: presentCount,
      absent: students.length - presentCount
    }
  });
}));

// @desc    Get attendance sheet for date + department + batch
// @route   GET /api/attendance
// @access  Private/Admin
router.get('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { date, department, batch } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, message: 'Please specify date query parameter' });
  }

  const normalizedDate = normalizeDate(date);

  // Find students filtering by department and batch
  const studentFilter = { isActive: true };
  if (department) studentFilter.department = department;
  if (batch) studentFilter.batch = batch;

  const students = await Student.find(studentFilter)
    .select('_id name rollNumber profileImage')
    .sort({ name: 1 });
  const studentIds = students.map(s => s._id);

  // Find attendance records for these students on the given date
  const records = await Attendance.find({
    student: { $in: studentIds },
    date: normalizedDate
  });

  const recordMap = {};
  records.forEach(r => {
    recordMap[r.student.toString()] = r.status;
  });

  // Merge student objects with their attendance status
  const merged = students.map(student => ({
    student: {
      _id: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      profileImage: student.profileImage
    },
    status: recordMap[student._id.toString()] || 'not-marked'
  }));

  res.status(200).json({ success: true, data: merged });
}));

// @desc    Get attendance history + summary for student
// @route   GET /api/attendance/student/:studentId
// @access  Private
router.get('/student/:studentId', verifyToken, asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  // Authorization check (Admin or Student owner)
  if (req.user.role !== 'admin' && req.user.id !== studentId) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }

  const records = await Attendance.find({ student: studentId })
    .sort({ date: -1 });

  const total = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

  res.status(200).json({
    success: true,
    history: records,
    totalDays: total,
    presentDays: present,
    attendancePercentage: percentage,
    data: {
      records,
      summary: { total, present, absent, percentage }
    }
  });
}));

// @desc    Get attendance report for admin
// @route   GET /api/attendance/report
// @access  Private/Admin
router.get('/report', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const students = await Student.find().populate('department').populate('batch').sort({ name: 1 });
  
  // Get all attendance records
  const allRecords = await Attendance.find().sort({ date: -1 });
  
  // Group records by student ID
  const recordsByStudent = {};
  allRecords.forEach(record => {
    const studentId = record.student.toString();
    if (!recordsByStudent[studentId]) {
      recordsByStudent[studentId] = [];
    }
    recordsByStudent[studentId].push(record);
  });
  
  let totalStudents = students.length;
  let totalRateSum = 0;
  let perfectCount = 0;
  let atRiskCount = 0;
  
  const studentReports = students.map(student => {
    const records = recordsByStudent[student._id.toString()] || [];
    const totalLogged = records.length;
    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;
    
    const rate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 100;
    
    totalRateSum += rate;
    if (rate === 100) perfectCount++;
    if (rate < 75) atRiskCount++;
    
    const lastSeenRecord = records[0]; // sorted newest first
    const lastSeen = lastSeenRecord ? lastSeenRecord.date : null;
    
    let status = 'Active';
    if (rate < 75) status = 'At Risk';
    if (totalLogged === 0) status = 'Inactive';
    
    return {
      _id: student._id,
      name: student.name,
      course: student.course || 'Unassigned',
      branch: student.department ? student.department.code : 'N/A',
      batch: student.batch ? student.batch.name : 'N/A',
      email: student.email,
      totalLogged,
      presentCount,
      absentCount,
      rate,
      lastSeen,
      status
    };
  });
  
  const avgRate = totalStudents > 0 ? Math.round(totalRateSum / totalStudents) : 100;
  
  res.status(200).json({
    success: true,
    stats: {
      total: totalStudents,
      avgRate,
      perfect: perfectCount,
      atRisk: atRiskCount
    },
    students: studentReports
  });
}));

module.exports = router;
