const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const taskController = require('../controllers/taskController');
const { verifyToken, verifyAdmin, verifyStudent } = require('../middleware/authMiddleware');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer upload middleware
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // max size 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files (PNG, JPG, JPEG) are allowed for screenshots!'), false);
      }
    } else if (file.fieldname === 'document') {
      const allowedExts = ['.pdf', '.docx', '.doc'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return cb(new Error('Only PDF or DOCX files are allowed for documents!'), false);
      }
    }
    cb(null, true);
  }
});

// Routes
router.get('/performance', verifyToken, verifyAdmin, taskController.getPerformanceAnalytics);
router.get('/my', verifyToken, verifyStudent, taskController.getMyTasks);
router.get('/student/:studentId/submissions', verifyToken, verifyAdmin, taskController.getStudentSubmissions);
router.get('/:id/submissions', verifyToken, verifyAdmin, taskController.getTaskSubmissions);
router.post('/', verifyToken, verifyAdmin, taskController.createTask);
router.get('/', verifyToken, verifyAdmin, taskController.getAllTasks);

// Submit task
router.put('/:id/submit', verifyToken, verifyStudent, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]), taskController.submitTaskSolution);

// Review submissions
router.put('/:id/review', verifyToken, verifyAdmin, taskController.reviewTaskSubmission);
router.put('/:id/approve', verifyToken, verifyAdmin, taskController.approveSubmission);
router.put('/:id/reject', verifyToken, verifyAdmin, taskController.rejectSubmission);
router.put('/:id', verifyToken, verifyAdmin, taskController.updateTask);
router.delete('/:id', verifyToken, verifyAdmin, taskController.deleteTask);

module.exports = router;
