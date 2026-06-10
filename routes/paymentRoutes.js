const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// Shared route for student and admin
router.get('/internships', verifyToken, paymentController.getInternships);

// Admin only routes
router.get('/', verifyToken, verifyAdmin, paymentController.getPayments);
router.post('/', verifyToken, verifyAdmin, paymentController.createPayment);
router.put('/:id', verifyToken, verifyAdmin, paymentController.updatePayment);
router.delete('/:id', verifyToken, verifyAdmin, paymentController.deletePayment);
router.patch('/status/:id', verifyToken, verifyAdmin, paymentController.updatePaymentStatus);
router.get('/analytics', verifyToken, verifyAdmin, paymentController.getPaymentAnalytics);

// Student route to see their own payments
router.get('/student', verifyToken, paymentController.getStudentPayments);

module.exports = router;
