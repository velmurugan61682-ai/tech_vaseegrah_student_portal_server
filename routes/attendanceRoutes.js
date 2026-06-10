const express = require('express');
const router = Router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

router.get('/all', verifyToken, verifyAdmin, attendanceController.getAllAttendance);
router.put('/update', verifyToken, verifyAdmin, attendanceController.updateAttendance);
router.post('/mark', verifyToken, attendanceController.markAttendance);
router.get('/my', verifyToken, attendanceController.getMyAttendance);
router.get('/report', verifyToken, verifyAdmin, attendanceController.getAttendanceReport);
router.get('/student/:studentId', verifyToken, attendanceController.getStudentAttendance);
router.get('/export', verifyToken, verifyAdmin, attendanceController.exportAttendanceCSV);

module.exports = router;
