const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Student = require('../models/Student');
const Task = require('../models/Task');
const Log = require('../models/Log');
const { verifyToken, verifyAdmin, verifyStudent } = require('../middleware/authMiddleware');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer upload middleware
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // max size 10MB overall limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files (PNG, JPG, JPEG) are allowed for screenshots!'), false);
      }
    } else if (file.fieldname === 'document') {
      const allowedExts = ['.pdf', '.docx', '.doc'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return cb(new Error('Only PDF or DOCX files are allowed for documents!'), false);
      }
    }
    cb(null, true);
  }
});

// @desc    Get performance analytics for admin
// @route   GET /api/tasks/performance
// @access  Private/Admin
router.get('/performance', verifyToken, verifyAdmin, async (req, res) => {
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
          if (sub.status === 'approved') {
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

    // Compute average score as task completion percentage average
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
});

// @desc    Get tasks assigned to logged-in student
// @route   GET /api/tasks/my
// @access  Private (Student)
router.get('/my', verifyToken, verifyStudent, async (req, res) => {
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
});

// @desc    Get task submissions for specific student
// @route   GET /api/tasks/student/:studentId/submissions
// @access  Private/Admin
router.get('/student/:studentId/submissions', verifyToken, verifyAdmin, async (req, res) => {
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
});

// @desc    Get submissions for specific task
// @route   GET /api/tasks/:id/submissions
// @access  Private/Admin
router.get('/:id/submissions', verifyToken, verifyAdmin, async (req, res) => {
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
});

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private/Admin
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    let { title, description, dueDate, priority, assignedTo, assignmentType, course } = req.body;

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
      description,
      dueDate,
      priority: priority || 'Medium',
      assignedTo: resolvedStudents,
      assignmentType: assignmentType || 'all',
      course: course || null,
      createdBy: req.user.id
    });

    await task.save();
    res.status(201).json({ success: true, message: 'Task created successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    List all tasks with filters
// @route   GET /api/tasks
// @access  Private/Admin
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { priority, assignmentType } = req.query;
    const filter = {};

    if (priority) filter.priority = priority;
    if (assignmentType) filter.assignmentType = assignmentType;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    const tasksWithStats = tasks.map(task => {
      const taskObj = task.toObject();
      taskObj.submissionCount = task.submissions.length;
      taskObj.approvedCount = task.submissions.filter(s => s.status === 'approved').length;
      return taskObj;
    });

    res.status(200).json({ success: true, tasks: tasksWithStats, data: tasksWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Submit student solution with file uploads
// @route   PUT /api/tasks/:id/submit
// @access  Private (Student)
router.put('/:id/submit', verifyToken, verifyStudent, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]), async (req, res) => {
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
        imagePath = '/uploads/' + req.files.image[0].filename;
      }
      if (req.files.document && req.files.document[0]) {
        documentPath = '/uploads/' + req.files.document[0].filename;
      }
    }

    const existingSubIndex = task.submissions.findIndex(
      s => s.studentId.toString() === req.user.id.toString()
    );

    if (existingSubIndex !== -1) {
      task.submissions[existingSubIndex].solutionText = solutionText;
      task.submissions[existingSubIndex].githubLink = githubLink || '';
      if (imagePath) task.submissions[existingSubIndex].imagePath = imagePath;
      if (documentPath) task.submissions[existingSubIndex].documentPath = documentPath;
      task.submissions[existingSubIndex].status = 'pending';
      task.submissions[existingSubIndex].rejectionReason = '';
      task.submissions[existingSubIndex].submittedAt = Date.now();
    } else {
      task.submissions.push({
        studentId: req.user.id,
        solutionText,
        githubLink: githubLink || '',
        imagePath,
        documentPath,
        status: 'pending',
        submittedAt: Date.now()
      });
    }

    await task.save();

    // Create Activity Log
    const log = new Log({
      studentId: req.user.id,
      studentName: req.user.name,
      course: req.user.course || 'Unassigned',
      action: 'task_submit',
      details: `Submitted task solution for: "${task.title}"`
    });
    await log.save().catch(err => console.error('Activity logging failed:', err));

    res.status(200).json({ success: true, message: 'Solution submitted successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Approve submission
// @route   PUT /api/tasks/:id/approve
// @access  Private/Admin
router.put('/:id/approve', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Please provide studentId' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const sub = task.submissions.find(s => s.studentId.toString() === studentId.toString());
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    sub.status = 'approved';
    await task.save();

    const studentObj = await Student.findById(studentId);
    if (studentObj) {
      // Create Activity Log
      const log = new Log({
        studentId: studentObj._id,
        studentName: studentObj.name,
        course: studentObj.course || 'Unassigned',
        action: 'task_approved',
        details: `Task submission approved for task: "${task.title}"`
      });
      await log.save().catch(err => console.error('Activity logging failed:', err));
    }

    res.status(200).json({ success: true, message: 'Submission approved successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Reject submission
// @route   PUT /api/tasks/:id/reject
// @access  Private/Admin
router.put('/:id/reject', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId, reason } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Please provide studentId' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const sub = task.submissions.find(s => s.studentId.toString() === studentId.toString());
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    sub.status = 'rejected';
    sub.rejectionReason = reason || 'No feedback reason provided';
    await task.save();

    const studentObj = await Student.findById(studentId);
    if (studentObj) {
      // Create Activity Log
      const log = new Log({
        studentId: studentObj._id,
        studentName: studentObj.name,
        course: studentObj.course || 'Unassigned',
        action: 'task_rejected',
        details: `Task submission rejected for task: "${task.title}" - Reason: ${reason || ''}`
      });
      await log.save().catch(err => console.error('Activity logging failed:', err));
    }

    res.status(200).json({ success: true, message: 'Submission rejected successfully', task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Review submission (combined approve/reject with feedback)
// @route   PUT /api/tasks/:id/review
// @access  Private/Admin
router.put('/:id/review', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId, status, adminFeedback } = req.body;
    if (!studentId || !status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide valid studentId, status (approved/rejected)' });
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
    await task.save();

    const studentObj = await Student.findById(studentId);
    if (studentObj) {
      // Create Activity Log
      const log = new Log({
        studentId: studentObj._id,
        studentName: studentObj.name,
        course: studentObj.course || 'Unassigned',
        action: status === 'approved' ? 'task_approved' : 'task_rejected',
        details: status === 'approved' 
          ? `Task submission approved: "${task.title}"` 
          : `Task submission rejected: "${task.title}" - Feedback: ${adminFeedback || ''}`
      });
      await log.save().catch(err => console.error('Activity logging failed:', err));
    }

    res.status(200).json({ success: true, message: `Submission reviewed successfully as ${status}`, task, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private/Admin
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
