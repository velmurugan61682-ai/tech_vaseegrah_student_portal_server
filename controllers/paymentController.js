const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Internship = require('../models/Internship');
const PaymentLog = require('../models/PaymentLog');
const Admin = require('../models/Admin');

// @desc    Get all student payments with filtering and searching
// @route   GET /api/payments
// @access  Private/Admin
exports.getPayments = async (req, res) => {
  try {
    const { course, batch, status, search } = req.query;
    let query = {};

    // 1. Filter by Payment Status
    if (status) {
      query.status = status;
    }

    // 2. Filter by Course (Internship Program)
    if (course) {
      // Direct match on cached internshipTitle
      query.internshipTitle = { $regex: new RegExp(course, 'i') };
    }

    // 3. Filter by Batch (Requires fetching matching students first)
    if (batch) {
      const matchingStudents = await Student.find({ batch }).select('_id');
      const studentIds = matchingStudents.map(s => s._id);
      query.studentId = { $in: studentIds };
    }

    // 4. Search by Student Name, Email, or Transaction ID
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { studentName: searchRegex },
        { email: searchRegex },
        { transactionId: searchRegex }
      ];
    }

    const payments = await Payment.find(query)
      .populate('studentId', 'name email phone branch batch')
      .populate('internshipId', 'title duration price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
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
      .populate('internshipId', 'title duration')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
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
      internshipId,
      amount,
      discount,
      finalAmount,
      paymentType,
      paymentMethod,
      transactionId,
      paymentDate,
      status,
      notes
    } = req.body;

    if (!studentId || !internshipId || amount === undefined || finalAmount === undefined || !paymentType || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Please provide all required payment fields' });
    }

    // Fetch student data to cache student details
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Fetch internship details to cache program title
    const internship = await Internship.findById(internshipId);
    if (!internship) {
      return res.status(404).json({ success: false, message: 'Internship program not found' });
    }

    // Duplicate Transaction Protection
    if (transactionId) {
      const existingPayment = await Payment.findOne({ transactionId });
      if (existingPayment) {
        return res.status(400).json({ success: false, message: 'Transaction ID already recorded' });
      }
    }

    const newPayment = new Payment({
      studentId,
      internshipId,
      studentName: student.name,
      email: student.email,
      phone: student.phone || '',
      internshipTitle: internship.title,
      amount,
      discount: discount || 0,
      finalAmount,
      paymentType,
      paymentMethod,
      transactionId: transactionId || '',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      status: status || 'Pending',
      notes: notes || ''
    });

    await newPayment.save();

    // Log the audit event
    const admin = await Admin.findById(req.user.id);
    const auditLog = new PaymentLog({
      adminId: req.user.id,
      adminName: admin ? admin.name : 'System Admin',
      action: 'Payment Created',
      newValue: newPayment.toObject(),
      paymentId: newPayment._id
    });
    await auditLog.save();

    // Auto-generate receipt
    const receiptController = require('./receiptController');
    await receiptController.createReceiptFromPayment(newPayment);

    res.status(201).json({
      success: true,
      message: 'Payment record created successfully',
      data: newPayment
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
    const updates = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Duplicate Transaction Protection
    if (updates.transactionId && updates.transactionId !== payment.transactionId) {
      const existingPayment = await Payment.findOne({ transactionId: updates.transactionId });
      if (existingPayment) {
        return res.status(400).json({ success: false, message: 'Transaction ID already recorded' });
      }
    }

    const oldValue = payment.toObject();
    const admin = await Admin.findById(req.user.id);
    const adminName = admin ? admin.name : 'System Admin';

    // Track detailed changes for audit logs
    const changes = [];
    const fieldsToTrack = ['amount', 'finalAmount', 'discount', 'status', 'paymentType', 'paymentMethod', 'transactionId', 'notes'];
    
    fieldsToTrack.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== oldValue[field]) {
        changes.push({
          field,
          old: oldValue[field],
          new: updates[field]
        });
        payment[field] = updates[field];
      }
    });

    if (updates.paymentDate) {
      const oldTime = new Date(oldValue.paymentDate).getTime();
      const newTime = new Date(updates.paymentDate).getTime();
      if (oldTime !== newTime) {
        changes.push({
          field: 'paymentDate',
          old: oldValue.paymentDate,
          new: updates.paymentDate
        });
        payment.paymentDate = new Date(updates.paymentDate);
      }
    }

    // Save changes
    if (changes.length > 0) {
      await payment.save();

      // Write separate audit logs if amount or status changed, or a general modification log
      for (const change of changes) {
        let action = 'Payment Modified';
        if (change.field === 'amount' || change.field === 'finalAmount') {
          action = 'Amount Changed';
        } else if (change.field === 'status') {
          action = 'Status Updated';
        }

        const log = new PaymentLog({
          adminId: req.user.id,
          adminName,
          action,
          oldValue: { [change.field]: change.old },
          newValue: { [change.field]: change.new },
          paymentId: payment._id
        });
        await log.save();
      }

      // Auto-generate/update receipt
      const receiptController = require('./receiptController');
      await receiptController.createReceiptFromPayment(payment);
    }

    res.status(200).json({
      success: true,
      message: 'Payment record updated successfully',
      data: payment
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

    const oldValue = payment.status;
    if (oldValue === status) {
      return res.status(200).json({ success: true, message: 'Status is already ' + status, data: payment });
    }

    payment.status = status;
    await payment.save();

    // If approved/marked as Paid, auto-generate/update receipt
    if (status === 'Paid') {
      const receiptController = require('./receiptController');
      await receiptController.createReceiptFromPayment(payment);
    }

    // Log update
    const admin = await Admin.findById(req.user.id);
    const action = status === 'Paid' ? 'Payment Approved' : 'Status Updated';
    
    const log = new PaymentLog({
      adminId: req.user.id,
      adminName: admin ? admin.name : 'System Admin',
      action,
      oldValue: { status: oldValue },
      newValue: { status: status },
      paymentId: payment._id
    });
    await log.save();

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status} successfully`,
      data: payment
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

    const oldValue = payment.toObject();
    await Payment.findByIdAndDelete(req.params.id);

    // Audit Log delete action
    const admin = await Admin.findById(req.user.id);
    const log = new PaymentLog({
      adminId: req.user.id,
      adminName: admin ? admin.name : 'System Admin',
      action: 'Payment Deleted',
      oldValue,
      newValue: null,
      paymentId: payment._id
    });
    await log.save();

    res.status(200).json({
      success: true,
      message: 'Payment record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard metrics and charts data for Payments
// @route   GET /api/payments/analytics
// @access  Private/Admin
exports.getPaymentAnalytics = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const totalPayments = await Payment.countDocuments();
    
    // Sum paid and pending amount
    const paidStats = await Payment.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);
    const paidAmount = paidStats.length > 0 ? paidStats[0].total : 0;

    const pendingStats = await Payment.aggregate([
      { $match: { status: 'Pending' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);
    const pendingAmount = pendingStats.length > 0 ? pendingStats[0].total : 0;

    // Type of payment breakdown
    const onlineCount = await Payment.countDocuments({ paymentType: 'Online Payment' });
    const offlineCount = await Payment.countDocuments({ paymentType: 'Offline Payment' });

    // Payment Success Rate
    const successfulCount = await Payment.countDocuments({ status: 'Paid' });
    const failedCount = await Payment.countDocuments({ status: 'Failed' });
    const successRate = totalPayments > 0 ? Math.round((successfulCount / totalPayments) * 100) : 100;

    // Monthly revenue details (for Recharts Bar/Area Charts)
    // Query paid payments in the current calendar year, grouped by month
    const currentYear = new Date().getFullYear();
    const monthlyStats = await Payment.aggregate([
      { 
        $match: { 
          status: 'Paid',
          paymentDate: { 
            $gte: new Date(`${currentYear}-01-01`), 
            $lte: new Date(`${currentYear}-12-31T23:59:59`) 
          }
        } 
      },
      {
        $group: {
          _id: { $month: '$paymentDate' },
          amount: { $sum: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyRevenue = monthNames.map((name, index) => {
      const monthNum = index + 1;
      const found = monthlyStats.find(item => item._id === monthNum);
      return {
        name,
        Revenue: found ? found.amount : 0
      };
    });

    // Payment status pie chart data
    const statusStats = await Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const paymentStatusPie = statusStats.map(item => ({
      name: item._id,
      value: item.count
    }));

    // Internship-wise revenue breakdown
    const internshipStats = await Payment.aggregate([
      { $match: { status: 'Paid' } },
      {
        $group: {
          _id: '$internshipTitle',
          revenue: { $sum: '$finalAmount' }
        }
      }
    ]);
    const internshipWiseRevenue = internshipStats.map(item => ({
      name: item._id || 'Unspecified',
      Revenue: item.revenue
    }));

    // Student payment trends (Recent payment amounts over time)
    const trendsStats = await Payment.find({ status: 'Paid' })
      .sort({ paymentDate: 1 })
      .limit(10)
      .select('paymentDate finalAmount studentName');
    
    const studentPaymentTrends = trendsStats.map(item => ({
      date: new Date(item.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Amount: item.finalAmount,
      studentName: item.studentName
    }));

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalPayments,
        paidAmount,
        pendingAmount,
        monthlyRevenue: paidAmount, // Total revenue is total paid amount
        onlinePayments: onlineCount,
        offlinePayments: offlineCount,
        paymentSuccessRate: successRate
      },
      charts: {
        monthlyRevenue,
        paymentStatusPie,
        internshipWiseRevenue,
        studentPaymentTrends
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
    const internships = await Internship.find().sort({ title: 1 });
    res.status(200).json({ success: true, data: internships });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

