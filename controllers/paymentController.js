const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Internship = require('../models/Internship');
const Admin = require('../models/Admin');

// Helper to map database model to legacy frontend expectations
const mapPayment = (p) => {
  if (!p) return null;
  const obj = p.toObject ? p.toObject() : p;
  
  // Backward compatibility mappings
  obj.finalAmount = obj.amount; 
  obj.discount = obj.discount || 0;
  obj.paymentType = (obj.paymentMode === 'Cash' || obj.paymentMode === 'Bank Transfer') 
    ? 'Offline Payment' 
    : 'Online Payment';
  obj.paymentMethod = obj.paymentMode;
  obj.transactionId = obj.transactionReference || '';
  obj.notes = obj.remarks || '';
  
  // Status mapping: Approved -> Paid, Rejected -> Failed, Pending -> Pending
  if (obj.status === 'Approved') {
    obj.status = 'Paid';
  } else if (obj.status === 'Rejected') {
    obj.status = 'Failed';
  }
  
  // Ensure nested student fields are present or virtualized
  if (obj.studentId && typeof obj.studentId === 'object') {
    obj.studentName = obj.studentId.name || obj.studentName || '';
    obj.email = obj.studentId.email || obj.email || '';
    obj.phone = obj.studentId.phone || obj.phone || '';
    obj.internshipTitle = obj.studentId.internshipTrack || obj.studentId.course || obj.internshipTitle || '';
  }

  return obj;
};

