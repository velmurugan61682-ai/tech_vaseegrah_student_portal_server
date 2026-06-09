const Task = require('../models/Task');
const User = require('../models/User');

// @desc    Create Daily Task
// @route   POST /api/tasks
// @access  Private/Admin
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, course, studentId, dueDate, priority } = req.body;

    // Validation
    if (!title || !description || !assignedTo || !dueDate) {
      return res.status(400).json({ success: false, message: 'Please provide title, description, assignment scope, and due date' });
    }

    // Build task options
    const taskData = {
      title,
      description,
      assignedTo,
      dueDate,
      priority: priority || 'Medium',
      createdBy: req.user.id
    };

    if (assignedTo === 'course') {
      if (!course) {
        return res.status(400).json({ success: false, message: 'Please provide target course for course-wide assignment' });
      }
      taskData.course = course;
    } else if (assignedTo === 'student') {
      if (!studentId) {
        return res.status(400).json({ success: false, message: 'Please provide student ID for student-specific assignment' });
      }
      taskData.studentId = studentId;
    }

    const task = await Task.create(taskData);

    res.status(201).json({
      success: true,
      task
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Tasks (Filtered by role)
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'student') {
      // Students see tasks assigned to 'all', their specific course, or their specific user ID
      query = {
        $or: [
          { assignedTo: 'all' },
          { assignedTo: 'course', course: req.user.course },
          { assignedTo: 'student', studentId: req.user.id }
        ]
      };
    } else {
      // Admins see all tasks
      // Optional: query = { createdBy: req.user.id };
      query = {};
    }

    const tasks = await Task.find(query)
      .populate('studentId', 'name email course branch batch')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Task
// @route   PUT /api/tasks/:id
// @access  Private/Admin
exports.updateTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const { title, description, assignedTo, course, studentId, dueDate, priority } = req.body;

    const fieldsToUpdate = {};
    if (title) fieldsToUpdate.title = title;
    if (description) fieldsToUpdate.description = description;
    if (dueDate) fieldsToUpdate.dueDate = dueDate;
    if (priority) fieldsToUpdate.priority = priority;

    if (assignedTo) {
      fieldsToUpdate.assignedTo = assignedTo;
      if (assignedTo === 'all') {
        fieldsToUpdate.course = undefined;
        fieldsToUpdate.studentId = undefined;
      } else if (assignedTo === 'course') {
        fieldsToUpdate.course = course;
        fieldsToUpdate.studentId = undefined;
      } else if (assignedTo === 'student') {
        fieldsToUpdate.course = undefined;
        fieldsToUpdate.studentId = studentId;
      }
    }

    task = await Task.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      task
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Task
// @route   DELETE /api/tasks/:id
// @access  Private/Admin
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Delete task
    await Task.findByIdAndDelete(req.params.id);

    // Delete associated submissions
    const Submission = require('../models/Submission');
    await Submission.deleteMany({ taskId: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Task and associated submissions deleted'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
