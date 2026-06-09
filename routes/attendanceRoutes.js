const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getTodayAttendance,
  getStudentAttendanceHistory,
  getAttendanceReport
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/mark', protect, authorize('student'), markAttendance);
router.get('/today', protect, authorize('admin'), getTodayAttendance);
router.get('/student/:id', protect, getStudentAttendanceHistory);
router.get('/report', protect, authorize('admin'), getAttendanceReport);

module.exports = router;
