const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// @desc    Get activity logs
// @route   GET /api/logs
// @access  Private/Admin
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Live counts for today
    const loginsToday = await Log.countDocuments({ action: 'login', createdAt: { $gte: startOfToday } });
    const submissionsToday = await Log.countDocuments({ action: 'task_submit', createdAt: { $gte: startOfToday } });
    const attendanceToday = await Log.countDocuments({ action: 'attendance', createdAt: { $gte: startOfToday } });
    const alertsCount = await Log.countDocuments({
      action: { $in: ['task_rejected', 'deadline_missed', 'absent'] },
      createdAt: { $gte: startOfToday }
    });

    const logs = await Log.find().sort({ createdAt: -1 }).limit(100);

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
