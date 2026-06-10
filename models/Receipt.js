const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  courseName: { type: String, required: true },
  amountPaid: { type: Number, required: true },
  balanceDue: { type: Number, default: 0 },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true },
  transactionId: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
  qrCodeData: { type: String, default: '' },
  pdfPath: { type: String, default: '' },
  emailSent: { type: Boolean, default: false },
  emailHistory: [
    {
      sentAt: { type: Date, default: Date.now },
      subject: { type: String, required: true },
      content: { type: String, required: true },
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
    }
  ],
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);
