const Report = require('../models/Report');

// @desc    Get all reports history
// @route   GET /api/reports
exports.getReportsHistory = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, reports, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save generated report log
// @route   POST /api/reports
exports.saveReportLog = async (req, res) => {
  try {
    const { title, type, data, format } = req.body;
    if (!title || !type || !format) {
      return res.status(400).json({ success: false, message: 'Please provide title, type and format' });
    }

    const report = new Report({
      title,
      type,
      generatedBy: req.user.id,
      data: data || {},
      format
    });

    await report.save();
    res.status(201).json({ success: true, message: 'Report saved to history successfully', report, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get branch wise attendance report
// @route   GET /api/reports/branch-wise
// @access  Private/Admin
exports.getBranchWiseAttendanceReport = async (req, res) => {
  try {
    const Branch = require('../models/Branch');
    const Student = require('../models/Student');
    const Attendance = require('../models/Attendance');

    const branches = await Branch.find();
    const reportData = [];

    for (const branch of branches) {
      // Find students belonging to this branch
      const students = await Student.find({ branchId: branch._id });
      const studentIds = students.map(s => s._id);

      // Count attendance statuses for these students
      const present = await Attendance.countDocuments({ studentId: { $in: studentIds }, status: 'Present' });
      const absent = await Attendance.countDocuments({ studentId: { $in: studentIds }, status: 'Absent' });
      const late = await Attendance.countDocuments({ studentId: { $in: studentIds }, status: 'Late' });

      reportData.push({
        branchId: branch._id,
        branchName: branch.branchName,
        present,
        absent,
        late,
        totalStudents: students.length
      });
    }

    res.status(200).json({ success: true, data: reportData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
