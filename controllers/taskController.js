const Task = require('../models/Task');
const Student = require('../models/Student');
const TaskSubmission = require('../models/TaskSubmission');
const Log = require('../models/Log');
const mongoose = require('mongoose');

// Recalculate student task completion percentage
const recalculateTaskCompletion = async (studentId) => {
  try {
    const student = await Student.findById(studentId);
    if (!student) return;

    const allTasks = await Task.find();
    // Filter tasks assigned to this student
    const assignedTasks = allTasks.filter(t => {
      return (
        t.assignmentType === 'all' ||
        (t.assignmentType === 'course' && t.course === student.course) ||
        (t.assignmentType === 'student' && t.assignedTo.some(id => id.toString() === studentId.toString()))
      );
    });

    const approvedSubmissions = assignedTasks.filter(t => 
      t.submissions.some(sub => sub.studentId.toString() === studentId.toString() && sub.status === 'Approved')
    );

    student.taskCompletionPercentage = assignedTasks.length > 0
      ? Math.round((approvedSubmissions.length / assignedTasks.length) * 100)
      : 100;
    
    await student.save();
  } catch (err) {
    console.error('Error recalculating student task rates:', err);
  }
};

// @desc    Get performance analytics for admin
// @route   GET /api/tasks/performance
exports.getPerformanceAnalytics = async (req, res) => {
  try {
    const students = await Student.find().sort({ name: 1 });
    const tasks = await Task.find();

    let totalAssigned = 0;
    let totalCompleted = 0;
    let totalApproved = 0;

    const studentStats = students.map(student => {
      const sId = student._id.toString();
      const course = student.course || 'Unassigned';

      // Find tasks assigned to this student
      const assignedTasks = tasks.filter(t => {
        return (
          t.assignmentType === 'all' ||
          (t.assignmentType === 'course' && t.course === course) ||
          (t.assignmentType === 'student' && t.assignedTo.some(id => id.toString() === sId))
        );
      });

      const assignedCount = assignedTasks.length;
      
      // Submissions by this student
      let completedCount = 0;
      let approvedCount = 0;

      assignedTasks.forEach(task => {
        const sub = task.submissions.find(sub => sub.studentId.toString() === sId);
        if (sub) {
          completedCount++;
          if (sub.status === 'Approved') {
            approvedCount++;
          }
        }
      });

      totalAssigned += assignedCount;
      totalCompleted += completedCount;
      totalApproved += approvedCount;

      const rate = assignedCount > 0 ? Math.round((approvedCount / assignedCount) * 100) : 100;

      return {
        _id: student._id,
        name: student.name,
        course,
        assigned: assignedCount,
        completed: completedCount,
        approved: approvedCount,
        rate
      };
    });

    // Course breakdowns
    const courseBreakdownMap = {};
    students.forEach(student => {
      const course = student.course || 'Unassigned';
      if (!courseBreakdownMap[course]) {
        courseBreakdownMap[course] = { course, assigned: 0, completed: 0, approved: 0, totalStudents: 0 };
      }
      courseBreakdownMap[course].totalStudents++;
    });

    studentStats.forEach(st => {
      if (courseBreakdownMap[st.course]) {
        courseBreakdownMap[st.course].assigned += st.assigned;
        courseBreakdownMap[st.course].completed += st.completed;
        courseBreakdownMap[st.course].approved += st.approved;
      }
    });

    const courseBreakdown = Object.values(courseBreakdownMap).map(c => {
      const rate = c.assigned > 0 ? Math.round((c.approved / c.assigned) * 100) : 100;
      return {
        course: c.course,
        assigned: c.assigned,
        completed: c.completed,
        approved: c.approved,
        rate
      };
    });

    // Compute average score
    const avgScore = studentStats.length > 0
      ? Math.round(studentStats.reduce((sum, s) => sum + s.rate, 0) / studentStats.length)
      : 100;

    res.status(200).json({
      success: true,
      stats: {
        assigned: totalAssigned,
        completed: totalCompleted,
        approved: totalApproved,
        avgScore
      },
      students: studentStats,
      courseBreakdown,
      data: studentStats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get tasks assigned to logged-in student
// @route   GET /api/tasks/my
exports.getMyTasks = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentCourse = req.user.course || '';

    const allTasks = await Task.find().sort({ dueDate: 1 });
    const assignedTasks = allTasks.filter(t => {
      return (
        t.assignmentType === 'all' ||
        (t.assignmentType === 'course' && t.course === studentCourse) ||
        (t.assignmentType === 'student' && t.assignedTo.some(id => id.toString() === studentId.toString()))
      );
    });

    const tasksList = assignedTasks.map(task => {
      const sub = task.submissions.find(s => s.studentId.toString() === studentId.toString());
      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        submission: sub ? {
          solutionText: sub.solutionText,
          submissionText: sub.solutionText,
          githubLink: sub.githubLink,
          imagePath: sub.imagePath,
          documentPath: sub.documentPath,
          submittedAt: sub.submittedAt,
          status: sub.status,
          rejectionReason: sub.rejectionReason
        } : null
      };
    });

    res.status(200).json({ success: true, list: tasksList, data: tasksList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get task submissions for specific student
// @route   GET /api/tasks/student/:studentId/submissions
exports.getStudentSubmissions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const tasks = await Task.find();
    const studentSubmissions = [];
    
    tasks.forEach(task => {
      const sub = task.submissions.find(s => s.studentId.toString() === studentId.toString());
      if (sub) {
        studentSubmissions.push({
          _id: sub._id,
          taskId: {
            _id: task._id,
            title: task.title,
            description: task.description
          },
          solutionText: sub.solutionText,
          submissionText: sub.solutionText,
          githubLink: sub.githubLink,
          imagePath: sub.imagePath,
          documentPath: sub.documentPath,
          status: sub.status,
          adminFeedback: sub.rejectionReason,
          submittedAt: sub.submittedAt
        });
      }
    });
    
    res.status(200).json({ success: true, submissions: studentSubmissions, data: studentSubmissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get submissions for specific task
// @route   GET /api/tasks/:id/submissions
exports.getTaskSubmissions = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('submissions.studentId');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const mappedSubmissions = task.submissions.map(sub => ({
      _id: sub._id,
      studentId: sub.studentId,
      solutionText: sub.solutionText,
      submissionText: sub.solutionText,
      githubLink: sub.githubLink,
      imagePath: sub.imagePath,
      documentPath: sub.documentPath,
      status: sub.status,
      adminFeedback: sub.rejectionReason,
      submittedAt: sub.submittedAt
    }));

    res.status(200).json({ success: true, submissions: mappedSubmissions, data: mappedSubmissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a task
// @route   POST /api/tasks
exports.createTask = async (req, res) => {
  try {
    let { title, description, dueDate, priority, assignedTo, assignmentType, course, branch } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Please provide task title' });
    }

    let resolvedStudents = [];

    // Resolve assignedTo students based on target scope
    if (assignmentType === 'course') {
      const targetCourse = course || (Array.isArray(assignedTo) ? assignedTo[0] : assignedTo);
      if (targetCourse) {
        const students = await Student.find({ course: targetCourse });
        resolvedStudents = students.map(student => student._id);
      }
    } else if (assignmentType === 'all') {
      const students = await Student.find();
      resolvedStudents = students.map(student => student._id);
    } else {
      const rawIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
      resolvedStudents = rawIds.filter(id => id && mongoose.Types.ObjectId.isValid(id));
    }

    const task = new Task({
      title,
      description: description || '',
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || 'Medium',
      assignedTo: resolvedStudents,
      assignmentType: assignmentType || 'all',
      course: course || '',
      branch: branch || '',
      status: 'Pending',
      createdBy: req.user.id
    });

    await task.save();

    // Trigger Socket Notification to all assigned students
    if (req.io) {
      resolvedStudents.forEach(sId => {
        req.io.emit('task_assigned', {
          studentId: sId,
          taskId: task._id,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate
        });
      });
    }

    res.status(201).json({ success: true, message: 'Task created successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List all tasks with filters
// @route   GET /api/tasks
exports.getAllTasks = async (req, res) => {
  try {
    const { priority, assignmentType } = req.query;
    const filter = {};

    if (priority) filter.priority = priority;
    if (assignmentType) filter.assignmentType = assignmentType;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.submissionCount = task.submissions.length;
      taskObj.approvedCount = task.submissions.filter(s => s.status === 'Approved').length;
      return taskObj;
    });

    res.status(200).json({ success: true, tasks: tasksWithStats, data: tasksWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit student solution with file uploads
// @route   PUT /api/tasks/:id/submit
exports.submitTaskSolution = async (req, res) => {
  try {
    const { solutionText, githubLink } = req.body;
    if (!solutionText) {
      return res.status(400).json({ success: false, message: 'Please provide solution details' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Resolve uploaded files
    let imagePath = '';
    let documentPath = '';

    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        imagePath = req.files.image[0].path || '/uploads/' + req.files.image[0].filename;
      }
      if (req.files.document && req.files.document[0]) {
        documentPath = req.files.document[0].path || '/uploads/' + req.files.document[0].filename;
      }
    }

    const existingSubIndex = task.submissions.findIndex(
      s => s.studentId.toString() === req.user.id.toString()
    );

    // Save to task submissions array for compatibility
    if (existingSubIndex !== -1) {
      task.submissions[existingSubIndex].solutionText = solutionText;
      task.submissions[existingSubIndex].githubLink = githubLink || '';
      if (imagePath) task.submissions[existingSubIndex].imagePath = imagePath;
      if (documentPath) task.submissions[existingSubIndex].documentPath = documentPath;
      task.submissions[existingSubIndex].status = 'Submitted';
      task.submissions[existingSubIndex].rejectionReason = '';
      task.submissions[existingSubIndex].submittedAt = Date.now();
    } else {
      task.submissions.push({
        studentId: req.user.id,
        solutionText,
        githubLink: githubLink || '',
        imagePath,
        documentPath,
        status: 'Submitted',
        submittedAt: Date.now()
      });
    }

    task.status = 'Submitted';
    task.submittedAt = Date.now();
    await task.save();

    // Save/Update in separate TaskSubmission collection
    await TaskSubmission.findOneAndUpdate(
      { task: task._id, student: req.user.id },
      {
        solutionText,
        solutionImage: imagePath,
        solutionLink: githubLink || '',
        solutionDocument: documentPath,
        status: 'pending',
        submittedAt: Date.now()
      },
      { upsert: true, new: true }
    );

    // Create Activity Log
    const log = new Log({
      studentId: req.user.id,
      studentName: req.user.name,
      course: req.user.course || 'Unassigned',
      action: 'task_submit',
      details: `Submitted task solution for: "${task.title}"`
    });
    await log.save().catch(err => console.error('Activity logging failed:', err));

    // Socket alert to Admins
    if (req.io) {
      req.io.emit('task_submitted', {
        studentId: req.user.id,
        studentName: req.user.name,
        taskId: task._id,
        title: task.title
      });
    }

    res.status(200).json({ success: true, message: 'Solution submitted successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject task submission
// @route   PUT /api/tasks/:id/review
exports.reviewTaskSubmission = async (req, res) => {
  try {
    const { studentId, status, adminFeedback } = req.body;
    if (!studentId || !status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide valid studentId, status (Approved/Rejected)' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const sub = task.submissions.find(s => s.studentId.toString() === studentId.toString());
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    sub.status = status;
    sub.rejectionReason = adminFeedback || '';
    
    // Set overall task status
    task.status = status;
    await task.save();

    // Update in separate TaskSubmission collection
    const dbStatus = status === 'Approved' ? 'approved' : 'rejected';
    await TaskSubmission.findOneAndUpdate(
      { task: task._id, student: studentId },
      { status: dbStatus, adminNote: adminFeedback || '' }
    );

    const studentObj = await Student.findById(studentId);
    if (studentObj) {
      // Recalculate completion cache
      await recalculateTaskCompletion(studentId);

      // Create Activity Log
      const log = new Log({
        studentId: studentObj._id,
        studentName: studentObj.name,
        course: studentObj.course || 'Unassigned',
        action: status === 'Approved' ? 'task_approved' : 'task_rejected',
        details: status === 'Approved' 
          ? `Task submission approved: "${task.title}"` 
          : `Task submission rejected: "${task.title}" - Feedback: ${adminFeedback || ''}`
      });
      await log.save().catch(err => console.error('Activity logging failed:', err));

      // Socket live alert to student
      if (req.io) {
        req.io.emit('task_reviewed', {
          studentId: studentObj._id,
          taskId: task._id,
          title: task.title,
          status,
          adminFeedback: adminFeedback || ''
        });
      }
    }

    res.status(200).json({ success: true, message: `Submission reviewed successfully as ${status}`, task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const studentIds = task.assignedTo;
    await Task.findByIdAndDelete(req.params.id);

    // Also delete submissions
    await TaskSubmission.deleteMany({ task: req.params.id });

    // Recalculate all affected students rates
    for (const sId of studentIds) {
      await recalculateTaskCompletion(sId);
    }

    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a task
// @route   PUT /api/tasks/:id
exports.updateTask = async (req, res) => {
  try {
    const { title, description, dueDate, priority, assignedTo, assignmentType, course, branch } = req.body;
    let task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) task.priority = priority;
    if (assignmentType !== undefined) task.assignmentType = assignmentType;
    if (course !== undefined) task.course = course;
    if (branch !== undefined) task.branch = branch;

    if (assignedTo !== undefined) {
      let resolvedStudents = [];
      const targetType = assignmentType || task.assignmentType;
      if (targetType === 'course') {
        const targetCourse = course || task.course || assignedTo;
        const students = await Student.find({ course: targetCourse });
        resolvedStudents = students.map(student => student._id);
      } else if (targetType === 'all') {
        const students = await Student.find();
        resolvedStudents = students.map(student => student._id);
      } else {
        const rawIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
        resolvedStudents = rawIds.filter(id => id && mongoose.Types.ObjectId.isValid(id));
      }
      task.assignedTo = resolvedStudents;
    }

    await task.save();
    res.status(200).json({ success: true, message: 'Task updated successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve convenience wrapper
// @route   PUT /api/tasks/:id/approve
exports.approveSubmission = async (req, res) => {
  req.body.status = 'Approved';
  return exports.reviewTaskSubmission(req, res);
};

// @desc    Reject convenience wrapper
// @route   PUT /api/tasks/:id/reject
exports.rejectSubmission = async (req, res) => {
  req.body.status = 'Rejected';
  req.body.adminFeedback = req.body.reason || '';
  return exports.reviewTaskSubmission(req, res);
};
