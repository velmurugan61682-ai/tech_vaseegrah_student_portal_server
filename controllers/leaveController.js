const LeaveRequest = require('../models/LeaveRequest');
const Student = require('../models/Student');

// @desc    Student applies for leave
// @route   POST /api/leaves
// @access  Private/Student
exports.applyLeave = async (req, res) => {
  try {
    const { fromDate, toDate, reason } = req.body;
    const studentId = req.user.id;

    if (!fromDate || !toDate || !reason) {
      return res.status(400).json({ success: false, message: 'Please provide fromDate, toDate, and reason' });
    }

    const leave = new LeaveRequest({
      studentId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
      status: 'Pending'
    });

    await leave.save();

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: leave
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student views own leave requests
// @route   GET /api/leaves/student
// @access  Private/Student
exports.getStudentLeaves = async (req, res) => {
  try {
    const studentId = req.user.id;
    const leaves = await LeaveRequest.find({ studentId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin views all student leave requests
// @route   GET /api/leaves
// @access  Private/Admin
exports.getAllLeaves = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      // Find matching students first
      const students = await Student.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }).select('_id');
      
      query.studentId = { $in: students.map(s => s._id) };
    }

    const leaves = await LeaveRequest.find(query)
      .populate('studentId', 'name email branch batch internshipTrack course')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin approves/rejects leave request
// @route   PUT /api/leaves/:id
// @access  Private/Admin
exports.reviewLeave = async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Please provide status (Approved or Rejected)' });
    }

    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    leave.status = status;
    if (adminRemarks !== undefined) {
      leave.adminRemarks = adminRemarks;
    }

    await leave.save();

    res.status(200).json({
      success: true,
      message: `Leave request status updated to ${status} successfully`,
      data: leave
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
