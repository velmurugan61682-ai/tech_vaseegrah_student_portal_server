const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  rollNumber: { type: String, unique: true, sparse: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  profileImage: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
schema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
module.exports = mongoose.model('Student', schema);
