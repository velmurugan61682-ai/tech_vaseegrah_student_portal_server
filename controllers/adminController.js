const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const Branch = require('../models/Branch');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const bcrypt = require('bcryptjs');

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    
    // Normalize today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const presentToday = await Attendance.countDocuments({ date: today, status: { $in: ['present', 'late'] } });
    const absentToday = await Attendance.countDocuments({ date: today, status: 'absent' });
    const unmarkedToday = totalStudents - (presentToday + absentToday);

    // Tasks metrics
    const totalTasks = await Task.countDocuments();
    const activeTasks = await Task.countDocuments({ status: { $in: ['Pending', 'In Progress'] } });
    const completedTasks = await Task.countDocuments({ status: 'Approved' });

    // Breakdown lists for Recharts
    const students = await Student.find();
    
    // 1. Students by Course
    const courseStatsMap = {};
    // Seed with existing courses
    const allCourses = await Course.find();
    allCourses.forEach(c => {
      courseStatsMap[c.courseName] = 0;
    });
    students.forEach(s => {
      if (s.course) {
        courseStatsMap[s.course] = (courseStatsMap[s.course] || 0) + 1;
      }
    });
    const studentsByCourse = Object.entries(courseStatsMap).map(([name, count]) => ({ name, count }));

    // 2. Students by Branch
    const branchStatsMap = {};
    const allBranches = await Branch.find();
    allBranches.forEach(b => {
      branchStatsMap[b.branchName] = 0;
    });
    students.forEach(s => {
      if (s.branch) {
        branchStatsMap[s.branch] = (branchStatsMap[s.branch] || 0) + 1;
      }
    });
    const studentsByBranch = Object.entries(branchStatsMap).map(([name, count]) => ({ name, count }));

    // 3. Attendance Analytics (Overview of last 5 days)
    const last5DaysRecords = await Attendance.aggregate([
      { $match: { date: { $lte: new Date() } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          present: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 5 }
    ]);
    const attendanceAnalytics = last5DaysRecords.map(r => ({
      date: r._id,
      Present: r.present,
      Absent: r.absent
    }));

    // 4. Task Analytics (Aggregations by priority / status)
    const taskBreakdown = await Task.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const taskAnalytics = taskBreakdown.map(t => ({
      name: t._id,
      value: t.count
    }));

    // Today's attendance list
    const records = await Attendance.find({ date: today });
    const recordsMap = {};
    records.forEach(r => {
      recordsMap[r.studentId.toString()] = r;
    });

    const todayAttendanceList = students.map(s => {
      const rec = recordsMap[s._id.toString()];
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        course: s.course,
        branch: s.branch,
        batch: s.batch,
        status: rec ? rec.status : 'unmarked',
        checkIn: rec ? rec.checkIn || '-' : '-',
        checkOut: rec ? rec.checkOut || '-' : '-'
      };
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        presentToday,
        absentToday: totalStudents - presentToday, // Count unmarked as absent
        activeTasks,
        completedTasks,
        internshipProgress: totalStudents > 0 ? Math.round((students.filter(s => s.status === 'Active').length / totalStudents) * 100) : 100
      },
      // Charts arrays for Recharts
      charts: {
        studentsByCourse,
        studentsByBranch,
        attendanceAnalytics,
        taskAnalytics
      },
      todayAttendanceList,
      // Compatibility layers
      totalInterns: totalStudents,
      todayPresent: presentToday,
      todayAbsent: totalStudents - presentToday,
      tasksSubmittedToday: activeTasks,
      byCourse: courseStatsMap,
      byBranch: branchStatsMap
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Student Directory
// @route   GET /api/admin/students
exports.getStudentsDirectory = async (req, res) => {
  try {
    const { course, branch, batch, todayStatus } = req.query;
    
    const students = await Student.find().sort({ name: 1 });
    const allAttendance = await Attendance.find();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const studentsList = [];
    
    // Group attendance by student
    const attendanceByStudent = {};
    allAttendance.forEach(att => {
      const sId = att.studentId.toString();
      if (!attendanceByStudent[sId]) {
        attendanceByStudent[sId] = [];
      }
      attendanceByStudent[sId].push(att);
    });

    students.forEach(s => {
      const sId = s._id.toString();
      const records = attendanceByStudent[sId] || [];
      const totalLogged = records.length;
      const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
      
      const attendanceRate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 100;
      
      const todayRecord = records.find(r => new Date(r.date).getTime() === today.getTime());
      const todayStatusVal = todayRecord ? todayRecord.status : 'unmarked';
      
      studentsList.push({
        _id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        college: s.college,
        department: s.department,
        branch: s.branch,
        course: s.course,
        batch: s.batch,
        internshipDuration: s.internshipDuration,
        startDate: s.startDate,
        endDate: s.endDate,
        attendancePercentage: attendanceRate,
        taskCompletionPercentage: s.taskCompletionPercentage,
        profilePhoto: s.profilePhoto,
        status: s.status,
        todayStatus: todayStatusVal
      });
    });

    // Apply filters
    let filtered = studentsList;
    if (course) filtered = filtered.filter(s => s.course === course);
    if (branch) filtered = filtered.filter(s => s.branch.toLowerCase() === branch.toLowerCase());
    if (batch) filtered = filtered.filter(s => s.batch === batch);
    if (todayStatus) filtered = filtered.filter(s => s.todayStatus === todayStatus);

    res.status(200).json({ success: true, students: filtered, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add New Student
// @route   POST /api/admin/students
exports.addStudent = async (req, res) => {
  try {
    const { name, email, password, phone, college, department, branch, course, batch, startDate, endDate, internshipDuration } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in required fields (Name, Email, Password)' });
    }

    const existing = await Student.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address already registered' });
    }

    // Resolve avatar image file path
    let profilePhoto = '';
    if (req.file) {
      profilePhoto = req.file.path || '/uploads/' + req.file.filename;
    }

    const student = new Student({
      name,
      email: email.toLowerCase(),
      password, // bcrypt will hash it in Student model pre-save hook
      phone: phone || '',
      college: college || '',
      department: department || '',
      branch: branch || '',
      course: course || '',
      batch: batch || '',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      internshipDuration: internshipDuration || '',
      profilePhoto,
      status: 'Active'
    });

    await student.save();

    // Increment counts
    if (branch) await Branch.findOneAndUpdate({ branchName: branch }, { $inc: { totalStudents: 1 } });
    if (course) await Course.findOneAndUpdate({ courseName: course }, { $inc: { totalStudents: 1 } });
    if (batch) await Batch.findOneAndUpdate({ batchName: batch }, { $inc: { totalStudents: 1 } });

    res.status(201).json({ success: true, message: 'Student registered successfully', student, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Student Details
// @route   PUT /api/admin/students/:id
exports.updateStudent = async (req, res) => {
  try {
    const { name, email, phone, college, department, branch, course, batch, startDate, endDate, internshipDuration, status, attendancePercentage, taskCompletionPercentage } = req.body;
    
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const oldBranch = student.branch;
    const oldCourse = student.course;
    const oldBatch = student.batch;

    if (name !== undefined) student.name = name;
    if (email !== undefined) student.email = email.toLowerCase();
    if (phone !== undefined) student.phone = phone;
    if (college !== undefined) student.college = college;
    if (department !== undefined) student.department = department;
    if (branch !== undefined) student.branch = branch;
    if (course !== undefined) student.course = course;
    if (batch !== undefined) student.batch = batch;
    if (startDate !== undefined) student.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) student.endDate = endDate ? new Date(endDate) : null;
    if (internshipDuration !== undefined) student.internshipDuration = internshipDuration;
    if (status !== undefined) student.status = status;
    if (attendancePercentage !== undefined) student.attendancePercentage = attendancePercentage;
    if (taskCompletionPercentage !== undefined) student.taskCompletionPercentage = taskCompletionPercentage;

    if (req.file) {
      student.profilePhoto = req.file.path || '/uploads/' + req.file.filename;
    }

    await student.save();

    // Shift counters if branch, course, or batch changed
    if (branch && branch !== oldBranch) {
      if (oldBranch) await Branch.findOneAndUpdate({ branchName: oldBranch }, { $inc: { totalStudents: -1 } });
      await Branch.findOneAndUpdate({ branchName: branch }, { $inc: { totalStudents: 1 } });
    }
    if (course && course !== oldCourse) {
      if (oldCourse) await Course.findOneAndUpdate({ courseName: oldCourse }, { $inc: { totalStudents: -1 } });
      await Course.findOneAndUpdate({ courseName: course }, { $inc: { totalStudents: 1 } });
    }
    if (batch && batch !== oldBatch) {
      if (oldBatch) await Batch.findOneAndUpdate({ batchName: oldBatch }, { $inc: { totalStudents: -1 } });
      await Batch.findOneAndUpdate({ batchName: batch }, { $inc: { totalStudents: 1 } });
    }

    res.status(200).json({ success: true, message: 'Student record updated successfully', student, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Student Record
// @route   DELETE /api/admin/students/:id
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { branch, course, batch } = student;
    await Student.findByIdAndDelete(req.params.id);

    // Decrement counters
    if (branch) await Branch.findOneAndUpdate({ branchName: branch }, { $inc: { totalStudents: -1 } });
    if (course) await Course.findOneAndUpdate({ courseName: course }, { $inc: { totalStudents: -1 } });
    if (batch) await Batch.findOneAndUpdate({ batchName: batch }, { $inc: { totalStudents: -1 } });

    // Remove attendance logs
    await Attendance.deleteMany({ studentId: req.params.id });

    // Pull submissions
    await Task.updateMany(
      {},
      { $pull: { submissions: { studentId: req.params.id } } }
    );

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
