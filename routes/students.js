const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const path = require('path');
const Student = require('../models/Student');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { uploadImage } = require('../config/cloudinary');

// @desc    Get all students with filter and search
// @route   GET /api/students
// @access  Private/Admin
router.get('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { department, batch, search } = req.query;
  const filter = {};

  if (department) {
    filter.department = department;
  }
  if (batch) {
    filter.batch = batch;
  }
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const students = await Student.find(filter)
    .populate('department')
    .populate('batch')
    .sort({ name: 1 });

  res.status(200).json({ success: true, data: students });
}));

// @desc    Get student by ID
// @route   GET /api/students/:id
// @access  Private
router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  // Allow if admin or student themselves
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }

  const student = await Student.findById(req.params.id)
    .populate('department')
    .populate('batch');

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  res.status(200).json({ success: true, data: student });
}));

// @desc    Create student
// @route   POST /api/students
// @access  Private/Admin
router.post('/', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { name, email, password, rollNumber, department, batch } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
  }

  const existingStudent = await Student.findOne({ email: email.toLowerCase() });
  if (existingStudent) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const student = new Student({
    name,
    email: email.toLowerCase(),
    password,
    rollNumber,
    department: department || null,
    batch: batch || null,
    isActive: true
  });

  await student.save();
  await student.populate('department');
  await student.populate('batch');

  res.status(201).json({ success: true, data: student });
}));

// @desc    Update student (profile and image)
// @route   PUT /api/students/:id
// @access  Private
router.put('/:id', verifyToken, uploadImage.single('profileImage'), asyncHandler(async (req, res) => {
  // Allow if admin or student themselves
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ success: false, message: 'Unauthorized access' });
  }

  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const { name, email, rollNumber, department, batch, isActive } = req.body;

  // Only Admin can change email, department, batch, isActive
  if (req.user.role === 'admin') {
    if (email) student.email = email.toLowerCase();
    if (department !== undefined) student.department = department || null;
    if (batch !== undefined) student.batch = batch || null;
    if (isActive !== undefined) student.isActive = isActive;
  }

  if (name) student.name = name;
  if (rollNumber) student.rollNumber = rollNumber;

  // Handle uploaded profile image
  if (req.file) {
    let imagePath = req.file.path;
    // Fallback URL formatting if it's a local file path
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
      const filename = path.basename(imagePath);
      imagePath = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    }
    student.profileImage = imagePath;
  }

  await student.save();
  await student.populate('department');
  await student.populate('batch');

  res.status(200).json({ success: true, data: student });
}));

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
router.delete('/:id', verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  await Student.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Student deleted successfully' });
}));

module.exports = router;
