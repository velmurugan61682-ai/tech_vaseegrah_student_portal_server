const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' }, // optional legacy ref
  studentName: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  internshipTitle: { type: String, default: '' },
  amount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  paymentMode: { type: String, required: true },
  paymentType: { type: String, default: '' },
  paymentMethod: { type: String, default: '' },
  transactionReference: { type: String, default: '' },
  transactionId: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Paid', 'Failed', 'Refunded'], 
    default: 'Pending' 
  },
  remarks: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

paymentSchema.pre('save', function(next) {
  // Map incoming states for compatibility
  if (this.status === 'Paid') {
    this.status = 'Approved';
  } else if (this.status === 'Failed' || this.status === 'Refunded') {
    this.status = 'Rejected';
  }

  // Sync amount & finalAmount
  if (this.amount && !this.finalAmount) {
    this.finalAmount = this.amount - (this.discount || 0);
  } else if (this.finalAmount && !this.amount) {
    this.amount = this.finalAmount + (this.discount || 0);
  }

  // Sync paymentMode with type and method
  if (this.paymentMode) {
    this.paymentMethod = this.paymentMode;
    this.paymentType = (this.paymentMode === 'Cash' || this.paymentMode === 'Bank Transfer') 
      ? 'Offline Payment' 
      : 'Online Payment';
  } else if (this.paymentMethod) {
    this.paymentMode = this.paymentMethod;
    this.paymentType = this.paymentType || ((this.paymentMethod === 'Cash' || this.paymentMethod === 'Bank Transfer') 
      ? 'Offline Payment' 
      : 'Online Payment');
  }

  // Sync transactionReference & transactionId
  if (this.transactionReference && !this.transactionId) {
    this.transactionId = this.transactionReference;
  } else if (this.transactionId && !this.transactionReference) {
    this.transactionReference = this.transactionId;
  }

  // Sync remarks & notes
  if (this.remarks && !this.notes) {
    this.notes = this.remarks;
  } else if (this.notes && !this.remarks) {
    this.remarks = this.notes;
  }

  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