// @desc    Get all student payments with filtering and searching
// @route   GET /api/payments
// @access  Private/Admin
exports.getPayments = async (req, res) => {
  try {
    const { course, batch, status, search } = req.query;
    let query = {};

    // 1. Filter by Payment Status
    if (status) {
      let mappedStatus = status;
      if (status === 'Paid') mappedStatus = 'Approved';
      if (status === 'Failed' || status === 'Refunded') mappedStatus = 'Rejected';
      query.status = mappedStatus;
    }

    // 2. Filter by Batch or Course (Requires fetching matching students first)
    let studentFilter = {};
    if (batch) {
      studentFilter.batch = batch;
    }
    if (course) {
      studentFilter.$or = [
        { internshipTrack: course },
        { course: course }
      ];
    }
    
    if (batch || course) {
      const matchingStudents = await Student.find(studentFilter).select('_id');
      const studentIds = matchingStudents.map(s => s._id);
      query.studentId = { $in: studentIds };
    }

    // 3. Search by Student Name, Email, or Transaction Reference
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // Find students matching search term
      const matchingStudents = await Student.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);

      query.$or = [
        { studentId: { $in: studentIds } },
        { transactionReference: searchRegex },
        { remarks: searchRegex }
      ];
    }

    const payments = await Payment.find(query)
      .populate('studentId')
      .sort({ createdAt: -1 });

    const mappedData = payments.map(mapPayment);

    res.status(200).json({
      success: true,
      count: mappedData.length,
      data: mappedData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get authenticated student's payment history
// @route   GET /api/payments/student
// @access  Private/Student
exports.getStudentPayments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const payments = await Payment.find({ studentId })
      .populate('studentId')
      .sort({ createdAt: -1 });

    const mappedData = payments.map(mapPayment);

    res.status(200).json({
      success: true,
      count: mappedData.length,
      data: mappedData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new student payment record
// @route   POST /api/payments
// @access  Private/Admin
exports.createPayment = async (req, res) => {
  try {
    const {
      studentId,
      amount,
      finalAmount,
      paymentMode,
      paymentMethod,
      paymentType,
      transactionReference,
      transactionId,
      paymentDate,
      status,
      remarks,
      notes
    } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Please provide studentId' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const finalPaid = finalAmount !== undefined ? finalAmount : amount;
    const mode = paymentMode || paymentMethod || paymentType || 'Cash';
    const ref = transactionReference || transactionId || '';
    const rems = remarks || notes || '';
    
    let dbStatus = status || 'Pending';
    if (dbStatus === 'Paid') dbStatus = 'Approved';
    if (dbStatus === 'Failed' || dbStatus === 'Refunded') dbStatus = 'Rejected';

    // Duplicate reference protection
    if (ref) {
      const existingPayment = await Payment.findOne({ transactionReference: ref });
      if (existingPayment) {
        return res.status(400).json({ success: false, message: 'Transaction reference ID already recorded' });
      }
    }

    const newPayment = new Payment({
      studentId,
      amount: finalPaid,
      paymentMode: mode,
      transactionReference: ref,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      status: dbStatus,
      remarks: rems,
      studentName: student.name,
      email: student.email,
      phone: student.phone || '',
      internshipTitle: student.internshipTrack || student.course || 'MERN Stack'
    });

    await newPayment.save();

    // If status is Approved/Paid, auto-generate receipt record + PDF
    if (dbStatus === 'Approved') {
      const receiptController = require('./receiptController');
      await receiptController.createReceiptFromPayment(newPayment);
    }

    res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      data: mapPayment(newPayment)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update existing student payment
// @route   PUT /api/payments/:id
// @access  Private/Admin
exports.updatePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const {
      amount,
      finalAmount,
      paymentMode,
      paymentMethod,
      transactionReference,
      transactionId,
      paymentDate,
      status,
      remarks,
      notes
    } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const finalPaid = finalAmount !== undefined ? finalAmount : amount;
    const mode = paymentMode || paymentMethod;
    const ref = transactionReference || transactionId;
    const rems = remarks || notes;

    if (finalPaid !== undefined) payment.amount = finalPaid;
    if (mode !== undefined) payment.paymentMode = mode;
    if (ref !== undefined) payment.transactionReference = ref;
    if (paymentDate !== undefined) payment.paymentDate = new Date(paymentDate);
    if (rems !== undefined) payment.remarks = rems;

    if (status !== undefined) {
      let dbStatus = status;
      if (dbStatus === 'Paid') dbStatus = 'Approved';
      if (dbStatus === 'Failed' || dbStatus === 'Refunded') dbStatus = 'Rejected';
      payment.status = dbStatus;
    }

    await payment.save();

    // If payment is Approved, auto-generate/update receipt
    if (payment.status === 'Approved') {
      const receiptController = require('./receiptController');
      await receiptController.createReceiptFromPayment(payment);
    }

    res.status(200).json({
      success: true,
      message: 'Payment record updated successfully',
      data: mapPayment(payment)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve or update status of payment directly
// @route   PATCH /api/payments/:id/status
// @access  Private/Admin
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Please provide status' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    let dbStatus = status;
    if (dbStatus === 'Paid') dbStatus = 'Approved';
    if (dbStatus === 'Failed' || dbStatus === 'Refunded') dbStatus = 'Rejected';

    payment.status = dbStatus;
    await payment.save();

    // If approved, auto-generate receipt record
    if (dbStatus === 'Approved') {
      const receiptController = require('./receiptController');
      await receiptController.createReceiptFromPayment(payment);
    }

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status} successfully`,
      data: mapPayment(payment)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete student payment record
// @route   DELETE /api/payments/:id
// @access  Private/Admin
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    await Payment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Payment record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard metrics and charts data for Payments (Legacy compatibility)
// @route   GET /api/payments/analytics
// @access  Private/Admin
exports.getPaymentAnalytics = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalPayments = await Payment.countDocuments();
    
    const paidStats = await Payment.aggregate([
      { $match: { status: 'Approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const paidAmount = paidStats.length > 0 ? paidStats[0].total : 0;

    const pendingStats = await Payment.aggregate([
      { $match: { status: 'Pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingAmount = pendingStats.length > 0 ? pendingStats[0].total : 0;

    const successRate = totalPayments > 0 
      ? Math.round((await Payment.countDocuments({ status: 'Approved' }) / totalPayments) * 100) 
      : 100;

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalPayments,
        paidAmount,
        pendingAmount,
        paymentSuccessRate: successRate
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all internship tracks
// @route   GET /api/payments/internships
// @access  Private
exports.getInternships = async (req, res) => {
  try {
    // Return dummy list if internship collections are empty
    let internships = await Internship.find().sort({ title: 1 });
    if (internships.length === 0) {
      internships = [
        { _id: '111111111111111111111111', title: 'MERN Stack', duration: '3 Months', price: 15000 },
        { _id: '222222222222222222222222', title: 'Python', duration: '3 Months', price: 12000 },
        { _id: '333333333333333333333333', title: 'AI & ML', duration: '3 Months', price: 18000 }
      ];
    }
    res.status(200).json({ success: true, data: internships });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
