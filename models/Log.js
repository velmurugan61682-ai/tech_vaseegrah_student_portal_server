const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  studentName: { type: String, required: true },
  course: { type: String, default: '' },
  action: { type: String, required: true },
  details: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);
