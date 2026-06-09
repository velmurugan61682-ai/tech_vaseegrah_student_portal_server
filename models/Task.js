const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  dueDate: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });
module.exports = mongoose.model('Task', schema);
