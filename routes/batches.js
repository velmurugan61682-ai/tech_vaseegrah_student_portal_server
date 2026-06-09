const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Batch = require('../models/Batch');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @desc    Get all batches with optional department filter
// @route   GET /api/batches
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { department } = req.query;
  const filter = {};
  if (department) {
    filter.department = department;
  }

  const batches = await Batch.find(filter).populate('department');
  res.status(200).json({ success: true, data: batches });
}));

// @desc    Create batch
// @route   POST /api/batches
// @access  Private/Admin
router.post('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { name, year, department } = req.body;
  if (!name || !department) {
    return res.status(400).json({ success: false, message: 'Please provide batch name and department' });
  }

  const batch = new Batch({
    name,
    year,
    department
  });

  await batch.save();
  await batch.populate('department');
  res.status(201).json({ success: true, data: batch });
}));

// @desc    Update batch
// @route   PUT /api/batches/:id
// @access  Private/Admin
router.put('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { name, year, department } = req.body;
  const batch = await Batch.findById(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, message: 'Batch not found' });
  }

  if (name) batch.name = name;
  if (year !== undefined) batch.year = year;
  if (department) batch.department = department;

  await batch.save();
  await batch.populate('department');
  res.status(200).json({ success: true, data: batch });
}));

// @desc    Delete batch
// @route   DELETE /api/batches/:id
// @access  Private/Admin
router.delete('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, message: 'Batch not found' });
  }

  await Batch.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Batch deleted successfully' });
}));

module.exports = router;
