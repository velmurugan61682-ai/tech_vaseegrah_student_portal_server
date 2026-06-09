const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  solutionText: String,
  solutionImage: String,
  solutionLink: String,
  solutionDocument: String,
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  adminMark: { type: Number, min: 0, max: 100 },
  adminNote: String,
  viewedByAdmin: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('TaskSubmission', schema);
