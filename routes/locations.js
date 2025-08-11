const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Location = require('../models/Location');
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
const createLocationValidation = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180'),
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number'),
  body('heading').optional().isFloat({ min: 0, max: 360 }).withMessage('Heading must be between 0 and 360'),
  body('speed').optional().isFloat({ min: 0 }).withMessage('Speed must be a positive number'),
  body('altitude').optional().isFloat().withMessage('Altitude must be a valid number'),
  body('address').optional().trim().isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('alertId').optional().isUUID().withMessage('Alert ID must be a valid UUID')
];

// POST /api/locations - Create a new location entry
router.post('/', authenticateToken, createLocationValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      latitude, 
      longitude, 
      accuracy, 
      heading, 
      speed, 
      altitude, 
      address, 
      alertId 
    } = req.body;
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create location entry
    const locationData = {
      userId: userId,
      alertId: alertId,
      latitude: latitude,
      longitude: longitude,
      accuracy: accuracy,
      heading: heading,
      speed: speed,
      altitude: altitude,
      address: address
    };

    const location = await Location.create(locationData);

    console.log(`Location recorded for user ${userId} at ${latitude}, ${longitude}`);

    res.status(201).json({
      success: true,
      message: 'Location recorded successfully',
      data: {
        location: location.toJSON()
      }
    });

  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/locations - Get current user's locations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 100, alertId } = req.query;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let locations;
    if (alertId) {
      // Get locations for a specific alert
      locations = await Location.findByAlertId(alertId);
    } else {
      // Get user's recent locations
      locations = await Location.findByUserId(userId, parseInt(limit));
    }

    res.json({
      success: true,
      data: {
        locations: locations.map(location => location.toJSON())
      }
    });

  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/locations/latest/:childId - Get latest location for a paired child (for parent)
