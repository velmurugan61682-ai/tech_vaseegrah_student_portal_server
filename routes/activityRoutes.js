const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const activityController = require('../controllers/activityController');

router.get('/', verifyToken, verifyAdmin, activityController.getActivities);
router.get('/stats', verifyToken, verifyAdmin, activityController.getActivityStats);
router.get('/today', verifyToken, verifyAdmin, activityController.getTodayActivities);

module.exports = router;
