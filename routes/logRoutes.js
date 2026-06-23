const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// @desc    Get activity logs
// @route   GET /api/logs
// @access  Private/Admin
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Live counts for today
    const loginsToday = await ActivityLog.countDocuments({ action: 'login', createdAt: { $gte: startOfToday } });
    const submissionsToday = await ActivityLog.countDocuments({ action: 'task_submit', createdAt: { $gte: startOfToday } });
    const attendanceToday = await ActivityLog.countDocuments({ action: 'attendance', createdAt: { $gte: startOfToday } });
    const alertsCount = await ActivityLog.countDocuments({
      action: { $in: ['task_rejected', 'deadline_missed', 'absent'] },
      createdAt: { $gte: startOfToday }
    });

    const rawLogs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100);

    const logs = rawLogs.map(l => {
      const obj = l.toObject();
      obj.studentName = l.userName;
      obj.details = l.description;
      obj.course = l.role === 'admin' ? 'Admin' : 'Student';
      return obj;
    });

    res.status(200).json({
      success: true,
      stats: {
        loginsToday,
        submissionsToday,
        attendanceToday,
        alertsCount
      },
      // For compatibility
      loginsToday,
      submissionsToday,
      attendanceToday,
      alertsCount,
      logs,
      data: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
