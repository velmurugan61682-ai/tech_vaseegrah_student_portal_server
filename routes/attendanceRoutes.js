const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Log = require('../models/Log');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// Helper to strip time from date and set to start of day
const normalizeDate = (dateString) => {
  const date = dateString && dateString !== 'today' ? new Date(dateString) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

// @desc    Get all students attendance for selected date
// @route   GET /api/attendance/all
// @access  Private/Admin
router.get('/all', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = normalizeDate(date);

    const students = await Student.find().sort({ name: 1 });
    const records = await Attendance.find({ date: targetDate });

    const recordsMap = {};
    records.forEach(r => {
      recordsMap[r.studentId.toString()] = r;
    });

    const list = students.map(s => {
      const rec = recordsMap[s._id.toString()];
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        course: s.course,
        branch: s.branch,
        batch: s.batch,
        status: rec ? rec.status : 'unmarked',
        markedAt: rec ? rec.markedAt || rec.updatedAt : null
      };
    });

    res.status(200).json({ success: true, list, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Admin manually update student status for a date
// @route   PUT /api/attendance/update
// @access  Private/Admin
router.put('/update', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId, date, status } = req.body;
    if (!studentId || !date || !status) {
      return res.status(400).json({ success: false, message: 'Please provide studentId, date and status' });
    }

    const targetDate = normalizeDate(date);
    
    const studentObj = await Student.findById(studentId);
    if (!studentObj) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const record = await Attendance.findOneAndUpdate(
      { studentId, date: targetDate },
      { status, markedAt: Date.now() },
      { upsert: true, new: true }
    );

    // Create Activity Log
    const log = new Log({
      studentId: studentObj._id,
      studentName: studentObj.name,
      course: studentObj.course || 'Unassigned',
      action: 'attendance',
      details: `Attendance status updated to ${status} by admin for date ${targetDate.toLocaleDateString()}`
    });
    await log.save().catch(err => console.error('Activity logging failed:', err));

    res.status(200).json({ success: true, message: 'Attendance updated successfully', record, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Student marks present/absent for today
// @route   POST /api/attendance/mark
// @access  Private (Student)
router.post('/mark', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide valid status (present, absent, late)' });
    }

    const today = normalizeDate(new Date());
    
    const record = await Attendance.findOneAndUpdate(
      { studentId: req.user.id, date: today },
      { status, markedAt: Date.now() },
      { upsert: true, new: true }
    );

    // Create Activity Log
    const log = new Log({
      studentId: req.user.id,
      studentName: req.user.name,
      course: req.user.course || 'Unassigned',
      action: 'attendance',
      details: `Marked attendance as ${status}`
    });
    await log.save().catch(err => console.error('Activity logging failed:', err));

    res.status(200).json({ 
      success: true, 
      message: `Attendance marked as ${status} successfully`, 
      record, 
      data: record 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get student's own attendance history
// @route   GET /api/attendance/my
// @access  Private (Student)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.user.id }).sort({ date: -1 });
    
    const total = records.length;
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get attendance report for admin
// @route   GET /api/attendance/report
// @access  Private/Admin
router.get('/report', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const students = await Student.find().sort({ name: 1 });
    const allRecords = await Attendance.find().sort({ date: -1 });
    
    // Group by student
    const recordsByStudent = {};
    allRecords.forEach(record => {
      const studentId = record.studentId.toString();
      if (!recordsByStudent[studentId]) {
        recordsByStudent[studentId] = [];
      }
      recordsByStudent[studentId].push(record);
    });

    let totalStudents = students.length;
    let totalRateSum = 0;
    let perfectCount = 0;
    let atRiskCount = 0; // below 75%

    const studentReports = students.map(student => {
      const records = recordsByStudent[student._id.toString()] || [];
      const totalLogged = records.length;
      const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
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
        email: student.email,
        course: student.course || 'Unassigned',
        branch: student.branch || 'N/A',
        batch: student.batch || 'N/A',
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
      students: studentReports,
      data: studentReports
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get attendance history + summary for specific student
// @route   GET /api/attendance/student/:studentId
// @access  Private
router.get('/student/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await Attendance.find({ studentId }).sort({ date: -1 });
    
    const total = records.length;
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

    res.status(200).json({
      success: true,
      history: records,
      totalDays: total,
      presentDays: present,
      attendancePercentage: percentage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