router.get('/latest/:childId', authenticateToken, async (req, res) => {
  try {
    const parentUserId = req.userId;
    const childUserId = req.params.childId;

    // Check if parent user exists
    const parentUser = await User.findById(parentUserId);
    if (!parentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if parent is paired with the child
    if (!parentUser.isPaired || parentUser.pairedWith !== childUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view locations of your paired child.'
      });
    }

    // Check if child user exists
    const childUser = await User.findById(childUserId);
    if (!childUser) {
      return res.status(404).json({
        success: false,
        message: 'Child user not found'
      });
    }

    // Get latest location for the child
    const latestLocation = await Location.getLatestByUserId(childUserId);

    if (!latestLocation) {
      return res.status(404).json({
        success: false,
        message: 'No location data found for this child'
      });
    }

    res.json({
      success: true,
      data: {
        location: latestLocation.toJSON(),
        child: {
          id: childUser.id,
          name: childUser.name,
          role: childUser.role
        }
      }
    });

  } catch (error) {
    console.error('Get latest location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/locations/:id - Get specific location
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const locationId = req.params.id;
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get location
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check if location belongs to user or if user is paired with location owner
    if (location.userId !== userId && 
        (!user.isPaired || user.pairedWith !== location.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Location does not belong to user.'
      });
    }

    res.json({
      success: true,
      data: {
        location: location.toJSON()
      }
    });

  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/locations/child/:childId - Get locations for a paired child (for parent)
router.get('/child/:childId', authenticateToken, async (req, res) => {
  try {
    const parentUserId = req.userId;
    const childUserId = req.params.childId;
    const { limit = 100, timeRange } = req.query;

    // Check if parent user exists
    const parentUser = await User.findById(parentUserId);
    if (!parentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if parent is paired with the child
    if (!parentUser.isPaired || parentUser.pairedWith !== childUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view locations of your paired child.'
      });
    }

    // Check if child user exists
    const childUser = await User.findById(childUserId);
    if (!childUser) {
      return res.status(404).json({
        success: false,
        message: 'Child user not found'
      });
    }

    let locations;
    if (timeRange) {
      // Parse time range (e.g., "1h", "24h", "7d")
      const now = new Date();
      let startTime;
      
      if (timeRange.endsWith('h')) {
        const hours = parseInt(timeRange);
        startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      } else if (timeRange.endsWith('d')) {
        const days = parseInt(timeRange);
        startTime = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      } else {
        startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Default to 24h
      }

      locations = await Location.findByUserIdAndTimeRange(childUserId, startTime.toISOString(), now.toISOString());
    } else {
      // Get recent locations
      locations = await Location.findByUserId(childUserId, parseInt(limit));
    }

    res.json({
      success: true,
      data: {
        locations: locations.map(location => location.toJSON()),
        child: {
          id: childUser.id,
          name: childUser.name,
          role: childUser.role
        }
      }
    });

  } catch (error) {
    console.error('Get child locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// DELETE /api/locations/:id - Delete specific location
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const locationId = req.params.id;
    const userId = req.userId;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get location
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check if location belongs to user
    if (location.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Location does not belong to user.'
      });
    }

    // Delete location
    await location.delete();

    console.log(`Deleted location ${locationId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });

  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/locations/bulk - Create multiple location entries (for background tracking)
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { locations } = req.body;
    const userId = req.userId;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Locations array is required and must not be empty'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate and create locations
    const createdLocations = [];
    const errors = [];

    for (const locationData of locations) {
      try {
        // Basic validation
        if (!locationData.latitude || !locationData.longitude) {
          errors.push(`Location missing coordinates: ${JSON.stringify(locationData)}`);
          continue;
        }

        const location = await Location.create({
          userId: userId,
          alertId: locationData.alertId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          heading: locationData.heading,
          speed: locationData.speed,
          altitude: locationData.altitude,
          address: locationData.address
        });

        createdLocations.push(location);
      } catch (error) {
        errors.push(`Failed to create location: ${error.message}`);
      }
    }

    console.log(`Bulk created ${createdLocations.length} locations for user ${userId}`);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdLocations.length} locations`,
      data: {
        createdCount: createdLocations.length,
        errorCount: errors.length,
        locations: createdLocations.map(location => location.toJSON()),
        errors: errors
      }
    });

  } catch (error) {
    console.error('Bulk create locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// GET /api/locations/stats/:childId - Get location statistics for a paired child
router.get('/stats/:childId', authenticateToken, async (req, res) => {
  try {
    const parentUserId = req.userId;
    const childUserId = req.params.childId;
    const { timeRange = '24h' } = req.query;

    // Check if parent user exists and is paired with child
    const parentUser = await User.findById(parentUserId);
    if (!parentUser || !parentUser.isPaired || parentUser.pairedWith !== childUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view stats of your paired child.'
      });
    }

    // Calculate time range
    const now = new Date();
    let startTime;
    
    if (timeRange.endsWith('h')) {
      const hours = parseInt(timeRange);
      startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    } else if (timeRange.endsWith('d')) {
      const days = parseInt(timeRange);
      startTime = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    } else {
      startTime = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // Default to 24h
    }

    // Get locations in time range
    const locations = await Location.findByUserIdAndTimeRange(childUserId, startTime.toISOString(), now.toISOString());

    if (locations.length === 0) {
      return res.json({
        success: true,
        data: {
          totalLocations: 0,
          timeRange: timeRange,
          averageAccuracy: 0,
          totalDistance: 0,
          averageSpeed: 0
        }
      });
    }

    // Calculate statistics
    let totalDistance = 0;
    let totalAccuracy = 0;
    let totalSpeed = 0;
    let validSpeedCount = 0;

    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      
      // Calculate distance between consecutive points
      const distance = Location.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      totalDistance += distance;

      // Accumulate accuracy and speed
      if (curr.accuracy) totalAccuracy += curr.accuracy;
      if (curr.speed && curr.speed > 0) {
        totalSpeed += curr.speed;
        validSpeedCount++;
      }
    }

    const stats = {
      totalLocations: locations.length,
      timeRange: timeRange,
      averageAccuracy: totalAccuracy / locations.length,
      totalDistance: totalDistance,
      averageSpeed: validSpeedCount > 0 ? totalSpeed / validSpeedCount : 0,
      firstLocation: locations[0].toJSON(),
      lastLocation: locations[locations.length - 1].toJSON()
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get location stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
