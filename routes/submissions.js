const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const path = require('path');
const TaskSubmission = require('../models/TaskSubmission');
const { verifyToken, isAdmin, isStudent } = require('../middleware/auth');
const { uploadAny } = require('../config/cloudinary');

// @desc    Submit task solution (student)
// @route   POST /api/submissions
// @access  Private/Student
router.post('/', 
  verifyToken, 
  isStudent, 
  uploadAny.fields([{ name: 'solutionImage', maxCount: 1 }, { name: 'solutionDocument', maxCount: 1 }]), 
  asyncHandler(async (req, res) => {
    const { task, solutionText, solutionLink } = req.body;
    const student = req.user.id;

    if (!task) {
      return res.status(400).json({ success: false, message: 'Please provide task ID' });
    }

    let submission = await TaskSubmission.findOne({ task, student });

    const updateData = {
      solutionText,
      solutionLink,
      status: 'pending',
      viewedByAdmin: false,
      submittedAt: Date.now()
    };

    if (req.files) {
      if (req.files.solutionImage && req.files.solutionImage[0]) {
        const imgPath = req.files.solutionImage[0].path;
        updateData.solutionImage = imgPath.startsWith('http')
          ? imgPath
          : `${req.protocol}://${req.get('host')}/uploads/${path.basename(imgPath)}`;
      }
      if (req.files.solutionDocument && req.files.solutionDocument[0]) {
        const docPath = req.files.solutionDocument[0].path;
        updateData.solutionDocument = docPath.startsWith('http')
          ? docPath
          : `${req.protocol}://${req.get('host')}/uploads/${path.basename(docPath)}`;
      }
    }

    if (submission) {
      // Update existing
      Object.assign(submission, updateData);
      await submission.save();
    } else {
      // Create new
      submission = new TaskSubmission({
        task,
        student,
        ...updateData
      });
      await submission.save();
    }

    const Student = require('../models/Student');
    const studentObj = await Student.findById(student);
    if (studentObj) {
      const Log = require('../models/Log');
      const log = new Log({
        studentId: studentObj._id,
        studentName: studentObj.name,
        course: studentObj.course || '',
        action: 'task_submit',
        details: `Submitted task solution`
      });
      await log.save().catch(err => console.error('Failed to save activity log:', err));
    }

    res.status(200).json({ success: true, data: submission });
  })
);

// @desc    Get all submissions (admin)
// @route   GET /api/submissions
// @access  Private/Admin
router.get('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { task, student, status } = req.query;
  const filter = {};

  if (task) filter.task = task;
  if (student) filter.student = student;
  if (status) filter.status = status;

  const submissions = await TaskSubmission.find(filter)
    .populate('task')
    .populate({
      path: 'student',
      populate: [
        { path: 'department' },
        { path: 'batch' }
      ]
    })
    .sort({ submittedAt: -1 });

  res.status(200).json({ success: true, data: submissions });
}));

// @desc    Get submissions by student ID
// @route   GET /api/submissions/student/:studentId
// @access  Private
router.get('/student/:studentId', verifyToken, asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  
  // Verify ownership or admin role
  if (req.user.role !== 'admin' && req.user.id !== studentId) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }

  const submissions = await TaskSubmission.find({ student: studentId })
    .populate('task')
    .sort({ submittedAt: -1 });

  res.status(200).json({ success: true, data: submissions });
}));

// @desc    Approve submission
// @route   PUT /api/submissions/:id/approve
// @access  Private/Admin
router.put('/:id/approve', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const submission = await TaskSubmission.findById(req.params.id).populate('student');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  submission.status = 'approved';
  submission.viewedByAdmin = true;
  await submission.save();

  if (submission.student) {
    const Log = require('../models/Log');
    const log = new Log({
      studentId: submission.student._id,
      studentName: submission.student.name,
      course: submission.student.course || '',
      action: 'task_approved',
      details: 'Submission approved by admin'
    });
    await log.save().catch(err => console.error('Failed to save activity log:', err));
  }

  res.status(200).json({ success: true, data: submission, message: 'Submission approved successfully' });
}));

// @desc    Reject submission
// @route   PUT /api/submissions/:id/reject
// @access  Private/Admin
router.put('/:id/reject', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { adminNote } = req.body;
  const submission = await TaskSubmission.findById(req.params.id).populate('student');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  submission.status = 'rejected';
  submission.adminNote = adminNote || '';
  submission.viewedByAdmin = true;
  await submission.save();

  if (submission.student) {
    const Log = require('../models/Log');
    const log = new Log({
      studentId: submission.student._id,
      studentName: submission.student.name,
      course: submission.student.course || '',
      action: 'task_rejected',
      details: `Submission rejected by admin: ${adminNote || ''}`
    });
    await log.save().catch(err => console.error('Failed to save activity log:', err));
  }

  res.status(200).json({ success: true, data: submission, message: 'Submission rejected successfully' });
}));

// @desc    Review submission (approve/reject with feedback)
// @route   PUT /api/submissions/:id/review
// @access  Private/Admin
router.put('/:id/review', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { status, adminFeedback } = req.body;
  
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Please provide valid status (approved or rejected)' });
  }

  const submission = await TaskSubmission.findById(req.params.id).populate('student');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  submission.status = status;
  submission.adminFeedback = adminFeedback || '';
  submission.adminNote = adminFeedback || '';
  submission.viewedByAdmin = true;
  await submission.save();

  if (submission.student) {
    const Log = require('../models/Log');
    const log = new Log({
      studentId: submission.student._id,
      studentName: submission.student.name,
      course: submission.student.course || '',
      action: status === 'approved' ? 'task_approved' : 'task_rejected',
      details: status === 'approved' ? 'Submission approved by admin' : `Submission rejected by admin: ${adminFeedback || ''}`
    });
    await log.save().catch(err => console.error('Failed to save activity log:', err));
  }

  res.status(200).json({ success: true, data: submission, message: `Submission reviewed successfully as ${status}` });
}));

// @desc    Grade submission marks
// @route   PUT /api/submissions/:id/mark
// @access  Private/Admin
router.put('/:id/mark', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { adminMark } = req.body;
  
  if (adminMark === undefined || adminMark === null || adminMark < 0 || adminMark > 100) {
    return res.status(400).json({ success: false, message: 'Admin mark must be between 0 and 100' });
  }

  const submission = await TaskSubmission.findById(req.params.id);
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  submission.adminMark = Number(adminMark);
  await submission.save();

  res.status(200).json({ success: true, data: submission, message: 'Submission graded successfully' });
}));

// @desc    Mark submission as viewed
// @route   PUT /api/submissions/:id/viewed
// @access  Private/Admin
router.put('/:id/viewed', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const submission = await TaskSubmission.findById(req.params.id);
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  submission.viewedByAdmin = true;
  await submission.save();

  res.status(200).json({ success: true, data: submission });
}));

module.exports = router;
