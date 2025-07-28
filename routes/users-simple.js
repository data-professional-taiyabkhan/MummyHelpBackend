const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// NO AUTHENTICATION - Just for testing!

// GET /api/users/profile - Get user profile (NO AUTH REQUIRED)
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/users/profile - Update user profile (NO AUTH REQUIRED)
router.put('/profile/:userId', [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = await user.update(updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser.toJSON()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/users/pairing-code - Get pairing code (NO AUTH REQUIRED)
router.get('/pairing-code/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'child') {
      return res.status(403).json({
        success: false,
        message: 'Only children can generate pairing codes'
      });
    }

    if (!user.pairingCode) {
      await user.generatePairingCode();
    }

    res.json({
      success: true,
      data: {
        pairingCode: user.pairingCode
      }
    });
  } catch (error) {
    console.error('Get pairing code error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/users/pair - Pair with another user (NO AUTH REQUIRED)
router.post('/pair/:userId', [
  body('pairingCode').isLength({ min: 6, max: 6 }).withMessage('Pairing code must be exactly 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { pairingCode } = req.body;
    const currentUser = await User.findById(req.params.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUser = await User.findByPairingCode(pairingCode);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Invalid pairing code'
      });
    }

    if (currentUser.isPaired || targetUser.isPaired) {
      return res.status(400).json({
        success: false,
        message: 'One or both users are already paired'
      });
    }

    if (currentUser.id === targetUser.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot pair with yourself'
      });
    }

    if (currentUser.role === targetUser.role) {
      return res.status(400).json({
        success: false,
        message: 'Cannot pair users with the same role'
      });
    }

    await currentUser.update({
      is_paired: true,
      paired_with: targetUser.id
    });

    await targetUser.update({
      is_paired: true,
      paired_with: currentUser.id
    });

    res.json({
      success: true,
      message: 'Users paired successfully',
      data: {
        pairedUser: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role
        }
      }
    });
  } catch (error) {
    console.error('Pair users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router; 