const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, verifyAdmin, verifyStudent } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

// Student profile endpoints
router.get('/profile', verifyToken, verifyStudent, studentController.getStudentProfile);
router.put('/profile', verifyToken, verifyStudent, uploadImage.single('profilePhoto'), studentController.updateStudentProfile);

// Legacy compat route for student dashboard metrics
router.get('/dashboard', verifyToken, verifyStudent, studentController.getStudentDashboard);

// Admin student directory endpoints (REST /api/students)
router.get('/', verifyToken, verifyAdmin, studentController.getStudentsDirectory);
router.post('/', verifyToken, verifyAdmin, uploadImage.single('profilePhoto'), studentController.addStudent);
router.put('/:id', verifyToken, verifyAdmin, uploadImage.single('profilePhoto'), studentController.updateStudent);
router.delete('/:id', verifyToken, verifyAdmin, studentController.deleteStudent);

module.exports = router;
