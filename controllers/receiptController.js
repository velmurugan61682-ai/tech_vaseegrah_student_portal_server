const Receipt = require('../models/Receipt');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const EmailLog = require('../models/EmailLog');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');
const path = require('path');
const fs = require('fs');

// Helper to auto-generate unique receipt number
const generateReceiptNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const count = await Receipt.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  return `REC-IH-${dateStr}-${sequence}`;
};

// Helper to map DB receipt to legacy client expectations
const mapReceipt = (r) => {
  if (!r) return null;
  const obj = r.toObject ? r.toObject() : r;
  
  obj.amountPaid = obj.amount;
  obj.balanceDue = obj.balanceDue || 0;
  obj.pdfPath = obj.pdfUrl || '';
  obj.emailSent = obj.emailStatus === 'Sent';
  obj.paymentDate = obj.issueDate;
  
  if (obj.studentId && typeof obj.studentId === 'object') {
    obj.studentName = obj.studentId.name || obj.studentName || '';
    obj.email = obj.studentId.email || obj.email || '';
    obj.phone = obj.studentId.phone || obj.phone || '';
    obj.courseName = obj.studentId.internshipTrack || obj.studentId.course || obj.courseName || '';
  }
  
  if (obj.paymentId && typeof obj.paymentId === 'object') {
    obj.paymentMethod = obj.paymentId.paymentMode || obj.paymentMethod || '';
    obj.paymentStatus = obj.paymentId.status === 'Approved' ? 'Paid' : 'Pending';
    obj.transactionId = obj.paymentId.transactionReference || obj.transactionId || '';
  }

  return obj;
};

