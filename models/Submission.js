const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissionText: {
    type: String,
    required: [true, 'Please add submission text / descriptions']
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminFeedback: {
    type: String,
    default: ''
  }
});

// A student can submit only one entry for a given task
SubmissionSchema.index({ taskId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', SubmissionSchema);
