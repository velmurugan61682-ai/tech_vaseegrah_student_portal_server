const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  adminName: { type: String, required: true },
  action: { type: String, required: true }, // e.g. "Amount Changed", "Payment Approved", "Payment Deleted", "Status Updated"
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentLog', paymentLogSchema, 'payment_logs');
