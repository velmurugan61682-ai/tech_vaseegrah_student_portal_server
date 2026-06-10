const Branch = require('../models/Branch');
const Student = require('../models/Student');

// @desc    Get all branches with student count
// @route   GET /api/branches
exports.getBranches = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ branchName: 1 });
    
    // Dynamically recalculate counts just in case cache is desynced
    const students = await Student.find();
    
    const countMap = {};
    students.forEach(s => {
      if (s.branch) {
        const key = s.branch.toUpperCase().trim();
        countMap[key] = (countMap[key] || 0) + 1;
      }
    });

    const updatedBranches = [];
    for (const b of branches) {
      const actualCount = countMap[b.branchName.toUpperCase().trim()] || 0;
      if (b.totalStudents !== actualCount) {
        b.totalStudents = actualCount;
        await b.save();
      }
      updatedBranches.push(b);
    }

    res.status(200).json({ success: true, branches: updatedBranches, data: updatedBranches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new branch
// @route   POST /api/branches
exports.createBranch = async (req, res) => {
  try {
    const { branchName, description } = req.body;
    if (!branchName) {
      return res.status(400).json({ success: false, message: 'Please provide branch name' });
    }

    const nameUpper = branchName.toUpperCase().trim();
    const existing = await Branch.findOne({ branchName: nameUpper });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Branch already exists' });
    }

    const totalStudents = await Student.countDocuments({ branch: nameUpper });

    const branch = new Branch({
      branchName: nameUpper,
      description: description || '',
      totalStudents
    });

    await branch.save();
    res.status(201).json({ success: true, message: 'Branch created successfully', branch, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update branch
// @route   PUT /api/branches/:id
exports.updateBranch = async (req, res) => {
  try {
    const { branchName, description } = req.body;
    
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const oldName = branch.branchName;

    if (branchName) {
      const nameUpper = branchName.toUpperCase().trim();
      if (nameUpper !== oldName) {
        const existing = await Branch.findOne({ branchName: nameUpper });
        if (existing) {
          return res.status(400).json({ success: false, message: 'Another branch already has this name' });
        }
        branch.branchName = nameUpper;
        
        // Propagate branch name changes to Students
        await Student.updateMany({ branch: oldName }, { branch: nameUpper });
      }
    }

    if (description !== undefined) branch.description = description;

    // Recalculate total students count
    branch.totalStudents = await Student.countDocuments({ branch: branch.branchName });

    await branch.save();
    res.status(200).json({ success: true, message: 'Branch updated successfully', branch, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete branch
// @route   DELETE /api/branches/:id
exports.deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // Set matching students branch value to '' or 'Unassigned'
    await Student.updateMany({ branch: branch.branchName }, { branch: '' });

    await Branch.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