// @desc    Get all receipts with filtering
// @route   GET /api/receipts
// @access  Private/Admin
exports.getReceipts = async (req, res) => {
  try {
    const { course, status, search } = req.query;
    let query = {};

    if (status) {
      // paymentStatus
      let dbStatus = status;
      if (dbStatus === 'Paid') dbStatus = 'Approved';
      if (dbStatus === 'Failed') dbStatus = 'Rejected';
      
      const matchingPayments = await Payment.find({ status: dbStatus }).select('_id');
      query.paymentId = { $in: matchingPayments.map(p => p._id) };
    }

    let studentFilter = {};
    if (course) {
      studentFilter.$or = [
        { internshipTrack: course },
        { course: course }
      ];
    }
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      studentFilter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    if (course || search) {
      const matchingStudents = await Student.find(studentFilter).select('_id');
      query.studentId = { $in: matchingStudents.map(s => s._id) };
    }

    const receipts = await Receipt.find(query)
      .populate('studentId')
      .populate('paymentId')
      .sort({ createdAt: -1 });

    const mappedData = receipts.map(mapReceipt);

    res.status(200).json({
      success: true,
      count: mappedData.length,
      data: mappedData
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
    const receipts = await Receipt.find({ studentId })
      .populate('studentId')
      .populate('paymentId')
      .sort({ createdAt: -1 });
    
    const mappedData = receipts.map(mapReceipt);

    res.status(200).json({
      success: true,
      count: mappedData.length,
      data: mappedData
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
      .populate('studentId')
      .populate('paymentId');
    
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }
    
    res.status(200).json({ success: true, data: mapReceipt(receipt) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update receipt details (amount, status, notes) - Legacy Admin updates
// @route   PUT /api/receipts/:id
// @access  Private/Admin
exports.updateReceipt = async (req, res) => {
  try {
    const { amountPaid, balanceDue, paymentStatus, notes } = req.body;
    const receipt = await Receipt.findById(req.params.id)
      .populate('studentId')
      .populate('paymentId');
      
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (amountPaid !== undefined) {
      receipt.amount = amountPaid;
      receipt.amountPaid = amountPaid;
    }
    if (balanceDue !== undefined) receipt.balanceDue = balanceDue;
    if (notes !== undefined) receipt.notes = notes;

    // Save changes
    await receipt.save();

    // Re-generate the PDF with updated values
    const pdfRelativePath = await pdfService.generatePDF(mapReceipt(receipt));
    receipt.pdfUrl = pdfRelativePath;
    receipt.pdfPath = pdfRelativePath;
    await receipt.save();

    res.status(200).json({
      success: true,
      message: 'Receipt details updated successfully',
      data: mapReceipt(receipt)
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

    // Remove PDF file if it exists
    if (receipt.pdfUrl) {
      const fullPath = path.join(__dirname, '..', receipt.pdfUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await Receipt.findByIdAndDelete(req.params.id);

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
    const receipt = await Receipt.findById(req.params.id)
      .populate('studentId')
      .populate('paymentId');
      
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const relativePath = await pdfService.generatePDF(mapReceipt(receipt));
    receipt.pdfUrl = relativePath;
    receipt.pdfPath = relativePath;
    await receipt.save();

    res.status(200).json({
      success: true,
      message: 'PDF compiled successfully',
      pdfPath: relativePath,
      pdfUrl: relativePath
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
    
    const receipt = await Receipt.findById(req.params.id)
      .populate('studentId')
      .populate('paymentId');
      
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Ensure PDF is generated
    const pdfPathRelative = await pdfService.generatePDF(mapReceipt(receipt));
    receipt.pdfUrl = pdfPathRelative;
    receipt.pdfPath = pdfPathRelative;
    await receipt.save();
    
    const absolutePdfPath = path.join(__dirname, '..', pdfPathRelative);
    const recipientEmail = receipt.studentId.email;

    // Fallback template values if not customized
    const mailSubject = subject || 'Internship Fee Payment Receipt';
    const emailBody = customMessage 
      ? customMessage
          .replace(/\{\{studentName\}\}/g, receipt.studentId.name)
          .replace(/\{\{receiptNumber\}\}/g, receipt.receiptNumber)
          .replace(/\{\{courseName\}\}/g, receipt.studentId.internshipTrack || receipt.studentId.course || 'Internship')
          .replace(/\{\{amount\}\}/g, `₹${receipt.amount.toLocaleString()}`)
          .replace(/\{\{paymentMethod\}\}/g, receipt.paymentId.paymentMode || 'Cash')
      : `Dear Student,\n\nYour internship payment has been successfully verified.\n\nPlease find the attached receipt PDF.\n\nRegards,\nInternHub Accounts Team`;

    let emailStatus = 'Sent';
    let errorMessage = '';
    let emailResult = null;

    try {
      // Send email with attachment
      emailResult = await emailService.sendEmailWithAttachment({
        to: recipientEmail,
        subject: mailSubject,
        html: emailBody.replace(/\n/g, '<br>'),
        attachmentPath: absolutePdfPath,
        filename: `${receipt.receiptNumber}.pdf`
      });
    } catch (mailErr) {
      emailStatus = 'Failed';
      errorMessage = mailErr.message;
    }

    // Update Receipt status
    receipt.emailStatus = emailStatus;
    receipt.emailSent = emailStatus === 'Sent';
    if (emailStatus === 'Sent') {
      receipt.emailHistory.push({
        sentAt: new Date(),
        subject: mailSubject,
        content: emailBody,
        adminId: req.user.id
      });
    }
    await receipt.save();

    // Save transactional log in emailLogs collection
    const log = new EmailLog({
      studentId: receipt.studentId._id,
      recipientEmail,
      subject: mailSubject,
      body: emailBody,
      status: emailStatus === 'Sent' ? 'Success' : 'Failed',
      errorMessage
    });
    await log.save();

    if (emailStatus === 'Failed') {
      return res.status(500).json({ success: false, message: 'Email sending failed: ' + errorMessage });
    }

    res.status(200).json({
      success: true,
      message: 'Receipt email sent successfully',
      previewUrl: emailResult ? emailResult.previewUrl : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Internal helper to trigger automatic receipt creation
exports.createReceiptFromPayment = async (payment) => {
  try {
    const student = await Student.findById(payment.studentId);
    if (!student) return;

    // Check if receipt already exists for this payment
    let receipt = await Receipt.findOne({ paymentId: payment._id });
    
    if (receipt) {
      receipt.amount = payment.amount;
      receipt.amountPaid = payment.amount;
    } else {
      const receiptNumber = await generateReceiptNumber();
      receipt = new Receipt({
        receiptNumber,
        paymentId: payment._id,
        studentId: payment.studentId,
        amount: payment.amount,
        amountPaid: payment.amount,
        balanceDue: 0,
        issueDate: payment.paymentDate || new Date(),
        emailStatus: 'Pending',
        studentName: student.name,
        email: student.email,
        phone: student.phone || '',
        courseName: student.internshipTrack || student.course || 'Internship',
        paymentMethod: payment.paymentMode,
        paymentStatus: 'Paid',
        transactionId: payment.transactionReference,
        paymentDate: payment.paymentDate || new Date()
      });
    }

    // Compile PDF receipt automatically
    const populatedReceipt = mapReceipt(receipt);
    populatedReceipt.studentId = student;
    populatedReceipt.paymentId = payment;

    const pdfRelativePath = await pdfService.generatePDF(populatedReceipt);
    receipt.pdfUrl = pdfRelativePath;
    receipt.pdfPath = pdfRelativePath;
    await receipt.save();

    console.log(`✅ Automatic receipt synced: ${receipt.receiptNumber}`);
    return receipt;
  } catch (error) {
    console.error('❌ Automatic receipt generation failed:', error);
  }
};
