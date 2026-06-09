const Submission = require('../models/Submission');
const Task = require('../models/Task');
const User = require('../models/User');

// @desc    Submit Task Solution
// @route   POST /api/submissions
// @access  Private (Student)
exports.submitTask = async (req, res) => {
  try {
    const { taskId, submissionText } = req.body;

    if (!taskId || !submissionText) {
      return res.status(400).json({ success: false, message: 'Please provide taskId and submissionText' });
    }

    // Verify task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Verify student is assigned to this task
    let isAssigned = false;
    if (task.assignedTo === 'all') {
      isAssigned = true;
    } else if (task.assignedTo === 'course' && task.course === req.user.course) {
      isAssigned = true;
    } else if (task.assignedTo === 'student' && task.studentId.toString() === req.user.id) {
      isAssigned = true;
    }

    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this task' });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findOne({
      taskId,
      studentId: req.user.id
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a solution for this task'
      });
    }

    // Create submission
    const submission = await Submission.create({
      taskId,
      studentId: req.user.id,
      submissionText,
      status: 'pending',
      submittedAt: new Date()
    });

    res.status(201).json({
      success: true,
      submission
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Submissions for a Specific Task
// @route   GET /api/submissions/task/:taskId
// @access  Private/Admin
exports.getTaskSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ taskId: req.params.taskId })
      .populate('studentId', 'name email course branch batch profilePhoto')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      submissions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Review Submission (Approve/Reject)
// @route   PUT /api/submissions/:id/review
// @access  Private/Admin
exports.reviewSubmission = async (req, res) => {
  try {
    const { status, adminFeedback } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide status: approved or rejected' });
    }

    let submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    submission = await Submission.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminFeedback: adminFeedback || ''
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      submission
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Student Submissions
// @route   GET /api/submissions/student/:id
// @access  Private (Admin or Owner Student)
exports.getStudentSubmissions = async (req, res) => {
  try {
    const studentId = req.params.id;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to submissions' });
    }

    const submissions = await Submission.find({ studentId })
      .populate('taskId', 'title description dueDate priority')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: submissions.length,
      submissions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
