const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const path = require('path');
const Student = require('../models/Student');
const Department = require('../models/Department');
const Batch = require('../models/Batch');
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
  const { name, email, password, rollNumber, department, branch, batch, phone, college, course } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
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
  await student.populate('department');
  await student.populate('batch');

  res.status(201).json({ success: true, data: student, student: student });
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

  const { name, email, rollNumber, department, branch, batch, isActive, phone, college, course, profilePhoto } = req.body;

  // Only Admin can change email and isActive
  if (req.user.role === 'admin') {
    if (email) student.email = email.toLowerCase();
    if (isActive !== undefined) student.isActive = isActive;
  }

  // Resolve department/branch
  const deptQuery = department !== undefined ? department : branch;
  if (deptQuery !== undefined) {
    if (deptQuery === null || deptQuery === '') {
      student.department = null;
    } else {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(deptQuery)) {
        student.department = deptQuery;
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
        student.department = dept._id;
      }
    }
  }

  // Resolve batch
  if (batch !== undefined) {
    if (batch === null || batch === '') {
      student.batch = null;
    } else {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(batch)) {
        student.batch = batch;
      } else {
        // Resolve batch name for the target department
        const targetDeptId = student.department;
        if (targetDeptId) {
          let batchDoc = await Batch.findOne({
            name: batch.trim(),
            department: targetDeptId
          });
          if (!batchDoc) {
            let yearVal = parseInt(batch) || new Date().getFullYear();
            batchDoc = new Batch({
              name: batch.trim(),
              year: yearVal,
              department: targetDeptId
            });
            await batchDoc.save();
          }
          student.batch = batchDoc._id;
        }
      }
    }
  }

  if (name) student.name = name;
  if (rollNumber) student.rollNumber = rollNumber;
  if (phone !== undefined) student.phone = phone;
  if (college !== undefined) student.college = college;
  if (course !== undefined) student.course = course;

  // Handle base64 profile photo in JSON body
  if (profilePhoto) {
    try {
      const saveBase64Image = async (base64Str, req) => {
        if (!base64Str || !base64Str.startsWith('data:image')) {
          return base64Str;
        }
        const { isCloudinaryConfigured } = require('../config/cloudinary');
        const cloudinary = require('cloudinary').v2;
        if (isCloudinaryConfigured) {
          const uploadRes = await cloudinary.uploader.upload(base64Str, {
            folder: 'tech_vaseegrah/images'
          });
          return uploadRes.secure_url;
        } else {
          const fs = require('fs');
          const path = require('path');
          const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 string');
          }
          const ext = matches[1].split('/')[1] || 'png';
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const uploadDir = path.join(__dirname, '../uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filepath = path.join(uploadDir, filename);
          fs.writeFileSync(filepath, buffer);
          return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
        }
      };

      const imageUrl = await saveBase64Image(profilePhoto, req);
      student.profilePhoto = imageUrl;
      student.profileImage = imageUrl;
    } catch (err) {
      console.error('Error saving base64 profilePhoto:', err);
    }
  }

  // Handle uploaded profile image file (multipart)
  if (req.file) {
    let imagePath = req.file.path;
    // Fallback URL formatting if it's a local file path
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://')) {
      const filename = path.basename(imagePath);
      imagePath = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    }
    student.profileImage = imagePath;
    student.profilePhoto = imagePath;
  }

  await student.save();
  await student.populate('department');
  await student.populate('batch');

  res.status(200).json({ success: true, data: student, student: student });
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
