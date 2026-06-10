const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  duration: { type: String, default: '3 Months' },
  price: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Internship', internshipSchema);
