const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Log = require('../models/Log');
const User = require('../models/User');
const { logActivity } = require('../services/activityLogService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Admin register
// @route   POST /api/auth/admin/register
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Body Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name is required and must be a valid string.' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password is required and must be at least 6 characters long.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    const admin = new Admin({ name, email: email.toLowerCase(), password, phone });
    await admin.save();
    
    // Sync to User collection with aligned ID
    const userCred = new User({
      _id: admin._id,
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin'
    });
    await userCred.save();
    
    const token = generateToken(admin._id);
    res.status(201).json({
      success: true,
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin login
// @route   POST /api/auth/admin/login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Admin Login Request received for: ${email}`);
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      console.log(`❌ Admin not found for email: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, admin.password);
    console.log(`📊 Password comparison result for admin ${email}: ${isMatch}`);
    if (!isMatch) {
      console.log(`❌ Incorrect password for admin: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = generateToken(admin._id);
    
    await logActivity({
      userId: admin._id,
      userName: admin.name,
      role: 'admin',
      module: 'Authentication',
      action: 'login',
      description: `${admin.name} logged in as Admin`,
      io: req.io
    });

    res.status(200).json({
      success: true,
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student register
// @route   POST /api/auth/student/register
exports.registerStudent = async (req, res) => {
  try {
    const { name, email, password, phone, college, department, branch, course, batch, internshipDuration, startDate, endDate } = req.body;

    // Body Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name is required and must be a valid string.' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password is required and must be at least 6 characters long.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const student = new Student({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      college,
      department: department || '',
      branch: branch || '',
      course: course || '',
      batch: batch || '',
      internshipDuration: internshipDuration || '',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: 'Active',
      role: 'student'
    });
    await student.save();

    // Sync to User collection with aligned ID
    const userCred = new User({
      _id: student._id,
      name,
      email: email.toLowerCase(),
      password,
      role: 'student'
    });
    await userCred.save();

    const token = generateToken(student._id);

    // Track total students count increments
    const Branch = require('../models/Branch');
    const Course = require('../models/Course');
    const Batch = require('../models/Batch');
    if (branch) await Branch.findOneAndUpdate({ branchName: branch }, { $inc: { totalStudents: 1 } });
    if (course) await Course.findOneAndUpdate({ courseName: course }, { $inc: { totalStudents: 1 } });
    if (batch) await Batch.findOneAndUpdate({ batchName: batch }, { $inc: { totalStudents: 1 } });

    // Send live socket notification to Admins
    if (req.io) {
      req.io.emit('student_registered', {
        studentId: student._id,
        name: student.name,
        course: student.course,
        branch: student.branch,
        batch: student.batch
      });
    }

    await logActivity({
      userId: student._id,
      userName: student.name,
      role: 'student',
      module: 'Students',
      action: 'student_added',
      description: `Student "${student.name}" registered`,
      io: req.io
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: 'student',
        phone: student.phone,
        college: student.college,
        department: student.department,
        branch: student.branch,
        batch: student.batch,
        course: student.course,
        internshipDuration: student.internshipDuration,
        startDate: student.startDate,
        endDate: student.endDate,
        status: student.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student login
// @route   POST /api/auth/student/login
exports.loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Student Login Request received for: ${email}`);
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const student = await Student.findOne({ email: email.toLowerCase() });
    if (!student) {
      console.log(`❌ Student not found for email: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, student.password);
    console.log(`📊 Password comparison result for student ${email}: ${isMatch}`);
    if (!isMatch) {
      console.log(`❌ Incorrect password for student: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(student._id);
    
    await logActivity({
      userId: student._id,
      userName: student.name,
      role: 'student',
      module: 'Authentication',
      action: 'login',
      description: `${student.name} logged in successfully`,
      io: req.io
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: 'student',
        phone: student.phone,
        college: student.college,
        department: student.department,
        branch: student.branch,
        batch: student.batch,
        course: student.course,
        internshipDuration: student.internshipDuration,
        startDate: student.startDate,
        endDate: student.endDate,
        status: student.status,
        profilePhoto: student.profilePhoto
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
exports.logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// @desc    Get current user profile
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    let user = await Admin.findById(req.user.id).select('-password');
    if (!user) {
      user = await Student.findById(req.user.id).select('-password');
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const userObj = user.toObject();
    userObj.id = user._id; // Map id explicitly for frontend compatibility
    res.status(200).json({ success: true, user: userObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change User Password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    let user = await Admin.findById(req.user.id);
    if (!user) {
      user = await Student.findById(req.user.id);
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = newPassword; // pre-save will hash
    await user.save();

    // Sync to User collection
    const User = require('../models/User');
    const userCred = await User.findById(user._id);
    if (userCred) {
      userCred.password = newPassword;
      await userCred.save();
    }

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
