const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// General endpoints
router.get('/', protect, authorize('admin'), getAllStudents);
router.get('/:id', protect, getStudent);
router.put('/:id', protect, updateStudent);
router.delete('/:id', protect, authorize('admin'), deleteStudent);

module.exports = router;
