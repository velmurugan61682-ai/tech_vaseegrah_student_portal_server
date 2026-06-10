const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const Student = require('../models/Student');
const TaskSubmission = require('../models/TaskSubmission');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private/Admin
router.post('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  let { title, description, department, batch, assignedTo, dueDate, assignmentType, course } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, message: 'Please provide task title' });
  }

  // Resolve assignedTo students based on target scope
  if (assignmentType === 'course' && course) {
    const students = await Student.find({ course, isActive: true });
    assignedTo = students.map(student => student._id);
  } else if (assignmentType === 'all') {
    const students = await Student.find({ isActive: true });
    assignedTo = students.map(student => student._id);
  } else if ((!assignedTo || assignedTo.length === 0) && department && batch) {
    const students = await Student.find({ department, batch, isActive: true });
    assignedTo = students.map(student => student._id);
  }

  const task = new Task({
    title,
    description,
    department: department || null,
    batch: batch || null,
    assignedTo: assignedTo || [],
    assignmentType: assignmentType || 'all',
    course: course || null,
    dueDate,
    createdBy: req.user.id
  });

  await task.save();
  await task.populate('assignedTo');
  await task.populate('department');
  await task.populate('batch');
  await task.populate('createdBy');

  res.status(201).json({ success: true, data: task });
}));

// @desc    Get tasks (filtered by user role)
// @route   GET /api/tasks
// @access  Private
router.get('/', verifyToken, asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    // Admin gets all tasks with aggregated submission count, and approved count
    const tasks = await Task.find()
      .populate('department')
      .populate('batch')
      .populate('createdBy')
      .sort({ createdAt: -1 });

    const submissionCounts = await TaskSubmission.aggregate([
      {
        $group: {
          _id: '$task',
          totalCount: { $sum: 1 },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      }
    ]);

    const countsMap = {};
    submissionCounts.forEach(item => {
      countsMap[item._id.toString()] = {
        total: item.totalCount,
        approved: item.approvedCount
      };
    });

    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      const stats = countsMap[task._id.toString()] || { total: 0, approved: 0 };
      taskObj.submissionCount = stats.total;
      taskObj.approvedCount = stats.approved;
      return taskObj;
    });

    return res.status(200).json({ success: true, data: tasksWithStats });
  } else {
    // Student gets tasks where assignedTo includes req.user.id
    const tasks = await Task.find({ assignedTo: req.user.id })
      .populate('department')
      .populate('batch')
      .populate('createdBy')
      .sort({ dueDate: 1 });

    // Fetch student's submissions to return along with status
    const submissions = await TaskSubmission.find({ student: req.user.id });
    const submissionMap = {};
    submissions.forEach(sub => {
      submissionMap[sub.task.toString()] = sub;
    });

    const tasksWithStatus = tasks.map(task => {
      const taskObj = task.toObject();
      const sub = submissionMap[task._id.toString()];
      taskObj.submission = sub ? {
        _id: sub._id,
        status: sub.status,
        adminMark: sub.adminMark,
        adminNote: sub.adminNote,
        submittedAt: sub.submittedAt
      } : null;
      return taskObj;
    });

    return res.status(200).json({ success: true, data: tasksWithStatus });
  }
}));

// @desc    Get performance analytics for admin
// @route   GET /api/tasks/performance
// @access  Private/Admin
router.get('/performance', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const students = await Student.find().populate('department').populate('batch').sort({ name: 1 });
  const tasks = await Task.find();
  const submissions = await TaskSubmission.find().populate('student');

  let totalAssigned = 0;
  tasks.forEach(t => {
    totalAssigned += (t.assignedTo || []).length;
  });

  const totalCompleted = submissions.length;
  const totalApproved = submissions.filter(s => s.status === 'approved').length;

  const markedSubmissions = submissions.filter(s => s.adminMark !== undefined && s.adminMark !== null);
  const totalScoreSum = markedSubmissions.reduce((sum, s) => sum + s.adminMark, 0);
  const avgScore = markedSubmissions.length > 0 ? Math.round(totalScoreSum / markedSubmissions.length) : 0;

  // Group submissions by student ID
  const subsByStudent = {};
  submissions.forEach(s => {
    if (!s.student) return;
    const studentId = s.student._id.toString();
    if (!subsByStudent[studentId]) {
      subsByStudent[studentId] = [];
    }
    subsByStudent[studentId].push(s);
  });

  // Build student performance list
  const studentPerformance = students.map(student => {
    const studentId = student._id.toString();
    const studentSubmissions = subsByStudent[studentId] || [];
    
    // Count tasks assigned to this student
    const assignedCount = tasks.filter(t => (t.assignedTo || []).some(id => id.toString() === studentId)).length;
    const completedCount = studentSubmissions.length;
    const approvedCount = studentSubmissions.filter(s => s.status === 'approved').length;
    const rate = assignedCount > 0 ? Math.round((approvedCount / assignedCount) * 100) : 100;

    return {
      _id: student._id,
      name: student.name,
      course: student.course || 'Unassigned',
      assigned: assignedCount,
      completed: completedCount,
      approved: approvedCount,
      rate
    };
  });

  // Build course breakdown
  const coursesMap = {};
  students.forEach(student => {
    const course = student.course || 'Unassigned';
    if (!coursesMap[course]) {
      coursesMap[course] = { course, totalStudents: 0, assigned: 0, completed: 0, approved: 0 };
    }
    coursesMap[course].totalStudents += 1;
  });

  studentPerformance.forEach(sp => {
    const course = sp.course;
    if (coursesMap[course]) {
      coursesMap[course].assigned += sp.assigned;
      coursesMap[course].completed += sp.completed;
      coursesMap[course].approved += sp.approved;
    }
  });

  const courseBreakdown = Object.values(coursesMap).map(c => {
    const rate = c.assigned > 0 ? Math.round((c.approved / c.assigned) * 100) : 100;
    return {
      course: c.course,
      assigned: c.assigned,
      completed: c.completed,
      approved: c.approved,
      rate
    };
  });

  res.status(200).json({
    success: true,
    stats: {
      assigned: totalAssigned,
      completed: totalCompleted,
      approved: totalApproved,
      avgScore
    },
    students: studentPerformance,
    courseBreakdown
  });
}));

// @desc    Get single task detail
// @route   GET /api/tasks/:id
// @access  Private
router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email rollNumber profileImage')
    .populate('department')
    .populate('batch')
    .populate('createdBy', 'name email');

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  res.status(200).json({ success: true, data: task });
}));

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private/Admin
router.put('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  let { title, description, department, batch, assignedTo, dueDate } = req.body;

  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  if ((!assignedTo || assignedTo.length === 0) && department && batch) {
    const students = await Student.find({ department, batch, isActive: true });
    assignedTo = students.map(student => student._id);
  }

  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  if (department !== undefined) task.department = department || null;
  if (batch !== undefined) task.batch = batch || null;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (dueDate !== undefined) task.dueDate = dueDate;

  await task.save();
  await task.populate('assignedTo');
  await task.populate('department');
  await task.populate('batch');
  await task.populate('createdBy');

  res.status(200).json({ success: true, data: task });
}));

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private/Admin
router.delete('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // Delete all submissions associated with the task
  await TaskSubmission.deleteMany({ task: req.params.id });
  
  await Task.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Task and associated submissions deleted successfully' });
}));

module.exports = router;
