const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { verifyToken, verifyAdmin, verifyStudent } = require('../middleware/authMiddleware');

// Student endpoints
router.post('/', verifyToken, verifyStudent, leaveController.applyLeave);
router.get('/student', verifyToken, verifyStudent, leaveController.getStudentLeaves);

// Admin endpoints
router.get('/', verifyToken, verifyAdmin, leaveController.getAllLeaves);
router.put('/:id', verifyToken, verifyAdmin, leaveController.reviewLeave);

module.exports = router;
