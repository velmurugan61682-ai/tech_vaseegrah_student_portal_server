const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD to avoid timezone shifts and ensure uniqueness per student per day
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  markedByStudent: {
    type: Boolean,
    default: true
  }
});

// Compound index to guarantee one attendance entry per student per day
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
