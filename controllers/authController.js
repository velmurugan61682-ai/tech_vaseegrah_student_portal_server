const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to sign JWT access token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1h' // Set access token expiry to 1 hour
  });
};

// Helper to sign JWT refresh token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });
};

// Send response helper
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Set access token cookie options
  const options = {
    expires: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  // Set refresh token cookie options
  const refreshOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  // Remove password from output
  user.password = undefined;

  res
    .status(statusCode)
    .cookie('token', token, options)
    .cookie('refreshToken', refreshToken, refreshOptions)
    .json({
      success: true,
      token,
      refreshToken,
      user
    });
};

// @desc    Register Student
// @route   POST /api/auth/student/register
// @access  Public
exports.registerStudent = async (req, res) => {
  try {
    const { name, email, password, phone, college, branch, course, batch, profilePhoto } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create user with student role
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'student',
      college,
      branch,
      course,
      batch,
      profilePhoto: profilePhoto || ''
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login Student
// @route   POST /api/auth/student/login
// @access  Public
exports.loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user || user.role !== 'student') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register Admin
// @route   POST /api/auth/admin/register
// @access  Public
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Create user with admin role
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'admin'
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login Admin
// @route   POST /api/auth/admin/login
// @access  Public
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user || user.role !== 'admin') {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Current User Details
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    let token;

    if (req.body.refreshToken) {
      token = req.body.refreshToken;
    } else if (req.cookies && req.cookies.refreshToken) {
      token = req.cookies.refreshToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid token or user inactive' });
    }

    // Issue new access token
    const accessToken = generateToken(user._id);

    // Set cookie
    res.cookie('token', accessToken, {
      expires: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.status(200).json({
      success: true,
      token: accessToken
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: false, message: 'Refresh token invalid' });
  }
};

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.cookie('refreshToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};
