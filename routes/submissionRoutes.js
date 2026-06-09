const express = require('express');
const router = express.Router();
const {
  submitTask,
  getTaskSubmissions,
  reviewSubmission,
  getStudentSubmissions
} = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('student'), submitTask);
router.get('/task/:taskId', protect, authorize('admin'), getTaskSubmissions);
router.put('/:id/review', protect, authorize('admin'), reviewSubmission);
router.get('/student/:id', protect, getStudentSubmissions);

module.exports = router;
