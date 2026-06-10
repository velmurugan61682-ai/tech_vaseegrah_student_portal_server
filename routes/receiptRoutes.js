const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// Shared routes
router.get('/student', verifyToken, receiptController.getStudentReceipts);
router.get('/:id', verifyToken, receiptController.getReceiptDetails);

// Admin only routes
router.get('/', verifyToken, verifyAdmin, receiptController.getReceipts);
router.put('/:id', verifyToken, verifyAdmin, receiptController.updateReceipt);
router.delete('/:id', verifyToken, verifyAdmin, receiptController.deleteReceipt);
router.post('/:id/pdf', verifyToken, verifyAdmin, receiptController.generateReceiptPDF);
router.post('/:id/send', verifyToken, verifyAdmin, receiptController.sendReceiptEmail);

module.exports = router;
