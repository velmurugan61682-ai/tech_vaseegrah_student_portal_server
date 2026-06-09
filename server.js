const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser with 10mb limit for profile images (Base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Enable CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://tech-vaseegrah-student-portal-client-cn8627vb2.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Route files
const auth = require('./routes/authRoutes');
const students = require('./routes/studentRoutes');
const attendance = require('./routes/attendanceRoutes');
const tasks = require('./routes/taskRoutes');
const submissions = require('./routes/submissionRoutes');

// Mount routers
app.use('/api/auth', auth);
app.use('/api/students', students);
app.use('/api/attendance', attendance);
app.use('/api/tasks', tasks);
app.use('/api/submissions', submissions);

// Basic test route
app.get('/', (req, res) => {
  res.send('InternHub API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
});
