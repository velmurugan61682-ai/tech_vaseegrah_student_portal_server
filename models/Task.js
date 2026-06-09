const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a task title'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please add a task description']
  },
  assignedTo: {
    type: String,
    enum: ['all', 'course', 'student'],
    required: true
  },
  course: {
    type: String,
    enum: ['Java', 'Python', 'MERN Stack', 'AI & ML'],
    required: function() { return this.assignedTo === 'course'; }
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.assignedTo === 'student'; }
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add a due date']
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Task', TaskSchema);
