const ActivityLog = require('../models/ActivityLog');

exports.logActivity = async ({ userId, userName, role, module, action, description, io }) => {
  try {
    const log = new ActivityLog({
      userId,
      userName,
      role,
      module,
      action,
      description
    });
    await log.save();

    // Emit live socket update
    if (io) {
      io.emit('activity_log', log);
      console.log(`📡 Socket emitted new activity log: ${action}`);
    } else {
      console.log('⚠️ io instance not provided for socket emit');
    }
    return log;
  } catch (error) {
    console.error('❌ Error logging activity:', error);
  }
};
