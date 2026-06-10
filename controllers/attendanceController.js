const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Log = require('../models/Log');

const normalizeDate = (dateString) => {
  const date = dateString && dateString !== 'today' ? new Date(dateString) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatTime = (dateObj) => {
  return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// @desc    Get all students attendance for selected date
// @route   GET /api/attendance/all
exports.getAllAttendance = async (req, res) => {
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
        checkIn: rec ? rec.checkIn || '-' : '-',
        checkOut: rec ? rec.checkOut || '-' : '-',
        remarks: rec ? rec.remarks || '' : '',
        markedAt: rec ? rec.markedAt || rec.updatedAt : null
      };
    });

    res.status(200).json({ success: true, list, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin manually update student status for a date
// @route   PUT /api/attendance/update
exports.updateAttendance = async (req, res) => {
  try {
    const { studentId, date, status, checkIn, checkOut, remarks } = req.body;
    if (!studentId || !date || !status) {
      return res.status(400).json({ success: false, message: 'Please provide studentId, date and status' });
    }

    const targetDate = normalizeDate(date);
    
    const studentObj = await Student.findById(studentId);
    if (!studentObj) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const updateFields = { status, markedAt: Date.now() };
    if (checkIn !== undefined) updateFields.checkIn = checkIn;
    if (checkOut !== undefined) updateFields.checkOut = checkOut;
    if (remarks !== undefined) updateFields.remarks = remarks;

    const record = await Attendance.findOneAndUpdate(
      { studentId, date: targetDate },
      updateFields,
      { upsert: true, new: true }
    );

    // Update Student Overall attendanceRate
    const studentRecords = await Attendance.find({ studentId });
    const totalDays = studentRecords.length;
    const presentDays = studentRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    studentObj.attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
    await studentObj.save();

    // Create Activity Log
    const log = new Log({
      studentId: studentObj._id,
      studentName: studentObj.name,
      course: studentObj.course || 'Unassigned',
      action: 'attendance',
      details: `Attendance updated to ${status} by admin for date ${targetDate.toLocaleDateString()}`
    });
    await log.save().catch(err => console.error('Activity logging failed:', err));

    // Live Socket Alert to student
    if (req.io) {
      req.io.emit('attendance_updated', {
        studentId: studentObj._id,
        date: targetDate.toISOString().split('T')[0],
        status,
        checkIn: record.checkIn,
        checkOut: record.checkOut
      });
    }

    res.status(200).json({ success: true, message: 'Attendance updated successfully', record, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student marks present/absent/late (Check-In or Check-Out)
// @route   POST /api/attendance/mark
exports.markAttendance = async (req, res) => {
  try {
    const { status, type, remarks } = req.body; // type: 'checkin' | 'checkout'
    const today = normalizeDate(new Date());

    let record = await Attendance.findOne({ studentId: req.user.id, date: today });
    const timeStr = formatTime(new Date());

    if (type === 'checkout') {
      if (!record) {
        return res.status(400).json({ success: false, message: 'You must check-in first before checking out!' });
      }
      record.checkOut = timeStr;
      if (remarks) record.remarks = remarks;
      await record.save();
    } else {
      // Check-in or general mark
      const finalStatus = status || 'present';
      
      const updateFields = {
        status: finalStatus,
        markedByStudent: true,
        markedAt: Date.now()
      };

      if (!record) {
        updateFields.checkIn = timeStr;
      }
      if (remarks) updateFields.remarks = remarks;

      record = await Attendance.findOneAndUpdate(
        { studentId: req.user.id, date: today },
        updateFields,
        { upsert: true, new: true }
      );
    }

    // Re-calculate Student overall attendanceRate
    const studentObj = await Student.findById(req.user.id);
    if (studentObj) {
      const studentRecords = await Attendance.find({ studentId: req.user.id });
      const totalDays = studentRecords.length;
      const presentDays = studentRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      studentObj.attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
      await studentObj.save();

      // Create Activity Log
      const log = new Log({
        studentId: req.user.id,
        studentName: req.user.name,
        course: req.user.course || 'Unassigned',
        action: 'attendance',
        details: type === 'checkout' ? `Checked out at ${timeStr}` : `Checked in at ${timeStr} as ${record.status}`
      });
      await log.save().catch(err => console.error('Activity logging failed:', err));
    }

    res.status(200).json({ 
      success: true, 
      message: type === 'checkout' ? `Checked out successfully` : `Checked in successfully`, 
      record, 
      data: record 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student's own attendance history
// @route   GET /api/attendance/my
exports.getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({ studentId: req.user.id }).sort({ date: -1 });
    
    const total = records.length;
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

    // Map records list for calendar formatting (YYYY-MM-DD keys)
    const formattedHistory = records.map(r => {
      // Ensure date formats to YYYY-MM-DD
      const dateString = new Date(r.date).toISOString().split('T')[0];
      return {
        _id: r._id,
        date: dateString,
        status: r.status,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        remarks: r.remarks,
        markedByStudent: r.markedByStudent,
        markedAt: r.markedAt
      };
    });

    res.status(200).json({
      success: true,
      history: formattedHistory,
      totalDays: total,
      presentDays: present,
      attendancePercentage: percentage,
      data: {
        records: formattedHistory,
        summary: { total, present, absent, percentage }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance history + summary for specific student
// @route   GET /api/attendance/student/:studentId
exports.getStudentAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await Attendance.find({ studentId }).sort({ date: -1 });
    
    const total = records.length;
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

    const formattedHistory = records.map(r => {
      const dateString = new Date(r.date).toISOString().split('T')[0];
      return {
        _id: r._id,
        date: dateString,
        status: r.status,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        remarks: r.remarks,
        markedByStudent: r.markedByStudent,
        markedAt: r.markedAt
      };
    });

    res.status(200).json({
      success: true,
      history: formattedHistory,
      totalDays: total,
      presentDays: present,
      attendancePercentage: percentage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance report for admin
// @route   GET /api/attendance/report
exports.getAttendanceReport = async (req, res) => {
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
};

// @desc    Export All Attendance as CSV
// @route   GET /api/attendance/export
exports.exportAttendanceCSV = async (req, res) => {
  try {
    const records = await Attendance.find().populate('studentId').sort({ date: -1 });
    
    // Set headers for download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Attendance_Registry.csv"');

    let csv = 'Student Name,Email,Course,Branch,Batch,Date,Check-In,Check-Out,Status,Remarks\n';
    
    records.forEach(r => {
      if (r.studentId) {
        const name = `"${r.studentId.name}"`;
        const email = `"${r.studentId.email}"`;
        const course = `"${r.studentId.course || ''}"`;
        const branch = `"${r.studentId.branch || ''}"`;
        const batch = `"${r.studentId.batch || ''}"`;
        const dateStr = new Date(r.date).toISOString().split('T')[0];
        const checkIn = `"${r.checkIn || ''}"`;
        const checkOut = `"${r.checkOut || ''}"`;
        const status = r.status;
        const remarks = `"${r.remarks || ''}"`;
        csv += `${name},${email},${course},${branch},${batch},${dateStr},${checkIn},${checkOut},${status},${remarks}\n`;
      }
    });

    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
