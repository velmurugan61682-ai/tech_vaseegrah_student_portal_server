const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');

// Initialize Express
const app = express();

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] 🚀 Request: ${req.method} ${req.url}`);
  next();
});

// Configure CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://tech-vaseegrah-student-portal-client.vercel.app',
  'https://tech-vaseegrah-student-portal-clien.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, '');
    const cleanEnvClient = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/+$/, '') : null;
    
    if (allowedOrigins.includes(cleanOrigin) || (cleanEnvClient && cleanOrigin === cleanEnvClient)) {
      return callback(null, true);
    }
    if (/^http:\/\/localhost:\d+$/.test(cleanOrigin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive fallback supporting credentials
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to Database
connectDB();

// Create HTTP Server for Socket.IO binding
const server = http.createServer(app);

// Setup Socket.IO
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

// Socket.IO event handler
io.on('connection', (socket) => {
  console.log(`📡 Real-time Socket Client Connected: ${socket.id}`);

  // Students/Admins join unique private room matching their mongoDB ID
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`👥 User ${userId} joined their socket room: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`📡 Real-time Socket Client Disconnected: ${socket.id}`);
  });
});

// Attach socket io instance to request object so controllers can access it
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/receipts', require('./routes/receiptRoutes'));

// Serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global Server Error:', err);
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Email already registered'
    });
  }
  
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please login again.'
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Something went wrong'
  });
});

// Start Server
let PORT = parseInt(process.env.PORT, 10) || 5050;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    PORT++;
    console.log(`Port ${PORT - 1} busy, trying ${PORT}`);
    server.listen(PORT);
  }
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  server.close(() => process.exit(0));
});
