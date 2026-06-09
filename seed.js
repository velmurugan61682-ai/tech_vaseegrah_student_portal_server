const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Attendance = require('./models/Attendance');
const Task = require('./models/Task');
const Submission = require('./models/Submission');

// Load environment variables
dotenv.config();

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    // Drop old unique index if it exists in the users collection to prevent conflicts
    try {
      await mongoose.connection.db.collection('users').dropIndex('username_1');
      console.log('Dropped old index username_1 successfully.');
    } catch (e) {
      console.log('Old index username_1 did not exist or could not be dropped, skipping.');
    }

    // Clear existing collections
    console.log('Clearing database collections...');
    await User.deleteMany({});
    await Attendance.deleteMany({});
    await Task.deleteMany({});
    await Submission.deleteMany({});

    console.log('Inserting seed records...');

    // 1. Create Admin
    const admin = await User.create({
      name: 'Admin Provider',
      email: 'admin@internhub.com',
      password: 'password123',
      phone: '9876543210',
      role: 'admin'
    });
    console.log('Admin user created (email: admin@internhub.com, password: password123)');

    // 2. Create Students
    const studentsData = [
      {
        name: 'John Doe',
        email: 'john@internhub.com',
        password: 'password123',
        phone: '9123456780',
        role: 'student',
        college: 'SRM University',
        branch: 'CSE',
        course: 'MERN Stack',
        batch: '2026',
        profilePhoto: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=60'
      },
      {
        name: 'Jane Smith',
        email: 'jane@internhub.com',
        password: 'password123',
        phone: '9234567890',
        role: 'student',
        college: 'VIT Chennai',
        branch: 'IT',
        course: 'Python',
        batch: '2025',
        profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=60'
      },
      {
        name: 'Alice Johnson',
        email: 'alice@internhub.com',
        password: 'password123',
        phone: '9345678901',
        role: 'student',
        college: 'Anna University',
        branch: 'ECE',
        course: 'Java',
        batch: '2026',
        profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=60'
      },
      {
        name: 'Bob Brown',
        email: 'bob@internhub.com',
        password: 'password123',
        phone: '9456789012',
        role: 'student',
        college: 'IIT Madras',
        branch: 'CSE',
        course: 'AI & ML',
        batch: '2026',
        profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=60'
      },
      {
        name: 'Charlie Green',
        email: 'charlie@internhub.com',
        password: 'password123',
        phone: '9567890123',
        role: 'student',
        college: 'PSG Tech',
        branch: 'EEE',
        course: 'MERN Stack',
        batch: '2025',
        profilePhoto: ''
      }
    ];

    const students = await User.create(studentsData);
    console.log(`Created ${students.length} student records (password for all: password123)`);

    // 3. Create historical attendance logs
    const today = new Date();
    
    // Helper to format date offset
    const getFormattedOffsetDate = (daysAgo) => {
      const d = new Date(today);
      d.setDate(today.getDate() - daysAgo);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      return local.toISOString().split('T')[0];
    };

    const attendanceRecords = [];
    
    // Create attendance logs for the last 5 days
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const dateStr = getFormattedOffsetDate(dayOffset);
      
      students.forEach((student, idx) => {
        // Leave some students absent or unmarked on certain days
        if (dayOffset === 0 && idx === 4) return; // Charlie unmarked today
        
        let status = 'present';
        if (dayOffset === 1 && idx === 2) status = 'absent'; // Alice absent yesterday
        if (dayOffset === 3 && idx === 1) status = 'absent'; // Jane absent 3 days ago

        attendanceRecords.push({
          studentId: student._id,
          date: dateStr,
          status,
          markedByStudent: true,
          markedAt: new Date(new Date(dateStr + 'T09:15:00').getTime() + (idx * 5 * 60 * 1000)) // staggered morning time
        });
      });
    }

    await Attendance.create(attendanceRecords);
    console.log(`Created ${attendanceRecords.length} historical attendance logs`);

    // 4. Create Tasks
    const oneDay = 24 * 60 * 60 * 1000;
    const taskList = [
      {
        title: 'React Hooks and State Management',
        description: 'Read the documentation about useState and useEffect. Implement a dynamic counter component that increments and decrements, and fetches a random quote from an API inside useEffect on load.',
        assignedTo: 'all',
        dueDate: new Date(today.getTime() + 2 * oneDay),
        priority: 'High',
        createdBy: admin._id
      },
      {
        title: 'Node.js Express Server Setup',
        description: 'Initialize a new Node.js server. Install express, dotenv, cors, and nodemon. Setup a basic server listening on Port 5000 with a clean test endpoint "/" returning a success message.',
        assignedTo: 'course',
        course: 'MERN Stack',
        dueDate: new Date(today.getTime() + 1 * oneDay),
        priority: 'Medium',
        createdBy: admin._id
      },
      {
        title: 'Java Object-Oriented Exercises',
        description: 'Create a Base class "Person" with properties name and age. Inherit "Student" and "Instructor" classes. Implement polymorphism with a virtual method "getDetails()". Verify using console outputs.',
        assignedTo: 'course',
        course: 'Java',
        dueDate: new Date(today.getTime() + 3 * oneDay),
        priority: 'Low',
        createdBy: admin._id
      }
    ];

    const tasks = await Task.create(taskList);
    console.log(`Published ${tasks.length} internship objectives`);

    // 5. Create Task Submissions
    const submissionsData = [
      {
        taskId: tasks[1]._id, // MERN Express task
        studentId: students[0]._id, // John Doe (MERN Stack)
        submissionText: 'I have completed the server setup. The code installs all listed modules. The test endpoint successfully responds at http://localhost:5000/ and handles CORS headers. Github repository link: https://github.com/johndoe/internhub-express-server',
        submittedAt: new Date(today.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
        status: 'approved',
        adminFeedback: 'Excellent project structure and package setups. Good job!'
      },
      {
        taskId: tasks[1]._id, // MERN Express task
        studentId: students[4]._id, // Charlie Green (MERN Stack)
        submissionText: 'I set up the express backend on Port 5000. It starts correctly. However, I am still troubleshooting CORS block errors when calling it from my frontend workspace. I will resolve and update soon.',
        submittedAt: new Date(today.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        status: 'pending'
      }
    ];

    await Submission.create(submissionsData);
    console.log('Populated task submissions log');

    console.log('Seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding failure:', error);
    process.exit(1);
  }
};

seedData();
