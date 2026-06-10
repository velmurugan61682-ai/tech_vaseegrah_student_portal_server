const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['attendance', 'performance', 'task'], required: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  format: { type: String, enum: ['pdf', 'csv'], required: true }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
