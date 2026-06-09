const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  year: { type: Number },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true }
}, { timestamps: true });
module.exports = mongoose.model('Batch', schema);
