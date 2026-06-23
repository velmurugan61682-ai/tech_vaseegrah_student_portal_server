const ActivityLog = require('../models/ActivityLog');

// @desc    Get latest activity logs
// @route   GET /api/activity
// @access  Private/Admin
exports.getActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(limit);
    
    // Format logs for frontend compatibility (e.g. mapping studentName and details)
    const mappedLogs = logs.map(l => {
      const obj = l.toObject();
      obj.studentName = l.userName;
      obj.details = l.description;
      obj.course = l.role === 'admin' ? 'Admin' : 'Student';
      return obj;
    });

    res.status(200).json({
      success: true,
      logs: mappedLogs,
      data: mappedLogs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get today's activity log stats
// @route   GET /api/activity/stats
// @access  Private/Admin
exports.getActivityStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const loginsToday = await ActivityLog.countDocuments({ action: 'login', createdAt: { $gte: startOfToday } });
    const submissionsToday = await ActivityLog.countDocuments({ action: 'task_submit', createdAt: { $gte: startOfToday } });
    const attendanceToday = await ActivityLog.countDocuments({ action: 'attendance', createdAt: { $gte: startOfToday } });
    const alertsCount = await ActivityLog.countDocuments({
      action: { $in: ['task_rejected', 'deadline_missed', 'absent'] },
      createdAt: { $gte: startOfToday }
    });

    res.status(200).json({
      success: true,
      stats: {
        loginsToday,
        submissionsToday,
        attendanceToday,
        alertsCount
      },
      loginsToday,
      submissionsToday,
      attendanceToday,
      alertsCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get today's activity logs
// @route   GET /api/activity/today
// @access  Private/Admin
exports.getTodayActivities = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const logs = await ActivityLog.find({ createdAt: { $gte: startOfToday } }).sort({ createdAt: -1 });

    const mappedLogs = logs.map(l => {
      const obj = l.toObject();
      obj.studentName = l.userName;
      obj.details = l.description;
      obj.course = l.role === 'admin' ? 'Admin' : 'Student';
      return obj;
    });

    res.status(200).json({
      success: true,
      logs: mappedLogs,
      data: mappedLogs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
