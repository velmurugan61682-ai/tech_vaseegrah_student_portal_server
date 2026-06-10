const Receipt = require('../models/Receipt');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const PaymentLog = require('../models/PaymentLog');
const Admin = require('../models/Admin');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const path = require('path');
const fs = require('fs');

// Helper to auto-generate unique receipt number
const generateReceiptNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const count = await Receipt.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  return `REC-TV-${dateStr}-${sequence}`;
};

// @desc    Get all receipts with filtering
// @route   GET /api/receipts
// @access  Private/Admin
exports.getReceipts = async (req, res) => {
  try {
    const { course, status, search } = req.query;
    let query = {};

    if (status) {
      query.paymentStatus = status;
    }

    if (course) {
      query.courseName = { $regex: new RegExp(course, 'i') };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { studentName: searchRegex },
        { email: searchRegex },
        { receiptNumber: searchRegex },
        { transactionId: searchRegex }
      ];
    }

    const receipts = await Receipt.find(query)
      .populate('studentId', 'name email branch batch')
      .populate('paymentId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: receipts.length,
      data: receipts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get student's own receipts
// @route   GET /api/receipts/student
// @access  Private/Student
exports.getStudentReceipts = async (req, res) => {
  try {
    const studentId = req.user.id;
    const receipts = await Receipt.find({ studentId }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: receipts.length,
      data: receipts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single receipt details
// @route   GET /api/receipts/:id
// @access  Private
exports.getReceiptDetails = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate('emailHistory.adminId', 'name email');
    
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }
    
    res.status(200).json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update receipt details (amount, status, notes)
// @route   PUT /api/receipts/:id
// @access  Private/Admin
exports.updateReceipt = async (req, res) => {
  try {
    const { amountPaid, balanceDue, paymentStatus, notes } = req.body;
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const oldValue = receipt.toObject();
    const admin = await Admin.findById(req.user.id);
    const adminName = admin ? admin.name : 'System Admin';

    // Track alterations
    const changes = [];
    if (amountPaid !== undefined && amountPaid !== receipt.amountPaid) {
      changes.push({ field: 'amountPaid', old: receipt.amountPaid, new: amountPaid });
      receipt.amountPaid = amountPaid;
    }
    if (balanceDue !== undefined && balanceDue !== receipt.balanceDue) {
      changes.push({ field: 'balanceDue', old: receipt.balanceDue, new: balanceDue });
      receipt.balanceDue = balanceDue;
    }
    if (paymentStatus !== undefined && paymentStatus !== receipt.paymentStatus) {
      changes.push({ field: 'paymentStatus', old: receipt.paymentStatus, new: paymentStatus });
      receipt.paymentStatus = paymentStatus;
    }
    if (notes !== undefined && notes !== receipt.notes) {
      receipt.notes = notes;
    }

    if (changes.length > 0) {
      // Regenerate the PDF with updated values
      const pdfRelativePath = await pdfService.generatePDF(receipt);
      receipt.pdfPath = pdfRelativePath;
      await receipt.save();

      // Log in audit trails
      for (const change of changes) {
        const audit = new PaymentLog({
          adminId: req.user.id,
          adminName,
          action: change.field === 'amountPaid' ? 'Amount Changed' : 'Status Updated',
          oldValue: { [change.field]: change.old },
          newValue: { [change.field]: change.new },
          paymentId: receipt.paymentId
        });
        await audit.save();
      }
    } else {
      await receipt.save();
    }

    res.status(200).json({
      success: true,
      message: 'Receipt details updated successfully',
      data: receipt
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete receipt
// @route   DELETE /api/receipts/:id
// @access  Private/Admin
exports.deleteReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Remove file if exists
    if (receipt.pdfPath) {
      const fullPath = path.join(__dirname, '..', receipt.pdfPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    const oldValue = receipt.toObject();
    await Receipt.findByIdAndDelete(req.params.id);

    // Audit log deletion
    const admin = await Admin.findById(req.user.id);
    const audit = new PaymentLog({
      adminId: req.user.id,
      adminName: admin ? admin.name : 'System Admin',
      action: 'Receipt Deleted',
      oldValue,
      newValue: null,
      paymentId: receipt.paymentId
    });
    await audit.save();

    res.status(200).json({
      success: true,
      message: 'Receipt deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate PDF Receipt file
// @route   POST /api/receipts/:id/pdf
// @access  Private
exports.generateReceiptPDF = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const relativePath = await pdfService.generatePDF(receipt);
    receipt.pdfPath = relativePath;
    await receipt.save();

    res.status(200).json({
      success: true,
      message: 'PDF compiled successfully',
      pdfPath: relativePath
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send receipt email to student
// @route   POST /api/receipts/:id/send
// @access  Private/Admin
exports.sendReceiptEmail = async (req, res) => {
  try {
    const { subject, customMessage } = req.body;
    if (!subject || !customMessage) {
      return res.status(400).json({ success: false, message: 'Please provide subject and message body' });
    }

    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Make sure PDF is generated
    const pdfPathRelative = await pdfService.generatePDF(receipt);
    receipt.pdfPath = pdfPathRelative;
    
    const absolutePdfPath = path.join(__dirname, '..', pdfPathRelative);

    // Replace template tags
    const emailBody = customMessage
      .replace(/\{\{studentName\}\}/g, receipt.studentName)
      .replace(/\{\{receiptNumber\}\}/g, receipt.receiptNumber)
      .replace(/\{\{courseName\}\}/g, receipt.courseName)
      .replace(/\{\{amount\}\}/g, `₹${receipt.amountPaid.toLocaleString()}`)
      .replace(/\{\{paymentMethod\}\}/g, receipt.paymentMethod);

    // Send email with attachment
    const emailResult = await emailService.sendEmailWithAttachment({
      to: receipt.email,
      subject,
      html: emailBody,
      attachmentPath: absolutePdfPath,
      filename: `${receipt.receiptNumber}.pdf`
    });

    receipt.emailSent = true;
    receipt.emailHistory.push({
      sentAt: new Date(),
      subject,
      content: customMessage,
      adminId: req.user.id
    });
    await receipt.save();

    // Log in audit logs
    const admin = await Admin.findById(req.user.id);
    const audit = new PaymentLog({
      adminId: req.user.id,
      adminName: admin ? admin.name : 'System Admin',
      action: 'Receipt Emailed',
      newValue: { subject, sentAt: new Date() },
      paymentId: receipt.paymentId
    });
    await audit.save();

    res.status(200).json({
      success: true,
      message: 'Receipt email sent successfully',
      previewUrl: emailResult.previewUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Email sending failed: ' + error.message });
  }
};

// Internal helper to trigger automatic receipt creation
exports.createReceiptFromPayment = async (payment) => {
  try {
    const student = await Student.findById(payment.studentId);
    
    // Check if receipt already exists for this payment
    let receipt = await Receipt.findOne({ paymentId: payment._id });
    
    const baseAmount = payment.amount || 0;
    const discount = payment.discount || 0;
    const finalAmount = payment.finalAmount || 0;
    const balanceDue = Math.max(0, baseAmount - discount - finalAmount);

    if (receipt) {
      // Update existing receipt details
      receipt.amountPaid = payment.finalAmount;
      receipt.balanceDue = balanceDue;
      receipt.paymentMethod = payment.paymentMethod;
      receipt.paymentStatus = payment.status;
      receipt.transactionId = payment.transactionId;
      receipt.paymentDate = payment.paymentDate;
      receipt.notes = payment.notes || '';
    } else {
      // Auto-generate receipt number
      const receiptNumber = await generateReceiptNumber();

      receipt = new Receipt({
        receiptNumber,
        paymentId: payment._id,
        studentId: payment.studentId,
        studentName: payment.studentName,
        email: payment.email,
        phone: payment.phone || student?.phone || '',
        courseName: payment.internshipTitle,
        amountPaid: payment.finalAmount,
        balanceDue,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.status,
        transactionId: payment.transactionId,
        paymentDate: payment.paymentDate,
        notes: payment.notes || ''
      });
    }

    // Compile PDF receipt automatically
    const pdfRelativePath = await pdfService.generatePDF(receipt);
    receipt.pdfPath = pdfRelativePath;
    await receipt.save();

    console.log(`✅ Automatic receipt synced: ${receipt.receiptNumber}`);
    return receipt;
  } catch (error) {
    console.error('❌ Automatic receipt generation failed:', error);
  }
};
