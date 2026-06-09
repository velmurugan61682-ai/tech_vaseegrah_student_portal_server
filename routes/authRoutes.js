const express = require('express');
const router = express.Router();
const {
  registerStudent,
  loginStudent,
  registerAdmin,
  loginAdmin,
  getMe,
  refreshToken,
  logout
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/student/register', registerStudent);
router.post('/student/login', loginStudent);
router.post('/admin/register', registerAdmin);
router.post('/admin/login', loginAdmin);
router.get('/me', protect, getMe);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);

module.exports = router;
