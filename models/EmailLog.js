const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  recipientEmail: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Success', 'Failed'], 
    required: true 
  },
  errorMessage: { type: String, default: '' },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', emailLogSchema);
