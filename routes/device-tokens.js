const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const DeviceToken = require('../models/DeviceToken');
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
const registerTokenValidation = [
  body('platform').isIn(['ios', 'android', 'web']).withMessage('Platform must be ios, android, or web'),
  body('expoPushToken').notEmpty().withMessage('Expo push token is required')
];

// POST /api/device-tokens - Register a new device token
router.post('/', authenticateToken, registerTokenValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { platform, expoPushToken } = req.body;
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if token already exists for this user and platform
    const existingToken = await DeviceToken.findByExpoToken(expoPushToken);
    if (existingToken) {
      // Update existing token if it belongs to a different user
      if (existingToken.userId !== userId) {
        await existingToken.update({ user_id: userId });
        console.log(`Updated device token ownership from user ${existingToken.userId} to ${userId}`);
      }
      
      return res.json({
        success: true,
        message: 'Device token already registered',
        data: {
          deviceToken: existingToken.toJSON()
        }
      });
    }

    // Create new device token
    const tokenData = {
      userId: userId,
      platform: platform,
      expoPushToken: expoPushToken
    };

    const deviceToken = await DeviceToken.create(tokenData);

    console.log(`Registered device token for user ${userId} on platform ${platform}`);

    res.status(201).json({
      success: true,
      message: 'Device token registered successfully',
      data: {
        deviceToken: deviceToken.toJSON()
      }
    });

  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/device-tokens - Get all device tokens for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's device tokens
    const deviceTokens = await DeviceToken.findByUserId(userId);

    res.json({
      success: true,
      data: {
        deviceTokens: deviceTokens.map(token => token.toJSON())
      }
    });

  } catch (error) {
    console.error('Get device tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/device-tokens/:id - Get specific device token
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const tokenId = req.params.id;
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get device token
    const deviceToken = await DeviceToken.findById(tokenId);
    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found'
      });
    }

    // Check if token belongs to user
    if (deviceToken.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Token does not belong to user.'
      });
    }

    res.json({
      success: true,
      data: {
        deviceToken: deviceToken.toJSON()
      }
    });

  } catch (error) {
    console.error('Get device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/device-tokens/:id - Update device token
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const tokenId = req.params.id;
    const userId = req.userId;
    const { platform, expoPushToken } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get device token
    const deviceToken = await DeviceToken.findById(tokenId);
    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found'
      });
    }

    // Check if token belongs to user
    if (deviceToken.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Token does not belong to user.'
      });
    }

    // Update token
    const updateData = {};
    if (platform) updateData.platform = platform;
    if (expoPushToken) updateData.expo_push_token = expoPushToken;

    const updatedToken = await deviceToken.update(updateData);

    console.log(`Updated device token ${tokenId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Device token updated successfully',
      data: {
        deviceToken: updatedToken.toJSON()
      }
    });

  } catch (error) {
    console.error('Update device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// DELETE /api/device-tokens/:id - Delete specific device token
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const tokenId = req.params.id;
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get device token
    const deviceToken = await DeviceToken.findById(tokenId);
    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found'
      });
    }

    // Check if token belongs to user
    if (deviceToken.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Token does not belong to user.'
      });
    }

    // Delete token
    await deviceToken.delete();

    console.log(`Deleted device token ${tokenId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Device token deleted successfully'
    });

  } catch (error) {
    console.error('Delete device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// DELETE /api/device-tokens - Delete all device tokens for current user
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete all user's device tokens
    await DeviceToken.deleteByUserId(userId);

    console.log(`Deleted all device tokens for user ${userId}`);

    res.json({
      success: true,
      message: 'All device tokens deleted successfully'
    });

  } catch (error) {
    console.error('Delete all device tokens error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/device-tokens/validate - Validate a push token
router.post('/validate', async (req, res) => {
  try {
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        success: false,
        message: 'Expo push token is required'
      });
    }

    // Check if token exists in database
    const deviceToken = await DeviceToken.findByExpoToken(expoPushToken);
    
    if (deviceToken) {
      // Get user info
      const user = await User.findById(deviceToken.userId);
      
      res.json({
        success: true,
        message: 'Token is valid and registered',
        data: {
          isValid: true,
          isRegistered: true,
          userId: deviceToken.userId,
          platform: deviceToken.platform,
          user: user ? user.toJSON() : null
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Token is valid but not registered',
        data: {
          isValid: true,
          isRegistered: false
        }
      });
    }

  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
