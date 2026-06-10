const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check in admin first, then student
    let user = await Admin.findById(decoded.id);
    if (!user) {
      user = await Student.findById(decoded.id);
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized access' });
    }
    
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      course: user.course || ''
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Access denied: Admin role required' });
  }
};

const verifyStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Access denied: Student role required' });
  }
};

module.exports = { verifyToken, verifyAdmin, verifyStudent };
