const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  amount: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 }, // legacy compatibility
  balanceDue: { type: Number, default: 0 }, // legacy compatibility
  issueDate: { type: Date, default: Date.now },
  emailStatus: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' },
  pdfUrl: { type: String, default: '' },
  
  // Legacy compatibility fields
  studentName: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  courseName: { type: String, default: '' },
  paymentMethod: { type: String, default: '' },
  paymentStatus: { type: String, default: 'Pending' },
  transactionId: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
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

receiptSchema.pre('save', function(next) {
  // Sync amount & amountPaid
  if (this.amount && !this.amountPaid) {
    this.amountPaid = this.amount;
  } else if (this.amountPaid && !this.amount) {
    this.amount = this.amountPaid;
  }

  // Sync issueDate & paymentDate
  if (this.issueDate && !this.paymentDate) {
    this.paymentDate = this.issueDate;
  } else if (this.paymentDate && !this.issueDate) {
    this.issueDate = this.paymentDate;
  }

  // Sync emailStatus & emailSent
  if (this.emailStatus === 'Sent') {
    this.emailSent = true;
  } else if (this.emailSent) {
    this.emailStatus = 'Sent';
  } else if (this.emailStatus === 'Failed') {
    this.emailSent = false;
  }

  // Sync pdfUrl & pdfPath
  if (this.pdfUrl && !this.pdfPath) {
    this.pdfPath = this.pdfUrl;
  } else if (this.pdfPath && !this.pdfUrl) {
    this.pdfUrl = this.pdfPath;
  }

  next();
});

module.exports = mongoose.model('Receipt', receiptSchema);
