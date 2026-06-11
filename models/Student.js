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
  internshipTrack: { type: String, default: '' },
  course: { type: String, default: '' },
  batch: { type: String, default: '' },
  internshipDuration: { type: String, default: '' }, // e.g. "3 Months"
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  attendancePercentage: { type: Number, default: 100 },
  taskPercentage: { type: Number, default: 0 },
  taskCompletionPercentage: { type: Number, default: 0 },
  profileImage: { type: String, default: '' },
  profilePhoto: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'At Risk', 'Inactive'], default: 'Active' },
  role: { type: String, default: 'student' }
}, { timestamps: true });

studentSchema.pre('save', async function(next) {
  // Sync profileImage and profilePhoto
  if (this.profileImage && !this.profilePhoto) {
    this.profilePhoto = this.profileImage;
  } else if (this.profilePhoto && !this.profileImage) {
    this.profileImage = this.profilePhoto;
  }
  
  // Sync internshipTrack and course
  if (this.internshipTrack && !this.course) {
    this.course = this.internshipTrack;
  } else if (this.course && !this.internshipTrack) {
    this.internshipTrack = this.course;
  }

  // Sync taskPercentage and taskCompletionPercentage
  if (this.taskPercentage !== undefined && !this.taskCompletionPercentage) {
    this.taskCompletionPercentage = this.taskPercentage;
  } else if (this.taskCompletionPercentage !== undefined && !this.taskPercentage) {
    this.taskPercentage = this.taskCompletionPercentage;
  }

  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model('Student', studentSchema);
