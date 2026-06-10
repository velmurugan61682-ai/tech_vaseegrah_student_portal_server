const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const { uploadImage } = require('../config/cloudinary');

router.get('/dashboard', verifyToken, verifyAdmin, adminController.getDashboardStats);
router.get('/students', verifyToken, verifyAdmin, adminController.getStudentsDirectory);
router.post('/students', verifyToken, verifyAdmin, uploadImage.single('profilePhoto'), adminController.addStudent);
router.put('/students/:id', verifyToken, verifyAdmin, uploadImage.single('profilePhoto'), adminController.updateStudent);
router.delete('/students/:id', verifyToken, verifyAdmin, adminController.deleteStudent);

module.exports = router;
