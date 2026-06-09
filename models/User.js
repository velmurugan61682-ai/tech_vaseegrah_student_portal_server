const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false // Exclude password from query results by default
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number']
  },
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student'
  },
  college: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  branch: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  course: {
    type: String,
    enum: ['Java', 'Python', 'MERN Stack', 'AI & ML'],
    required: function() { return this.role === 'student'; }
  },
  batch: {
    type: String,
    required: function() { return this.role === 'student'; }
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
