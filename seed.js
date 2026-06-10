const mongoose = require('mongoose');
require('dotenv').config();

const Admin = require('./models/Admin');
const Student = require('./models/Student');
const Branch = require('./models/Branch');
const Course = require('./models/Course');
const Batch = require('./models/Batch');
const Attendance = require('./models/Attendance');
const Task = require('./models/Task');
const TaskSubmission = require('./models/TaskSubmission');
const Notification = require('./models/Notification');
const Report = require('./models/Report');
const Log = require('./models/Log');

const seed = async () => {
  try {
    console.log('🔌 Connecting to database for seeding...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Clean up existing database collections
    console.log('🧹 Clearing existing database collections...');
    await Admin.deleteMany({});
    await Student.deleteMany({});
    await Branch.deleteMany({});
    await Course.deleteMany({});
    await Batch.deleteMany({});
    
    try {
      await mongoose.connection.db.dropCollection('attendances');
      console.log('🗑️ Dropped attendances collection to reset indexes');
    } catch (e) {
      // Ignore if not exists
    }
    
    await Task.deleteMany({});
    await TaskSubmission.deleteMany({});
    await Notification.deleteMany({});
    await Report.deleteMany({});
    await Log.deleteMany({});
    console.log('🧹 Cleaned database collections');

    // 1. Create Admin
    console.log('👤 Creating Admin...');
    const admin = new Admin({
      name: 'Super Admin',
      email: 'admin@techvaseegrah.com',
      password: 'Admin@123',
      phone: '+919876543210',
      role: 'admin'
    });
    await admin.save();
    console.log('👤 Admin created');

    // 2. Create Branches
    console.log('🏢 Creating Branches...');
    const branchNames = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI&DS'];
    const branches = [];
    for (const bName of branchNames) {
      const branch = new Branch({
        branchName: bName,
        description: `${bName} Department engineering interns`,
        totalStudents: 0
      });
      await branch.save();
      branches.push(branch);
    }
    console.log(`🏢 Created ${branches.length} branches`);

    // 3. Create Courses
    console.log('🎓 Creating Courses...');
    const courseNames = ['Python', 'MERN Stack', 'AI & ML'];
    const courses = [];
    for (const cName of courseNames) {
      const course = new Course({
        courseName: cName,
        description: `Full Internship Course track for ${cName}`,
        totalStudents: 0
      });
      await course.save();
      courses.push(course);
    }
    console.log(`🎓 Created ${courses.length} courses`);

    // 4. Create Batches
    console.log('👥 Creating Batches...');
    const batchNames = ['2023-25', '2024-26', '2025-27'];
    const batches = [];
    for (const btName of batchNames) {
      const batch = new Batch({
        batchName: btName,
        description: `Internship batch year ${btName}`,
        totalStudents: 0
      });
      await batch.save();
      batches.push(batch);
    }
    console.log(`👥 Created ${batches.length} batches`);

    // 5. Create 10 Students across departments, branches, courses, and batches
    console.log('👨‍🎓 Creating Students...');
    const studentsData = [
      { name: 'John Doe', email: 'john@techvaseegrah.com', phone: '9876543211', college: 'Anna University', department: 'Computer Science', branch: 'CSE', course: 'MERN Stack', batch: '2024-26', status: 'Active' },
      { name: 'Jane Smith', email: 'jane@techvaseegrah.com', phone: '9876543212', college: 'IIT Madras', department: 'Information Technology', branch: 'IT', course: 'MERN Stack', batch: '2024-26', status: 'Active' },
      { name: 'Alice Johnson', email: 'alice@techvaseegrah.com', phone: '9876543213', college: 'PSG Tech', department: 'Electronics', branch: 'ECE', course: 'Python', batch: '2023-25', status: 'Active' },
      { name: 'Bob Wilson', email: 'bob@techvaseegrah.com', phone: '9876543214', college: 'VIT Chennai', department: 'Electronics', branch: 'ECE', course: 'Python', batch: '2023-25', status: 'At Risk' },
      { name: 'Charlie Brown', email: 'charlie@techvaseegrah.com', phone: '9876543215', college: 'SRM University', department: 'Mechanical', branch: 'MECH', course: 'Python', batch: '2024-26', status: 'Inactive' },
      { name: 'David Miller', email: 'david@techvaseegrah.com', phone: '9876543216', college: 'SSN College', department: 'Electrical', branch: 'EEE', course: 'MERN Stack', batch: '2023-25', status: 'Active' },
      { name: 'Emma Davis', email: 'emma@techvaseegrah.com', phone: '9876543217', college: 'Sathyabama Institute', department: 'Computer Science', branch: 'CSE', course: 'AI & ML', batch: '2024-26', status: 'Active' },
      { name: 'Frank Harris', email: 'frank@techvaseegrah.com', phone: '9876543218', college: 'Hindustan University', department: 'Civil', branch: 'CIVIL', course: 'Python', batch: '2023-25', status: 'Inactive' },
      { name: 'Grace Lee', email: 'grace@techvaseegrah.com', phone: '9876543219', college: 'KCG College', department: 'Data Science', branch: 'AI&DS', course: 'AI & ML', batch: '2024-26', status: 'Active' },
      { name: 'Henry Taylor', email: 'henry@techvaseegrah.com', phone: '9876543220', college: 'St. Joseph College', department: 'Data Science', branch: 'AI&DS', course: 'AI & ML', batch: '2023-25', status: 'At Risk' }
    ];

    const students = [];
    const today = new Date();
    const startDate = new Date();
    startDate.setMonth(today.getMonth() - 2);
    const endDate = new Date();
    endDate.setMonth(today.getMonth() + 1);

    for (const s of studentsData) {
      // Calculate attendance and task completion percentage defaults
      let attRate = 95;
      let taskRate = 80;
      if (s.status === 'At Risk') {
        attRate = 68;
        taskRate = 45;
      } else if (s.status === 'Inactive') {
        attRate = 20;
        taskRate = 10;
      }

      const student = new Student({
        name: s.name,
        email: s.email,
        password: 'Student@123',
        phone: s.phone,
        college: s.college,
        department: s.department,
        branch: s.branch,
        course: s.course,
        batch: s.batch,
        internshipDuration: '3 Months',
        startDate,
        endDate,
        attendancePercentage: attRate,
        taskCompletionPercentage: taskRate,
        profilePhoto: '',
        status: s.status,
        role: 'student'
      });
      await student.save();
      students.push(student);

      // Increment branch & course & batch counters
      await Branch.findOneAndUpdate({ branchName: s.branch }, { $inc: { totalStudents: 1 } });
      await Course.findOneAndUpdate({ courseName: s.course }, { $inc: { totalStudents: 1 } });
      await Batch.findOneAndUpdate({ batchName: s.batch }, { $inc: { totalStudents: 1 } });
    }
    console.log(`👨‍🎓 Created ${students.length} students`);

    // 6. Create 3 Sample Tasks
    console.log('📋 Creating Tasks...');
    const tasks = [];

    // Task 1: MERN Stack Routing
    const task1 = new Task({
      title: 'Vite React Routing & Axios Setup',
      description: 'Implement frontend routers using react-router-dom and configure Axios instance with API environment URL.',
      assignedTo: students.filter(s => s.course === 'MERN Stack').map(s => s._id),
      branch: 'CSE',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      priority: 'High',
      status: 'In Progress',
      createdBy: admin._id
    });
    await task1.save();
    tasks.push(task1);

    // Task 2: Python Data cleaning
    const task2 = new Task({
      title: 'Python Pandas Data Cleaning & Aggregation',
      description: 'Load housing datasets, replace null records, identify outliers, and plot features correlation heatmaps.',
      assignedTo: students.filter(s => s.course === 'Python').map(s => s._id),
      branch: 'ECE',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      priority: 'Medium',
      status: 'Pending',
      createdBy: admin._id
    });
    await task2.save();
    tasks.push(task2);

    // Task 3: AI Model Training
    const task3 = new Task({
      title: 'Supervised Learning Classifier Training',
      description: 'Train SVM, Random Forest and Gradient Boost models, tune hyper-parameters and compile F1 scores matrices.',
      assignedTo: students.filter(s => s.course === 'AI & ML').map(s => s._id),
      branch: 'AI&DS',
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      priority: 'High',
      status: 'Submitted',
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      createdBy: admin._id
    });
    await task3.save();
    tasks.push(task3);

    console.log(`📋 Created ${tasks.length} tasks`);

    // 7. Seed Attendance logs for last 5 days
    console.log('📅 Seeding Attendance logs...');
    const attendanceRecords = [];
    const checkInTimes = ['08:45 AM', '09:02 AM', '08:50 AM', '09:12 AM', '09:40 AM']; // 9:40 AM is late
    const checkOutTimes = ['05:00 PM', '05:15 PM', '05:30 PM', '05:05 PM', '04:55 PM'];

    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const recordDate = new Date();
      recordDate.setDate(today.getDate() - dayOffset);
      recordDate.setHours(0, 0, 0, 0);

      // Skip Sunday
      if (recordDate.getDay() === 0) continue;

      for (const student of students) {
        // Inactive students check-in rarely
        if (student.status === 'Inactive' && Math.random() > 0.15) {
          continue; // simulate absent
        }

        // At risk students check-in occasionally
        if (student.status === 'At Risk' && Math.random() > 0.6) {
          // simulate absent record
          const att = new Attendance({
            studentId: student._id,
            date: recordDate,
            checkIn: '',
            checkOut: '',
            status: 'absent',
            remarks: 'Unexcused absence',
            markedByStudent: false
          });
          await att.save();
          attendanceRecords.push(att);
          continue;
        }

        // Active students check in
        const timeIndex = Math.floor(Math.random() * checkInTimes.length);
        const checkIn = checkInTimes[timeIndex];
        const checkOut = checkOutTimes[timeIndex];
        const isLate = checkIn === '09:40 AM' || (timeIndex === 3 && Math.random() > 0.5);
        const status = isLate ? 'late' : 'present';

        const att = new Attendance({
          studentId: student._id,
          date: recordDate,
          checkIn,
          checkOut,
          status,
          remarks: isLate ? 'Checked in late due to traffic' : 'On time',
          markedByStudent: Math.random() > 0.5
        });
        await att.save();
        attendanceRecords.push(att);
      }
    }
    console.log(`📅 Generated ${attendanceRecords.length} attendance records`);

    // 8. Seed Task Submissions
    console.log('🚀 Seeding Task Submissions...');
    // We will generate submissions for task 3 (AI ML task, which is submitted) and task 1 (MERN task)
    // Task 3 is assigned to students: Grace Lee (AI&DS), Emma Davis (CSE), Henry Taylor (AI&DS)
    const aiStudents = students.filter(s => s.course === 'AI & ML');
    for (const student of aiStudents) {
      // Emma's submission is Approved
      // Grace's submission is Pending
      // Henry's submission is Rejected
      let subStatus = 'pending';
      let remark = '';
      if (student.name === 'Emma Davis') {
        subStatus = 'approved';
      } else if (student.name === 'Henry Taylor') {
        subStatus = 'rejected';
        remark = 'Incomplete classification matrix. Please re-run SVM models.';
      }

      const submission = new TaskSubmission({
        task: task3._id,
        student: student._id,
        solutionText: `Here is my classifier training script. I achieved 89% accuracy using Random Forest after tuning parameters. Github Repo is attached.`,
        solutionImage: '',
        solutionLink: 'https://github.com/intern/supervised-learning-classifiers',
        solutionDocument: '',
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: subStatus,
        adminMark: subStatus === 'approved' ? 90 : 0,
        adminNote: remark,
        viewedByAdmin: true
      });
      await submission.save();

      // Push submission into task nested submissions array for compatibility
      await Task.findByIdAndUpdate(task3._id, {
        $push: {
          submissions: {
            studentId: student._id,
            solutionText: submission.solutionText,
            githubLink: submission.solutionLink,
            status: subStatus === 'approved' ? 'Approved' : subStatus === 'rejected' ? 'Rejected' : 'Pending',
            rejectionReason: remark,
            submittedAt: submission.submittedAt
          }
        }
      });
    }

    // Task 1 is MERN. Let's make John Doe submit a pending submission
    const mernStudents = students.filter(s => s.course === 'MERN Stack');
    if (mernStudents.length > 0) {
      const studentObj = mernStudents[0];
      const submission = new TaskSubmission({
        task: task1._id,
        student: studentObj._id,
        solutionText: `Completed Axios instance configuration and Router setups. Waiting for review.`,
        solutionLink: 'https://github.com/intern/internhub-routing-setup',
        submittedAt: new Date(),
        status: 'pending'
      });
      await submission.save();

      await Task.findByIdAndUpdate(task1._id, {
        $push: {
          submissions: {
            studentId: studentObj._id,
            solutionText: submission.solutionText,
            githubLink: submission.solutionLink,
            status: 'Pending',
            submittedAt: submission.submittedAt
          }
        }
      });
    }

    console.log('🚀 Seeded submissions');

    // 9. Seed Notification
    console.log('🔔 Seeding Notifications...');
    const notif1 = new Notification({
      recipient: students[0]._id,
      recipientModel: 'Student',
      title: 'Welcome to InternHub',
      message: 'Your student portal access is fully set up. Good luck with your MERN Stack internship track!',
      isRead: false
    });
    await notif1.save();

    const notif2 = new Notification({
      recipient: admin._id,
      recipientModel: 'Admin',
      title: 'New Student Registration',
      message: 'Student John Doe has registered for the MERN Stack course track.',
      isRead: false
    });
    await notif2.save();
    console.log('🔔 Notifications seeded');

    // 10. Seed Report
    console.log('📊 Seeding Reports...');
    const report1 = new Report({
      title: 'Monthly Attendance Summary - June 2026',
      type: 'attendance',
      generatedBy: admin._id,
      data: {
        totalDays: 22,
        averageRate: 88,
        activeInternsCount: 10
      },
      format: 'csv'
    });
    await report1.save();
    console.log('📊 Reports seeded');

    console.log('✅ Database Seeding completed successfully!');
    console.log('👤 Admin Login: admin@techvaseegrah.com / Admin@123');
    console.log('👤 Student Login: john@techvaseegrah.com / Student@123');
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seed();
