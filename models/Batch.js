const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  batchName: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  totalStudents: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);
