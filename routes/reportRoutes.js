const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, verifyAdmin, reportController.getReportsHistory);
router.post('/', verifyToken, verifyAdmin, reportController.saveReportLog);

module.exports = router;
