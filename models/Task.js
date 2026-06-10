const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  solutionText: { type: String, required: true },
  githubLink: { type: String, default: '' },
  imagePath: { type: String, default: '' },
  documentPath: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'In Progress', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' },
  rejectionReason: { type: String, default: '' }
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  branch: { type: String, default: '' }, // e.g. "CSE", "IT"
  dueDate: { type: Date, default: null },
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' },
  submittedAt: { type: Date, default: null },
  assignmentType: { type: String, enum: ['all', 'course', 'student'], default: 'all' },
  course: { type: String, default: '' },
  submissions: [submissionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
