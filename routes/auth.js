const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Department = require('../models/Department');
const Batch = require('../models/Batch');
const { verifyToken } = require('../middleware/auth');

// Sign JWT helper
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
router.post('/admin/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = generateToken({ id: admin._id, name: admin.name, email: admin.email, role: 'admin' });
  
  res.status(200).json({
    success: true,
    token,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: 'admin'
    }
  });
}));

// @desc    Student login
// @route   POST /api/auth/student/login
// @access  Public
router.post('/student/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  const student = await Student.findOne({ email: email.toLowerCase(), isActive: true })
    .populate('department')
    .populate('batch');

  if (!student) {
    return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account' });
  }

  const isMatch = await bcrypt.compare(password, student.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = generateToken({ id: student._id, name: student.name, email: student.email, role: 'student' });

  // Map student object to include id field
  const userObj = {
    id: student._id,
    _id: student._id,
    name: student.name,
    email: student.email,
    role: 'student',
    rollNumber: student.rollNumber,
    department: student.department,
    batch: student.batch,
    profileImage: student.profileImage || student.profilePhoto,
    profilePhoto: student.profilePhoto || student.profileImage,
    phone: student.phone,
    college: student.college,
    course: student.course
  };

  const Log = require('../models/Log');
  const log = new Log({
    studentId: student._id,
    studentName: student.name,
    course: student.course || '',
    action: 'login',
    details: `${student.name} logged in`
  });
  await log.save().catch(err => console.error('Failed to save activity log:', err));

  res.status(200).json({
    success: true,
    token,
    user: userObj
  });
}));

// @desc    Student register
// @route   POST /api/auth/student/register
// @access  Public
router.post('/student/register', asyncHandler(async (req, res) => {
  const { name, email, password, rollNumber, department, branch, batch, phone, college, course } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please fill in name, email and password' });
  }

  const existingStudent = await Student.findOne({ email: email.toLowerCase() });
  if (existingStudent) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  let deptId = null;
  let batchId = null;

  // Resolve Department
  const deptQuery = department || branch;
  if (deptQuery) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(deptQuery)) {
      deptId = deptQuery;
    } else {
      let dept = await Department.findOne({
        $or: [
          { code: deptQuery.trim().toUpperCase() },
          { name: { $regex: new RegExp('^' + deptQuery.trim() + '$', 'i') } }
        ]
      });
      if (!dept) {
        dept = new Department({
          name: deptQuery.trim(),
          code: deptQuery.trim().toUpperCase()
        });
        await dept.save();
      }
      deptId = dept._id;
    }
  }

  // Resolve Batch
  if (batch) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(batch)) {
      batchId = batch;
    } else if (deptId) {
      let batchDoc = await Batch.findOne({
        name: batch.trim(),
        department: deptId
      });
      if (!batchDoc) {
        let yearVal = parseInt(batch) || new Date().getFullYear();
        batchDoc = new Batch({
          name: batch.trim(),
          year: yearVal,
          department: deptId
        });
        await batchDoc.save();
      }
      batchId = batchDoc._id;
    }
  }

  const student = new Student({
    name,
    email: email.toLowerCase(),
    password,
    rollNumber,
    department: deptId,
    batch: batchId,
    phone: phone || '',
    college: college || '',
    course: course || '',
    isActive: true
  });

  await student.save();

  // Populate references
  await student.populate('department');
  await student.populate('batch');

  const token = generateToken({ id: student._id, name: student.name, email: student.email, role: 'student' });

  const userObj = {
    id: student._id,
    _id: student._id,
    name: student.name,
    email: student.email,
    role: 'student',
    rollNumber: student.rollNumber,
    department: student.department,
    batch: student.batch,
    profileImage: student.profileImage || student.profilePhoto,
    profilePhoto: student.profilePhoto || student.profileImage,
    phone: student.phone,
    college: student.college,
    course: student.course
  };

  res.status(201).json({
    success: true,
    token,
    user: userObj
  });
}));

// @desc    Admin seed script endpoint
// @route   POST /api/auth/admin/seed
// @access  Public
router.post('/admin/seed', asyncHandler(async (req, res) => {
  const seedEmail = 'admin@techvaseegrah.com';
  let admin = await Admin.findOne({ email: seedEmail });
  
  if (!admin) {
    admin = new Admin({
      name: 'Super Admin',
      email: seedEmail,
      password: 'Admin@123',
      role: 'admin'
    });
    await admin.save();
  }

  // Create sample departments if they don't exist
  const sampleDepts = [
    { name: 'Computer Science and Engineering', code: 'CSE' },
    { name: 'Electronics and Communication Engineering', code: 'ECE' },
    { name: 'Mechanical Engineering', code: 'MECH' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Artificial Intelligence and Data Science', code: 'AIDS' }
  ];

  for (const dept of sampleDepts) {
    const existing = await Department.findOne({ code: dept.code });
    if (!existing) {
      const newDept = new Department(dept);
      await newDept.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'Seeded successfully',
    credentials: {
      email: seedEmail,
      password: 'Admin@123'
    }
  });
}));

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', verifyToken, asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    return res.status(200).json({
      success: true,
      user: {
        id: admin._id,
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
      }
    });
  } else {
    const student = await Student.findById(req.user.id)
      .populate('department')
      .populate('batch');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    return res.status(200).json({
      success: true,
      user: {
        id: student._id,
        _id: student._id,
        name: student.name,
        email: student.email,
        role: 'student',
        rollNumber: student.rollNumber,
        department: student.department,
        batch: student.batch,
        profileImage: student.profileImage || student.profilePhoto,
        profilePhoto: student.profilePhoto || student.profileImage,
        phone: student.phone,
        college: student.college,
        course: student.course
      }
    });
  }
}));

// @desc    Admin register
// @route   POST /api/auth/admin/register
// @access  Public
router.post('/admin/register', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
  }

  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    return res.status(400).json({ success: false, message: 'Email already registered' });
  }

  const admin = new Admin({
    name,
    email: email.toLowerCase(),
    password
  });

  await admin.save();

  const token = generateToken({ id: admin._id, name: admin.name, email: admin.email, role: 'admin' });

  res.status(201).json({
    success: true,
    token,
    user: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: 'admin'
    }
  });
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
router.post('/logout', (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @desc    Logout user (GET fallback)
// @route   GET /api/auth/logout
// @access  Public
router.get('/logout', (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
