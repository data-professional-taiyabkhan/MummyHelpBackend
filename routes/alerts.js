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
const createAlertValidation = [
  body('type').isIn(['emergency', 'help', 'check-in']).withMessage('Alert type must be emergency, help, or check-in'),
  body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
  body('location').optional().trim().isLength({ max: 200 }).withMessage('Location must be less than 200 characters')
];

// In-memory storage for alerts (in production, use database)
const alerts = new Map();
let alertIdCounter = 1;

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

    const { type, message, location } = req.body;
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

    // Create alert
    const alertId = alertIdCounter++;
    const alert = {
      id: alertId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      type,
      message: message || '',
      location: location || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      acknowledgedBy: null
    };

    alerts.set(alertId, alert);

    // Get paired user info
    const pairedUser = await User.findById(currentUser.pairedWith);

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: {
        alert: {
          ...alert,
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

    // Get user's alerts
    const userAlerts = Array.from(alerts.values())
      .filter(alert => alert.userId === currentUser.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

    // Get alerts from paired user
    const pairedAlerts = Array.from(alerts.values())
      .filter(alert => alert.userId === currentUser.pairedWith)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
    const alertId = parseInt(req.params.alertId);
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const alert = alerts.get(alertId);
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

    // Update alert status
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = currentUser.id;

    alerts.set(alertId, alert);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alert
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
    const alertId = parseInt(req.params.alertId);
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const alert = alerts.get(alertId);
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

    alerts.delete(alertId);

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

    // Get all active alerts
    const activeAlerts = Array.from(alerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

module.exports = router; 