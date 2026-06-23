const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  date: { type: Date, required: true },
  checkIn: { type: String, default: '' },   // e.g. "09:15 AM"
  checkOut: { type: String, default: '' },  // e.g. "05:30 PM"
  status: { type: String, enum: ['Present', 'Absent', 'Late'], default: 'Absent' },
  remarks: { type: String, default: '' },
  markedByStudent: { type: Boolean, default: false },
  markedByAdmin: { type: Boolean, default: true },
  markedAt: { type: Date, default: Date.now }
}, { timestamps: true });

attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
