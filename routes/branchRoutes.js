const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, verifyAdmin, branchController.getBranches);
router.post('/', verifyToken, verifyAdmin, branchController.createBranch);
router.put('/:id', verifyToken, verifyAdmin, branchController.updateBranch);
router.delete('/:id', verifyToken, verifyAdmin, branchController.deleteBranch);

module.exports = router;
