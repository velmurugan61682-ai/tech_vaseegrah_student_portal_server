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
    data: {
      records,
      summary: { total, present, absent, percentage }
    }
  });
}));

module.exports = router;
