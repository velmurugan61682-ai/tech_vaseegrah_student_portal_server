const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask
} = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('admin'), createTask);
router.get('/', protect, getTasks);
router.put('/:id', protect, authorize('admin'), updateTask);
router.delete('/:id', protect, authorize('admin'), deleteTask);

module.exports = router;
