const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/admin/register', authController.registerAdmin);
router.post('/admin/login', authController.loginAdmin);
router.post('/student/register', authController.registerStudent);
router.post('/student/login', authController.loginStudent);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.getMe);
router.put('/change-password', verifyToken, authController.changePassword);

module.exports = router;
