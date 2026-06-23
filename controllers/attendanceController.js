const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Log = require('../models/Log');
const { logActivity } = require('../services/activityLogService');

const normalizeDate = (dateString) => {
  const date = dateString && dateString !== 'today' ? new Date(dateString) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatTime = (dateObj) => {
  return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// @desc    Get all students attendance for selected date (legacy query support)
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
        status: rec ? rec.status : 'Absent',
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

// @desc    Admin manually update single student status for a date
// @route   PUT /api/attendance/update
exports.updateAttendance = async (req, res) => {
  try {
    const { studentId, date, status, checkIn, checkOut, remarks } = req.body;
    if (!studentId || !date || !status) {
      return res.status(400).json({ success: false, message: 'Please provide studentId, date and status' });
    }

    // Capitalize status if needed
    let formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    if (!['Present', 'Absent', 'Late'].includes(formattedStatus)) {
      formattedStatus = 'Present';
    }

    const targetDate = normalizeDate(date);
    
    const studentObj = await Student.findById(studentId);
    if (!studentObj) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const updateFields = { 
      status: formattedStatus, 
      branchId: studentObj.branchId,
      markedAt: Date.now(),
      markedByAdmin: true
    };
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
    const presentDays = studentRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
    studentObj.attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
    await studentObj.save();

    // Create Activity Log
    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      module: 'Attendance',
      action: 'attendance',
      description: `Attendance updated to ${formattedStatus} by admin for ${studentObj.name} (Date: ${targetDate.toLocaleDateString()})`,
      io: req.io
    });

    // Live Socket Alert to student
    if (req.io) {
      req.io.emit('attendance_updated', {
        studentId: studentObj._id,
        date: targetDate.toISOString().split('T')[0],
        status: formattedStatus,
        checkIn: record.checkIn,
        checkOut: record.checkOut
      });
    }

    res.status(200).json({ success: true, message: 'Attendance updated successfully', record, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student self-marks attendance or Admin bulk marks branch attendance
// @route   POST /api/attendance/mark
exports.markAttendance = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole === 'admin') {
      const { branchId, date, records } = req.body;
      if (!branchId || !date || !records || !Array.isArray(records)) {
        return res.status(400).json({ success: false, message: 'Please provide branchId, date and records array' });
      }

      const targetDate = normalizeDate(date);

      // Verify all students belong to the selected branch (Requirement 15)
      const studentsInBranch = await Student.find({ branchId });
      const studentIdsInBranch = new Set(studentsInBranch.map(s => s._id.toString()));

      const invalidRecords = records.filter(r => !studentIdsInBranch.has(r.studentId));
      if (invalidRecords.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Admin can mark attendance only for students belonging to the selected branch.' 
        });
      }

      const savedRecords = [];
      for (const rec of records) {
        const { studentId, status } = rec;
        // Capitalize status
        let formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        if (!['Present', 'Absent', 'Late'].includes(formattedStatus)) {
          formattedStatus = 'Present';
        }

        const attendance = await Attendance.findOneAndUpdate(
          { studentId, date: targetDate },
          {
            branchId,
            status: formattedStatus,
            markedByAdmin: true,
            markedAt: Date.now()
          },
          { upsert: true, new: true }
        );
        savedRecords.push(attendance);

        // Recalculate Student overall attendanceRate
        const studentRecords = await Attendance.find({ studentId });
        const totalDays = studentRecords.length;
        const presentDays = studentRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
        await Student.findByIdAndUpdate(studentId, { attendancePercentage });
      }

      await logActivity({
        userId: req.user.id,
        userName: req.user.name,
        role: req.user.role,
        module: 'Attendance',
        action: 'attendance',
        description: `Bulk attendance marked for branch (Count: ${savedRecords.length}, Date: ${targetDate.toLocaleDateString()})`,
        io: req.io
      });

      res.status(200).json({ success: true, message: 'Attendance marked successfully', count: savedRecords.length, data: savedRecords });
    } else {
      // Student marks self attendance
      const { status, type, remarks } = req.body; // type: 'checkin' | 'checkout'
      const today = normalizeDate(new Date());

      const studentObj = await Student.findById(req.user.id);
      if (!studentObj) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }

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
        let finalStatus = status || 'Present';
        // Capitalize status
        finalStatus = finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1).toLowerCase();
        if (!['Present', 'Absent', 'Late'].includes(finalStatus)) {
          finalStatus = 'Present';
        }
        
        const updateFields = {
          branchId: studentObj.branchId,
          status: finalStatus,
          markedByStudent: true,
          markedByAdmin: false,
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
      const studentRecords = await Attendance.find({ studentId: req.user.id });
      const totalDays = studentRecords.length;
      const presentDays = studentRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
      studentObj.attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
      await studentObj.save();

      // Create Activity Log
      await logActivity({
        userId: req.user.id,
        userName: studentObj.name,
        role: 'student',
        module: 'Attendance',
        action: 'attendance',
        description: type === 'checkout' ? `Checked out at ${timeStr}` : `Checked in at ${timeStr} as ${record.status}`,
        io: req.io
      });

      res.status(200).json({ 
        success: true, 
        message: type === 'checkout' ? `Checked out successfully` : `Checked in successfully`, 
        record, 
        data: record 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance records for a specific date
// @route   GET /api/attendance/date/:date
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { branchId } = req.query;
    const targetDate = normalizeDate(date);

    let query = { date: targetDate };
    if (branchId) {
      query.branchId = branchId;
    }

    const records = await Attendance.find(query)
      .populate('studentId', 'name email branch batch profilePhoto')
      .populate('branchId', 'branchName');

    res.status(200).json({ success: true, records, data: records });
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
