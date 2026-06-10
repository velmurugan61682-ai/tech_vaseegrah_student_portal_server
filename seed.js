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

// New MERN collections
const User = require('./models/User');
const Internship = require('./models/Internship');
const Payment = require('./models/Payment');
const PaymentLog = require('./models/PaymentLog');
const Announcement = require('./models/Announcement');
const Certificate = require('./models/Certificate');

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
    
    // New collections cleanup
    await User.deleteMany({});
    await Internship.deleteMany({});
    await Payment.deleteMany({});
    await PaymentLog.deleteMany({});
    await Announcement.deleteMany({});
    await Certificate.deleteMany({});
    
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

    // Sync admin to User collection
    const adminUser = new User({
      name: admin.name,
      email: admin.email,
      password: admin.password,
      role: 'admin'
    });
    await adminUser.save();

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

    // 4. Create Internships program tracks
    console.log('💻 Creating Internship Program Tracks...');
    const internships = [];
    const internshipPrograms = [
      { title: 'MERN Stack Developer', description: 'Full Stack web development using MongoDB, Express, React, and Node.js.', duration: '3 Months', price: 15000 },
      { title: 'Python Developer', description: 'Python programming, data structures, and automation scripting.', duration: '3 Months', price: 12000 },
      { title: 'AI & ML Engineer', description: 'Supervised/Unsupervised learning, neural networks, and model training.', duration: '3 Months', price: 18000 }
    ];

    for (const prog of internshipPrograms) {
      const internship = new Internship(prog);
      await internship.save();
      internships.push(internship);
    }
    console.log(`💻 Created ${internships.length} internships`);

    // 5. Create Batches
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

    // 6. Create 10 Students across departments, branches, courses, and batches
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

      // Sync student to User collection
      const studentUser = new User({
        name: student.name,
        email: student.email,
        password: student.password,
        role: 'student'
      });
      await studentUser.save();

      // Increment branch & course & batch counters
      await Branch.findOneAndUpdate({ branchName: s.branch }, { $inc: { totalStudents: 1 } });
      await Course.findOneAndUpdate({ courseName: s.course }, { $inc: { totalStudents: 1 } });
      await Batch.findOneAndUpdate({ batchName: s.batch }, { $inc: { totalStudents: 1 } });
    }
    console.log(`👨‍🎓 Created and synchronized ${students.length} students`);

    // 7. Seed Payments
    console.log('💰 Seeding Payments & Audit Logs...');
    const payments = [];
    const paymentMethods = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Bank Transfer', 'Cash'];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      // Map student course string to the corresponding seeded Internship track
      const matchingInternship = internships.find(intern => intern.title.includes(student.course)) || internships[0];

      let status = 'Paid';
      let discount = 0;

      if (student.status === 'At Risk') {
        status = 'Pending';
      } else if (student.status === 'Inactive') {
        status = 'Failed';
      } else if (i % 3 === 0) {
        status = 'Paid';
        discount = 1500;
      } else if (i % 4 === 0) {
        status = 'Refunded';
        discount = 500;
      }

      const finalAmount = matchingInternship.price - discount;
      const paymentDate = new Date();
      paymentDate.setDate(today.getDate() - (i * 3)); // Spread dates across recent weeks

      const payment = new Payment({
        studentId: student._id,
        internshipId: matchingInternship._id,
        studentName: student.name,
        email: student.email,
        phone: student.phone || '',
        internshipTitle: matchingInternship.title,
        amount: matchingInternship.price,
        discount,
        finalAmount,
        paymentType: i % 2 === 0 ? 'Online Payment' : 'Offline Payment',
        paymentMethod: paymentMethods[i % paymentMethods.length],
        transactionId: status === 'Paid' || status === 'Refunded' ? `TXN${100000 + i}` : '',
        paymentDate,
        status,
        notes: status === 'Refunded' ? 'Refunded due to customer claim.' : `Enrollment fees for ${matchingInternship.title}.`
      });
      await payment.save();
      payments.push(payment);

      // Create Payment Audit Log
      const audit = new PaymentLog({
        adminId: admin._id,
        adminName: admin.name,
        action: 'Payment Created',
        newValue: payment.toObject(),
        paymentId: payment._id,
        timestamp: paymentDate
      });
      await audit.save();
    }
    console.log(`💰 Seeded ${payments.length} payment transactions and audit logs`);

    // 8. Create 3 Sample Tasks
    console.log('📋 Creating Tasks...');
    const tasks = [];

    // Task 1: MERN Stack Routing
    const task1 = new Task({
      title: 'Vite React Routing & Axios Setup',
      description: 'Implement frontend routers using react-router-dom and configure Axios instance with API environment URL.',
      assignedTo: students.filter(s => s.course === 'MERN Stack').map(s => s._id),
      branch: 'CSE',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
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
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
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
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      priority: 'High',
      status: 'Submitted',
      submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      createdBy: admin._id
    });
    await task3.save();
    tasks.push(task3);

    console.log(`📋 Created ${tasks.length} tasks`);

    // 9. Seed Attendance logs for last 5 days
    console.log('📅 Seeding Attendance logs...');
    const attendanceRecords = [];
    const checkInTimes = ['08:45 AM', '09:02 AM', '08:50 AM', '09:12 AM', '09:40 AM'];
    const checkOutTimes = ['05:00 PM', '05:15 PM', '05:30 PM', '05:05 PM', '04:55 PM'];

    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const recordDate = new Date();
      recordDate.setDate(today.getDate() - dayOffset);
      recordDate.setHours(0, 0, 0, 0);

      if (recordDate.getDay() === 0) continue;

      for (const student of students) {
        if (student.status === 'Inactive' && Math.random() > 0.15) {
          continue;
        }

        if (student.status === 'At Risk' && Math.random() > 0.6) {
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
          remarks: isLate ? 'Checked in late due to transport delay' : 'On time',
          markedByStudent: Math.random() > 0.5
        });
        await att.save();
        attendanceRecords.push(att);
      }
    }
    console.log(`📅 Generated ${attendanceRecords.length} attendance records`);

    // 10. Seed Task Submissions
    console.log('🚀 Seeding Task Submissions...');
    const aiStudents = students.filter(s => s.course === 'AI & ML');
    for (const student of aiStudents) {
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

    // 11. Seed Notifications & Announcements
    console.log('📢 Seeding Announcements...');
    const announce1 = new Announcement({
      title: 'Internship Payment Audits',
      content: 'Please ensure all payments are completed by the end of this week. Online methods (UPI, Credit Cards) are preferred.',
      postedBy: admin._id,
      targetAudience: 'All'
    });
    await announce1.save();
    
    const announce2 = new Announcement({
      title: 'MERN Stack Project Review',
      content: 'MERN Stack interns have their first project milestone review on Friday. Be ready with your Github repositories.',
      postedBy: admin._id,
      targetAudience: 'MERN Stack'
    });
    await announce2.save();

    console.log('🔔 Seeding Notifications...');
    const notif1 = new Notification({
      recipient: students[0]._id,
      recipientModel: 'Student',
      title: 'Welcome to Tech Vaseegrah Student Portal',
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

    // 12. Seed Certificates
    console.log('🎓 Seeding Certificates...');
    const activeMernStudent = students.find(s => s.status === 'Active' && s.course === 'MERN Stack');
    if (activeMernStudent) {
      const mernInternship = internships.find(intern => intern.title.includes('MERN Stack')) || internships[0];
      const cert = new Certificate({
        studentId: activeMernStudent._id,
        internshipId: mernInternship._id,
        certificateNumber: `TV-MERN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        issueDate: new Date(),
        pdfUrl: 'https://techvaseegrah.com/certificates/sample.pdf'
      });
      await cert.save();
    }

    // 13. Seed Report
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
