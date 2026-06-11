const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  adminRemarks: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
