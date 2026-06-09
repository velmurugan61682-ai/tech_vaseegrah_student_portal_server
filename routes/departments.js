const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Department = require('../models/Department');
const { verifyToken, isAdmin } = require('../middleware/auth');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const departments = await Department.find({}).sort({ name: 1 });
  res.status(200).json({ success: true, data: departments });
}));

// @desc    Create department
// @route   POST /api/departments
// @access  Private/Admin
router.post('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Please provide department name and code' });
  }

  const existingDept = await Department.findOne({ code: code.toUpperCase() });
  if (existingDept) {
    return res.status(400).json({ success: false, message: 'Department code already exists' });
  }

  const department = new Department({
    name,
    code: code.toUpperCase()
  });

  await department.save();
  res.status(201).json({ success: true, data: department });
}));

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private/Admin
router.put('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { name, code } = req.body;
  const deptId = req.params.id;

  const department = await Department.findById(deptId);
  if (!department) {
    return res.status(404).json({ success: false, message: 'Department not found' });
  }

  if (code) {
    const existing = await Department.findOne({ code: code.toUpperCase(), _id: { $ne: deptId } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Department code already exists' });
    }
    department.code = code.toUpperCase();
  }
  
  if (name) department.name = name;

  await department.save();
  res.status(200).json({ success: true, data: department });
}));

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private/Admin
router.delete('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) {
    return res.status(404).json({ success: false, message: 'Department not found' });
  }

  await Department.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Department deleted successfully' });
}));

module.exports = router;
