const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, verifyStudent } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

router.get('/dashboard', verifyToken, verifyStudent, studentController.getStudentDashboard);
router.get('/profile', verifyToken, verifyStudent, studentController.getStudentProfile);
router.put('/profile', verifyToken, verifyStudent, uploadImage.single('profilePhoto'), studentController.updateStudentProfile);

module.exports = router;
