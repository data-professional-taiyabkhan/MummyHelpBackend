const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

// Validation rules
const updateProfileValidation = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email')
];

const pairingValidation = [
  body('pairingCode').isLength({ min: 6, max: 6 }).withMessage('Pairing code must be exactly 6 digits')
];

// GET /api/users/profile - Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
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

// PUT /api/users/profile - Update current user profile
router.put('/profile', authenticateToken, updateProfileValidation, async (req, res) => {
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

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== req.userId) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }
    }

    const user = await User.findById(req.userId);
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

// GET /api/users/pairing-code - Get pairing code (for children)
router.get('/pairing-code', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
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

    // Generate new pairing code if not exists
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

// POST /api/users/pair - Pair with another user using pairing code
router.post('/pair', authenticateToken, pairingValidation, async (req, res) => {
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
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find user with the pairing code
    const targetUser = await User.findByPairingCode(pairingCode);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Invalid pairing code'
      });
    }

    // Check if users are already paired
    if (currentUser.isPaired || targetUser.isPaired) {
      return res.status(400).json({
        success: false,
        message: 'One or both users are already paired'
      });
    }

    // Check if trying to pair with self
    if (currentUser.id === targetUser.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot pair with yourself'
      });
    }

    // Check if roles are compatible (mother can only pair with child and vice versa)
    if (currentUser.role === targetUser.role) {
      return res.status(400).json({
        success: false,
        message: 'Cannot pair users with the same role'
      });
    }

    // Perform pairing
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

// DELETE /api/users/unpair - Unpair from current user
router.delete('/unpair', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!currentUser.isPaired) {
      return res.status(400).json({
        success: false,
        message: 'User is not paired with anyone'
      });
    }

    // Get paired user
    const pairedUser = await User.findById(currentUser.pairedWith);
    
    // Unpair both users
    await currentUser.update({
      is_paired: false,
      paired_with: null
    });

    if (pairedUser) {
      await pairedUser.update({
        is_paired: false,
        paired_with: null
      });
    }

    res.json({
      success: true,
      message: 'Users unpaired successfully'
    });
  } catch (error) {
    console.error('Unpair users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/users/paired-user - Get information about paired user
router.get('/paired-user', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!currentUser.isPaired) {
      return res.status(404).json({
        success: false,
        message: 'User is not paired with anyone'
      });
    }

    const pairedUser = await User.findById(currentUser.pairedWith);
    if (!pairedUser) {
      return res.status(404).json({
        success: false,
        message: 'Paired user not found'
      });
    }

    res.json({
      success: true,
      data: {
        pairedUser: {
          id: pairedUser.id,
          name: pairedUser.name,
          role: pairedUser.role,
          lastLogin: pairedUser.lastLogin,
          lastSeen: pairedUser.lastSeen,
          createdAt: pairedUser.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get paired user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/users/all - Get all users (for admin purposes)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all users from database
    const { data: users, error } = require('../config/database').supabase
      .from('users')
      .select('id, email, name, role, is_paired, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: {
        users: users || []
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/users/last-seen - Update user's last seen time
router.put('/last-seen', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update last seen time
    const updatedUser = await User.update(req.userId, {
      lastSeen: new Date().toISOString()
    });

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update last seen time'
      });
    }

    res.json({
      success: true,
      message: 'Last seen time updated successfully',
      data: {
        lastSeen: updatedUser.lastSeen
      }
    });
  } catch (error) {
    console.error('Update last seen error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router; 