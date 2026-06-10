const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
  certificateNumber: { type: String, required: true, unique: true },
  issueDate: { type: Date, default: Date.now },
  pdfUrl: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
