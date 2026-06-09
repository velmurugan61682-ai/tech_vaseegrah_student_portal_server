const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Admin = require('./models/Admin');
const Department = require('./models/Department');
const Batch = require('./models/Batch');
const Student = require('./models/Student');
const Task = require('./models/Task');
const TaskSubmission = require('./models/TaskSubmission');
const Attendance = require('./models/Attendance');

const seed = async () => {
  try {
    console.log('🔌 Connecting to database for seeding...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');

    // Clean up existing database collections
    console.log('🧹 Clearing existing database collections...');
    await Admin.deleteMany({});
    await Department.deleteMany({});
    await Batch.deleteMany({});
    await Student.deleteMany({});
    await Task.deleteMany({});
    await TaskSubmission.deleteMany({});
    await Attendance.deleteMany({});
    console.log('🧹 Cleaned database collections');

    // 1. Create Admin
    console.log('👤 Creating Admin...');
    const admin = new Admin({
      name: 'Super Admin',
      email: 'admin@techvaseegrah.com',
      password: 'Admin@123',
      role: 'admin'
    });
    await admin.save();
    console.log('👤 Admin created');

    // 2. Create Departments
    console.log('🏢 Creating Departments...');
    const deptsData = [
      { name: 'Computer Science and Engineering', code: 'CSE' },
      { name: 'Electronics and Communication Engineering', code: 'ECE' },
      { name: 'Mechanical Engineering', code: 'MECH' },
      { name: 'Information Technology', code: 'IT' },
      { name: 'Artificial Intelligence and Data Science', code: 'AIDS' }
    ];
    const depts = [];
    for (const d of deptsData) {
      const dept = new Department(d);
      await dept.save();
      depts.push(dept);
    }
    console.log(`🏢 Created ${depts.length} departments`);

    // 3. Create Batches (2024-26 and 2023-25 for each dept)
    console.log('👥 Creating Batches...');
    const batches = [];
    for (const dept of depts) {
      const b1 = new Batch({
        name: '2024-26',
        year: 2024,
        department: dept._id
      });
      const b2 = new Batch({
        name: '2023-25',
        year: 2023,
        department: dept._id
      });
      await b1.save();
      await b2.save();
      batches.push(b1, b2);
    }
    console.log(`👥 Created ${batches.length} batches`);

    // 4. Create 10 Students across departments and batches
    console.log('👨‍🎓 Creating Students...');
    const studentsData = [
      { name: 'John Doe', email: 'john@techvaseegrah.com', rollNumber: 'TVP24CSE01', deptIndex: 0, batchIndex: 0 }, // CSE 2024-26
      { name: 'Jane Smith', email: 'jane@techvaseegrah.com', rollNumber: 'TVP24CSE02', deptIndex: 0, batchIndex: 0 }, // CSE 2024-26
      { name: 'Alice Johnson', email: 'alice@techvaseegrah.com', rollNumber: 'TVP23ECE01', deptIndex: 1, batchIndex: 3 }, // ECE 2023-25
      { name: 'Bob Wilson', email: 'bob@techvaseegrah.com', rollNumber: 'TVP23ECE02', deptIndex: 1, batchIndex: 3 }, // ECE 2023-25
      { name: 'Charlie Brown', email: 'charlie@techvaseegrah.com', rollNumber: 'TVP24MECH01', deptIndex: 2, batchIndex: 4 }, // MECH 2024-26
      { name: 'David Miller', email: 'david@techvaseegrah.com', rollNumber: 'TVP23MECH02', deptIndex: 2, batchIndex: 5 }, // MECH 2023-25
      { name: 'Emma Davis', email: 'emma@techvaseegrah.com', rollNumber: 'TVP24IT01', deptIndex: 3, batchIndex: 6 }, // IT 2024-26
      { name: 'Frank Harris', email: 'frank@techvaseegrah.com', rollNumber: 'TVP23IT02', deptIndex: 3, batchIndex: 7 }, // IT 2023-25
      { name: 'Grace Lee', email: 'grace@techvaseegrah.com', rollNumber: 'TVP24AIDS01', deptIndex: 4, batchIndex: 8 }, // AIDS 2024-26
      { name: 'Henry Taylor', email: 'henry@techvaseegrah.com', rollNumber: 'TVP23AIDS02', deptIndex: 4, batchIndex: 9 } // AIDS 2023-25
    ];

    const students = [];
    for (const s of studentsData) {
      const studentDept = depts[s.deptIndex];
      // batches are created sequentially, 2 per dept: CSE: 0, 1; ECE: 2, 3; MECH: 4, 5; IT: 6, 7; AIDS: 8, 9
      const studentBatch = batches[s.batchIndex];

      const student = new Student({
        name: s.name,
        email: s.email,
        password: 'Student@123',
        rollNumber: s.rollNumber,
        department: studentDept._id,
        batch: studentBatch._id,
        isActive: true,
        profileImage: ''
      });
      await student.save();
      students.push(student);
    }
    console.log(`👨‍🎓 Created ${students.length} students`);

    // 5. Create 3 Sample Tasks
    console.log('📋 Creating Tasks...');
    
    // Task 1: Assigned to all CSE 2024-26 Students (John, Jane)
    const cseDept = depts[0];
    const cse2024Batch = batches[0];
    const cseStudents = students.filter(s => s.department.toString() === cseDept._id.toString() && s.batch.toString() === cse2024Batch._id.toString());
    
    const task1 = new Task({
      title: 'MERN Stack - React Routing & Axios Integration',
      description: 'Implement frontend routes using react-router-dom v6 and configure Axios interceptors for handling access tokens.',
      department: cseDept._id,
      batch: cse2024Batch._id,
      assignedTo: cseStudents.map(s => s._id),
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      createdBy: admin._id
    });
    await task1.save();

    // Task 2: Assigned to ECE 2023-25 (Alice, Bob)
    const eceDept = depts[1];
    const ece2023Batch = batches[3];
    const eceStudents = students.filter(s => s.department.toString() === eceDept._id.toString() && s.batch.toString() === ece2023Batch._id.toString());

    const task2 = new Task({
      title: 'IoT Sensor Node Configuration',
      description: 'Program an ESP32 node to fetch local ambient temperature and push readings to an MQTT broker.',
      department: eceDept._id,
      batch: ece2023Batch._id,
      assignedTo: eceStudents.map(s => s._id),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      createdBy: admin._id
    });
    await task2.save();

    // Task 3: Assigned to everyone in AIDS 2024-26 (Grace)
    const aidsDept = depts[4];
    const aids2024Batch = batches[8];
    const aidsStudents = students.filter(s => s.department.toString() === aidsDept._id.toString() && s.batch.toString() === aids2024Batch._id.toString());

    const task3 = new Task({
      title: 'Data Preprocessing and Exploratory Analysis',
      description: 'Load the house prices dataset, clean missing entries, identify outliers, and visualize features correlation heatmap.',
      department: aidsDept._id,
      batch: aids2024Batch._id,
      assignedTo: aidsStudents.map(s => s._id),
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
      createdBy: admin._id
    });
    await task3.save();

    console.log('📋 Tasks created');
    console.log('✅ Seeded! Admin: admin@techvaseegrah.com / Admin@123');
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seed();
