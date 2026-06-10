const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  branchName: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  totalStudents: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
