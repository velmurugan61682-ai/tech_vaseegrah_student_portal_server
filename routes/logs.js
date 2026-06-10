const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Log = require('../models/Log');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @desc    Get recent activity logs & stats
// @route   GET /api/logs
// @access  Private/Admin
router.get('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Fetch count stats for today
  const loginsToday = await Log.countDocuments({
    action: 'login',
    createdAt: { $gte: startOfToday }
  });

  const submissionsToday = await Log.countDocuments({
    action: 'task_submit',
    createdAt: { $gte: startOfToday }
  });

  const attendanceToday = await Log.countDocuments({
    action: 'attendance',
    createdAt: { $gte: startOfToday }
  });

  const alertsCount = await Log.countDocuments({
    action: { $in: ['task_rejected', 'deadline_missed', 'absent'] },
    createdAt: { $gte: startOfToday }
  });

  // Fetch last 100 logs
  const logs = await Log.find()
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    success: true,
    stats: {
      loginsToday,
      submissionsToday,
      attendanceToday,
      alertsCount
    },
    logs
  });
}));

module.exports = router;
