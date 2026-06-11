const Student = require('../models/Student');
const Payment = require('../models/Payment');
const LeaveRequest = require('../models/LeaveRequest');

// @desc    Get dashboard analytics
// @route   GET /api/dashboard
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole === 'admin') {
      // 1. Core Metrics
      const totalStudents = await Student.countDocuments();
      const totalPayments = await Payment.countDocuments();
      
      const paidStats = await Payment.aggregate([
        { $match: { status: 'Approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalRevenue = paidStats.length > 0 ? paidStats[0].total : 0;

      const pendingCount = await Payment.countDocuments({ status: 'Pending' });
      const pendingLeaveRequestsCount = await LeaveRequest.countDocuments({ status: 'Pending' });

      // 2. Recent Activities (Merged and sorted by date)
      const recentStudents = await Student.find().sort({ createdAt: -1 }).limit(5);
      const recentPayments = await Payment.find().sort({ createdAt: -1 }).limit(5);
      const recentLeaves = await LeaveRequest.find().populate('studentId').sort({ createdAt: -1 }).limit(5);

      const activities = [];
      recentStudents.forEach(s => {
        activities.push({
          type: 'student_registered',
          message: `New student registration: ${s.name} (${s.internshipTrack || s.course || 'Internship'})`,
          timestamp: s.createdAt
        });
      });
      recentPayments.forEach(p => {
        activities.push({
          type: 'payment_logged',
          message: `Payment of ₹${p.amount.toLocaleString()} logged for ${p.studentName} (${p.status})`,
          timestamp: p.createdAt
        });
      });
      recentLeaves.forEach(l => {
        activities.push({
          type: 'leave_submitted',
          message: `Leave request filed by ${l.studentId?.name || 'Student'} for ${new Date(l.fromDate).toLocaleDateString()}`,
          timestamp: l.createdAt
        });
      });

      // Sort activities by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const recentActivities = activities.slice(0, 10);

      // 3. Chart Data (Recharts compatible)
      // Group by track
      const trackStats = await Student.aggregate([
        { $group: { _id: '$internshipTrack', count: { $sum: 1 } } }
      ]);
      const studentsByCourse = trackStats.map(item => ({
        name: item._id || 'Unassigned',
        count: item.count
      }));

      // Group by branch
      const branchStats = await Student.aggregate([
        { $group: { _id: '$branch', count: { $sum: 1 } } }
      ]);
      const studentsByBranch = branchStats.map(item => ({
        name: item._id || 'Unassigned',
        count: item.count
      }));

      // Monthly revenue
      const currentYear = new Date().getFullYear();
      const monthlyStats = await Payment.aggregate([
        { 
          $match: { 
            status: 'Approved',
            paymentDate: { 
              $gte: new Date(`${currentYear}-01-01`), 
              $lte: new Date(`${currentYear}-12-31T23:59:59`) 
            }
          } 
        },
        {
          $group: {
            _id: { $month: '$paymentDate' },
            amount: { $sum: '$amount' }
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

      // Payment status pie chart
      const statusStats = await Payment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const paymentStatusPie = statusStats.map(item => {
        let name = item._id;
        if (name === 'Approved') name = 'Paid';
        if (name === 'Rejected') name = 'Failed';
        return {
          name,
          value: item.count
        };
      });

      // For attendance board fallback metrics
      const presentCount = await Student.countDocuments({ status: 'Active' }); // mock attendance rate
      
      res.status(200).json({
        success: true,
        stats: {
          totalStudents,
          totalPayments,
          paidAmount: totalRevenue,
          pendingAmount: await Payment.aggregate([
            { $match: { status: 'Pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]).then(r => r[0]?.total || 0),
          monthlyRevenue: totalRevenue,
          paymentSuccessRate: totalPayments > 0 ? Math.round(((totalPayments - pendingCount) / totalPayments) * 100) : 100,
          pendingLeaveRequestsCount,
          presentToday: presentCount,
          absentToday: totalStudents - presentCount,
          activeTasks: 0,
          completedTasks: 0,
          internshipProgress: 100
        },
        charts: {
          studentsByCourse,
          studentsByBranch,
          attendanceAnalytics: [],
          taskAnalytics: [],
          monthlyRevenue,
          paymentStatusPie,
          internshipWiseRevenue: studentsByCourse.map(s => ({ name: s.name, Revenue: 0 })),
          studentPaymentTrends: []
        },
        recentActivities,
        todayAttendanceList: []
      });
    } else {
      // Student Stats Telemetry
      const studentId = req.user.id;
      
      const student = await Student.findById(studentId);
      const ownPaymentsCount = await Payment.countDocuments({ studentId });
      
      const ownPaidStats = await Payment.aggregate([
        { $match: { studentId, status: 'Approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const ownPaidAmount = ownPaidStats.length > 0 ? ownPaidStats[0].total : 0;
      
      const ownPendingStats = await Payment.aggregate([
        { $match: { studentId, status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const ownPendingAmount = ownPendingStats.length > 0 ? ownPendingStats[0].total : 0;

      const leavesCount = await LeaveRequest.countDocuments({ studentId });

      res.status(200).json({
        success: true,
        stats: {
          attendancePercentage: student?.attendancePercentage || 100,
          taskPercentage: student?.taskPercentage || 0,
          paymentsCount: ownPaymentsCount,
          paidAmount: ownPaidAmount,
          pendingAmount: ownPendingAmount,
          leavesCount
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
