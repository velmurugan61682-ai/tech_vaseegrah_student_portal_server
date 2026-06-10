const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
  studentName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  internshipTitle: { type: String, required: true }, // Cached title for convenience
  amount: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  paymentType: { 
    type: String, 
    enum: ['Online Payment', 'Offline Payment'], 
    required: true 
  },
  paymentMethod: { 
    type: String, 
    enum: ['Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Bank Transfer', 'Cash'], 
    required: true 
  },
  transactionId: { type: String, default: '' },
  paymentDate: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['Paid', 'Pending', 'Failed', 'Refunded'], 
    default: 'Pending' 
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
