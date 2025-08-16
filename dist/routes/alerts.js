const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Alert = require('../models/Alert');
const Location = require('../models/Location');
const pushService = require('../services/push');

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
const createAlertValidation = [
  body('type').isIn(['emergency', 'help', 'check-in']).withMessage('Alert type must be emergency, help, or check-in'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
  body('location').optional().trim().isLength({ max: 200 }).withMessage('Location must be less than 200 characters'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180'),
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number'),
  body('address').optional().trim().isLength({ max: 500 }).withMessage('Address must be less than 500 characters')
];

// Database storage for alerts (replaced in-memory storage)

// POST /api/alerts/create - Create a new emergency alert
router.post('/create', authenticateToken, createAlertValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { type, message, location, latitude, longitude, accuracy, address } = req.body;
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is paired
    if (!currentUser.isPaired) {
      return res.status(400).json({
        success: false,
        message: 'You must be paired with someone to send alerts'
      });
    }

    // Create alert in database
    const alertData = {
      userId: currentUser.id,
      type,
      message: message || '',
      location: location || '',
      latitude: latitude || null,
      longitude: longitude || null,
      accuracy: accuracy || null,
      address: address || null,
      status: 'active'
    };

    const alert = await Alert.create(alertData);

    // Get paired user info
    const pairedUser = await User.findById(currentUser.pairedWith);

    // Send push notification to parent
    if (pairedUser) {
      try {
        await pushService.notifyParentOnAlert(alert.id, currentUser.id);
        console.log(`Push notification sent to parent ${pairedUser.id} for alert ${alert.id}`);
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
        // Don't fail the alert creation if push fails
      }
    }

    // If location data provided, create initial location entry
    if (latitude && longitude) {
      try {
        await Location.create({
          userId: currentUser.id,
          alertId: alert.id,
          latitude,
          longitude,
          accuracy,
          heading: null,
          speed: null,
          altitude: null,
          address
        });
        console.log(`Initial location recorded for alert ${alert.id}`);
      } catch (locationError) {
        console.error('Failed to record initial location:', locationError);
        // Don't fail the alert creation if location recording fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: {
        alert: {
          ...alert.toJSON(),
          pairedUser: pairedUser ? {
            id: pairedUser.id,
            name: pairedUser.name,
            role: pairedUser.role
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/alerts/my-alerts - Get current user's alerts
router.get('/my-alerts', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's alerts from database
    const userAlerts = await Alert.findByUserId(currentUser.id);

    res.json({
      success: true,
      data: {
        alerts: userAlerts
      }
    });
  } catch (error) {
    console.error('Get my alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/alerts/paired-alerts - Get alerts from paired user
router.get('/paired-alerts', authenticateToken, async (req, res) => {
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
        message: 'You are not paired with anyone'
      });
    }

    // Get alerts from paired user from database
    const pairedAlerts = await Alert.findByPairedUserId(currentUser.pairedWith);

    res.json({
      success: true,
      data: {
        alerts: pairedAlerts
      }
    });
  } catch (error) {
    console.error('Get paired alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/alerts/:alertId/acknowledge - Acknowledge an alert
router.put('/:alertId/acknowledge', authenticateToken, async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user is paired with the alert sender
    if (alert.userId !== currentUser.pairedWith) {
      return res.status(403).json({
        success: false,
        message: 'You can only acknowledge alerts from your paired user'
      });
    }

    // Update alert status in database
    const updatedAlert = await alert.acknowledge(currentUser.id);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alert: updatedAlert.toJSON()
      }
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// DELETE /api/alerts/:alertId - Delete an alert
router.delete('/:alertId', authenticateToken, async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user owns the alert
    if (alert.userId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own alerts'
      });
    }

    // Delete alert from database
    await alert.delete();

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/alerts/active - Get all active alerts (for monitoring)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all active alerts from database
    const activeAlerts = await Alert.findActive();

    res.json({
      success: true,
      data: {
        alerts: activeAlerts
      }
    });
  } catch (error) {
    console.error('Get active alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// PUT /api/alerts/:alertId/cancel - Cancel an alert
router.put('/:alertId/cancel', authenticateToken, async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user owns the alert
    if (alert.userId !== currentUser.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own alerts'
      });
    }

    // Cancel alert in database
    const cancelledAlert = await alert.cancel();

    res.json({
      success: true,
      message: 'Alert cancelled successfully',
      data: {
        alert: cancelledAlert.toJSON()
      }
    });
  } catch (error) {
    console.error('Cancel alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router; 