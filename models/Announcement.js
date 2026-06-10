const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  targetAudience: { type: String, default: 'All' }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
