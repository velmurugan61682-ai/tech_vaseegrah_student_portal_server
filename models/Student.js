const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  college: { type: String, default: '' },
  department: { type: String, default: '' },
  branch: { type: String, default: '' },
  course: { type: String, default: '' },
  batch: { type: String, default: '' },
  internshipDuration: { type: String, default: '' }, // e.g. "3 Months"
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  attendancePercentage: { type: Number, default: 100 },
  taskCompletionPercentage: { type: Number, default: 0 },
  profilePhoto: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'At Risk', 'Inactive'], default: 'Active' },
  role: { type: String, default: 'student' }
}, { timestamps: true });

studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model('Student', studentSchema);
