const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Task = require('../models/Task');
const { logActivity } = require('../services/activityLogService');

// @desc    Get Student Dashboard Metrics
// @route   GET /api/student/dashboard
exports.getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;
    const studentCourse = req.user.course || '';

    // 1. Calculate Attendance Rate
    const records = await Attendance.find({ studentId });
    const totalLogged = records.length;
    const presentCount = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const attendanceRate = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 100;

    // 2. Fetch Tasks and Submissions count
    const allTasks = await Task.find();
    
    // Filter tasks assigned to this student
    const assignedTasks = allTasks.filter(t => {
      return (
        t.assignmentType === 'all' ||
        (t.assignmentType === 'course' && t.course === studentCourse) ||
        (t.assignmentType === 'student' && t.assignedTo.some(id => id.toString() === studentId.toString()))
      );
    });

    const approvedSubmissions = assignedTasks.filter(t => 
      t.submissions.some(sub => sub.studentId.toString() === studentId.toString() && sub.status === 'Approved')
    );

    const submittedSubmissions = assignedTasks.filter(t => 
      t.submissions.some(sub => sub.studentId.toString() === studentId.toString())
    );

    const pendingTasksCount = assignedTasks.length - submittedSubmissions.length;
    const taskCompletionRate = assignedTasks.length > 0 
      ? Math.round((approvedSubmissions.length / assignedTasks.length) * 100) 
      : 100;

    res.status(200).json({
      success: true,
      pendingTasks: pendingTasksCount,
      attendanceRate,
      taskCompletionRate,
      data: {
        pendingTasks: pendingTasksCount,
        attendanceRate,
        taskCompletionRate
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current student profile
// @route   GET /api/student/profile
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(200).json({ success: true, data: student, student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student profile (phone, college, branch)
// @route   PUT /api/student/profile
exports.updateStudentProfile = async (req, res) => {
  try {
    const { name, phone, college, department, branch, batch, profilePhoto } = req.body;
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (name !== undefined) student.name = name;
    if (phone !== undefined) student.phone = phone;
    if (college !== undefined) student.college = college;
    if (department !== undefined) student.department = department;
    if (branch !== undefined) student.branch = branch;
    if (batch !== undefined) student.batch = batch;
    if (profilePhoto !== undefined) student.profilePhoto = profilePhoto;

    if (req.file) {
      student.profilePhoto = req.file.path || '/uploads/' + req.file.filename;
    }

    await student.save();
    
    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      module: 'Students',
      action: 'student_updated',
      description: `Profile settings updated`,
      io: req.io
    });

    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully', 
      data: student,
      student 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Student Directory
// @route   GET /api/students
// @access  Private/Admin
exports.getStudentsDirectory = async (req, res) => {
  try {
    const { course, branch, batch, search } = req.query;
    let query = {};
    
    if (course) {
      query.$or = [{ internshipTrack: course }, { course: course }];
    }
    if (branch) {
      query.branch = { $regex: new RegExp(branch, 'i') };
    }
    if (batch) {
      query.batch = batch;
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { college: searchRegex }
      ];
    }

    const students = await Student.find(query).sort({ name: 1 });
    
    const mapped = students.map(s => {
      const obj = s.toObject();
      obj.profileImage = s.profileImage || s.profilePhoto || '';
      obj.profilePhoto = s.profilePhoto || s.profileImage || '';
      obj.internshipTrack = s.internshipTrack || s.course || '';
      obj.course = s.course || s.internshipTrack || '';
      obj.taskPercentage = s.taskPercentage !== undefined ? s.taskPercentage : s.taskCompletionPercentage || 0;
      obj.taskCompletionPercentage = s.taskCompletionPercentage !== undefined ? s.taskCompletionPercentage : s.taskPercentage || 0;
      return obj;
    });

    res.status(200).json({ success: true, count: mapped.length, students: mapped, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add New Student
// @route   POST /api/students
// @access  Private/Admin
exports.addStudent = async (req, res) => {
  try {
    const { name, email, password, phone, college, department, branch, branchId, internshipTrack, course, batch } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in required fields (Name, Email, Password)' });
    }

    // Resolve branchId
    let finalBranchId = branchId;
    let finalBranchName = branch || '';
    const Branch = require('../models/Branch');

    if (!finalBranchId && finalBranchName) {
      const bDoc = await Branch.findOne({ branchName: finalBranchName.toUpperCase().trim() });
      if (bDoc) {
        finalBranchId = bDoc._id;
      }
    }

    if (!finalBranchId) {
      // Find any default branch or return error
      const defaultBranch = await Branch.findOne();
      if (defaultBranch) {
        finalBranchId = defaultBranch._id;
        finalBranchName = defaultBranch.branchName;
      } else {
        return res.status(400).json({ success: false, message: 'No academic branches configured in database' });
      }
    } else {
      const bDoc = await Branch.findById(finalBranchId);
      if (bDoc) {
        finalBranchName = bDoc.branchName;
      }
    }

    const User = require('../models/User');
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address already registered' });
    }

    let profileImage = '';
    if (req.file) {
      profileImage = req.file.path || '/uploads/' + req.file.filename;
    }

    const track = internshipTrack || course || '';

    const student = new Student({
      name,
      email: email.toLowerCase(),
      password, // bcrypt will hash it
      phone: phone || '',
      college: college || '',
      department: department || '',
      branch: finalBranchName,
      branchId: finalBranchId,
      internshipTrack: track,
      course: track,
      batch: batch || '',
      profileImage,
      profilePhoto: profileImage,
      status: 'Active',
      attendancePercentage: 100,
      taskPercentage: 0
    });

    await student.save();

    // Increment Branch Student counter
    await Branch.findByIdAndUpdate(finalBranchId, { $inc: { totalStudents: 1 } });

    // Sync to User collection
    const userCred = new User({
      _id: student._id,
      name,
      email: email.toLowerCase(),
      password,
      role: 'student'
    });
    await userCred.save();

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      module: 'Students',
      action: 'student_added',
      description: `Student "${student.name}" added`,
      io: req.io
    });

    res.status(201).json({ success: true, message: 'Student registered successfully', student, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Student Details
// @route   PUT /api/students/:id
// @access  Private/Admin
exports.updateStudent = async (req, res) => {
  try {
    const { name, email, phone, college, department, branch, branchId, internshipTrack, course, batch, status, attendancePercentage, taskPercentage, taskCompletionPercentage } = req.body;
    
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const Branch = require('../models/Branch');

    // Handle branch change counters
    if (branchId && student.branchId?.toString() !== branchId.toString()) {
      const oldBranchId = student.branchId;
      const newBranchDoc = await Branch.findById(branchId);
      if (newBranchDoc) {
        student.branchId = branchId;
        student.branch = newBranchDoc.branchName;
        // Decrement old and increment new
        if (oldBranchId) {
          await Branch.findByIdAndUpdate(oldBranchId, { $inc: { totalStudents: -1 } }).catch(() => {});
        }
        await Branch.findByIdAndUpdate(branchId, { $inc: { totalStudents: 1 } }).catch(() => {});
      }
    } else if (branch && student.branch !== branch) {
      const bDoc = await Branch.findOne({ branchName: branch.toUpperCase().trim() });
      if (bDoc && student.branchId?.toString() !== bDoc._id.toString()) {
        const oldBranchId = student.branchId;
        student.branchId = bDoc._id;
        student.branch = bDoc.branchName;
        if (oldBranchId) {
          await Branch.findByIdAndUpdate(oldBranchId, { $inc: { totalStudents: -1 } }).catch(() => {});
        }
        await Branch.findByIdAndUpdate(bDoc._id, { $inc: { totalStudents: 1 } }).catch(() => {});
      }
    }

    if (name !== undefined) student.name = name;
    if (email !== undefined) student.email = email.toLowerCase();
    if (phone !== undefined) student.phone = phone;
    if (college !== undefined) student.college = college;
    if (department !== undefined) student.department = department;
    
    const track = internshipTrack || course;
    if (track !== undefined) {
      student.internshipTrack = track;
      student.course = track;
    }
    
    if (batch !== undefined) student.batch = batch;
    if (status !== undefined) student.status = status;
    if (attendancePercentage !== undefined) student.attendancePercentage = attendancePercentage;
    
    const taskPct = taskPercentage !== undefined ? taskPercentage : taskCompletionPercentage;
    if (taskPct !== undefined) {
      student.taskPercentage = taskPct;
      student.taskCompletionPercentage = taskPct;
    }

    if (req.file) {
      const imgPath = req.file.path || '/uploads/' + req.file.filename;
      student.profileImage = imgPath;
      student.profilePhoto = imgPath;
    }

    await student.save();

    // Sync details in User collection
    const User = require('../models/User');
    const uCred = await User.findById(student._id);
    if (uCred) {
      if (name !== undefined) uCred.name = name;
      if (email !== undefined) uCred.email = email.toLowerCase();
      if (req.file) {
        uCred.profilePhoto = student.profilePhoto;
      }
      await uCred.save();
    }

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      module: 'Students',
      action: 'student_updated',
      description: `Student "${student.name}" updated`,
      io: req.io
    });

    res.status(200).json({ success: true, message: 'Student record updated successfully', student, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Student Record
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const Branch = require('../models/Branch');
    if (student.branchId) {
      await Branch.findByIdAndUpdate(student.branchId, { $inc: { totalStudents: -1 } }).catch(() => {});
    }

    await Student.findByIdAndDelete(req.params.id);

    // Sync deletion to User collection
    const User = require('../models/User');
    await User.findOneAndDelete({ email: student.email.toLowerCase() });

    // Remove attendance logs
    await Attendance.deleteMany({ studentId: req.params.id });

    // Pull submissions
    await Task.updateMany(
      {},
      { $pull: { submissions: { studentId: req.params.id } } }
    );

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      module: 'Students',
      action: 'student_deleted',
      description: `Student "${student.name}" deleted`,
      io: req.io
    });

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Students by Branch
// @route   GET /api/students/branch/:branchId
// @access  Private/Admin
exports.getStudentsByBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Please provide branchId' });
    }
    const students = await Student.find({ branchId }).sort({ name: 1 });
    res.status(200).json({ success: true, count: students.length, students, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
