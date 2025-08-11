const { Expo } = require('expo-server-sdk');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');

// Initialize Expo SDK
const expo = new Expo();

class PushService {
  constructor() {
    this.expo = expo;
  }

  // Validate Expo push token
  validateToken(token) {
    return Expo.isExpoPushToken(token);
  }

  // Send push notification to a single token
  async sendToToken(token, message, data = {}) {
    try {
      if (!this.validateToken(token)) {
        console.error('Invalid Expo push token:', token);
        return { success: false, error: 'Invalid token' };
      }

      const pushMessage = {
        to: token,
        sound: 'default',
        title: message.title,
        body: message.body,
        data: data,
        priority: 'high'
      };

      const chunks = this.expo.chunkPushNotifications([pushMessage]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      return { success: true, tickets };
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send push notification to all tokens for a user
  async sendToUser(userId, message, data = {}) {
    try {
      const tokens = await DeviceToken.findByUserId(userId);
      
      if (tokens.length === 0) {
        console.log(`No device tokens found for user ${userId}`);
        return { success: false, error: 'No device tokens found' };
      }

      const results = [];
      for (const token of tokens) {
        const result = await this.sendToToken(token.expoPushToken, message, data);
        results.push(result);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Error sending push to user:', error);
      return { success: false, error: error.message };
    }
  }

  // Send push notification to paired parent when child creates alert
  async notifyParentOnAlert(alertId, childId) {
    try {
      // Get child user info
      const childUser = await User.findById(childId);
      if (!childUser || !childUser.isPaired) {
        console.log(`Child user ${childId} not found or not paired`);
        return { success: false, error: 'Child not paired' };
      }

      // Get parent user info
      const parentUser = await User.findById(childUser.pairedWith);
      if (!parentUser) {
        console.log(`Parent user ${childUser.pairedWith} not found`);
        return { success: false, error: 'Parent not found' };
      }

      // Get parent's device tokens
      const parentTokens = await DeviceToken.findByUserId(parentUser.id);
      if (parentTokens.length === 0) {
        console.log(`No device tokens found for parent ${parentUser.id}`);
        return { success: false, error: 'No parent device tokens' };
      }

      // Prepare notification message
      const message = {
        title: '🚨 Emergency Alert!',
        body: `${childUser.name} needs immediate help!`
      };

      const notificationData = {
        type: 'emergency_alert',
        alertId: alertId,
        childId: childId,
        childName: childUser.name,
        timestamp: new Date().toISOString()
      };

      // Send to all parent devices
      const results = [];
      for (const token of parentTokens) {
        const result = await this.sendToToken(token.expoPushToken, message, notificationData);
        results.push(result);
      }

      console.log(`Sent emergency alert notification to parent ${parentUser.id} for child ${childId}`);
      return { success: true, results, parentId: parentUser.id };
    } catch (error) {
      console.error('Error notifying parent on alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Send check-in notification to parent
  async notifyParentOnCheckIn(childId, location = 'Unknown location') {
    try {
      const childUser = await User.findById(childId);
      if (!childUser || !childUser.isPaired) {
        return { success: false, error: 'Child not paired' };
      }

      const parentUser = await User.findById(childUser.pairedWith);
      if (!parentUser) {
        return { success: false, error: 'Parent not found' };
      }

      const parentTokens = await DeviceToken.findByUserId(parentUser.id);
      if (parentTokens.length === 0) {
        return { success: false, error: 'No parent device tokens' };
      }

      const message = {
        title: '📍 Check-In',
        body: `${childUser.name} is checking in from ${location}`
      };

      const notificationData = {
        type: 'check_in',
        childId: childId,
        childName: childUser.name,
        location: location,
        timestamp: new Date().toISOString()
      };

      const results = [];
      for (const token of parentTokens) {
        const result = await this.sendToToken(token.expoPushToken, message, notificationData);
        results.push(result);
      }

      return { success: true, results, parentId: parentUser.id };
    } catch (error) {
      console.error('Error notifying parent on check-in:', error);
      return { success: false, error: error.message };
    }
  }

  // Send help request notification to parent
  async notifyParentOnHelpRequest(childId, message = 'Help needed') {
    try {
      const childUser = await User.findById(childId);
      if (!childUser || !childUser.isPaired) {
        return { success: false, error: 'Child not paired' };
      }

      const parentUser = await User.findById(childUser.pairedWith);
      if (!parentUser) {
        return { success: false, error: 'Parent not found' };
      }

      const parentTokens = await DeviceToken.findByUserId(parentUser.id);
      if (parentTokens.length === 0) {
        return { success: false, error: 'No parent device tokens' };
      }

      const notificationMessage = {
        title: '🆘 Help Request',
        body: `${childUser.name}: ${message}`
      };

      const notificationData = {
        type: 'help_request',
        childId: childId,
        childName: childUser.name,
        message: message,
        timestamp: new Date().toISOString()
      };

      const results = [];
      for (const token of parentTokens) {
        const result = await this.sendToToken(token.expoPushToken, notificationMessage, notificationData);
        results.push(result);
      }

      return { success: true, results, parentId: parentUser.id };
    } catch (error) {
      console.error('Error notifying parent on help request:', error);
      return { success: false, error: error.message };
    }
  }

  // Send location update notification to parent
  async notifyParentOnLocationUpdate(childId, location) {
    try {
      const childUser = await User.findById(childId);
      if (!childUser || !childUser.isPaired) {
        return { success: false, error: 'Child not paired' };
      }

      const parentUser = await User.findById(childUser.pairedWith);
      if (!parentUser) {
        return { success: false, error: 'Parent not found' };
      }

      const parentTokens = await DeviceToken.findByUserId(parentUser.id);
      if (parentTokens.length === 0) {
        return { success: false, error: 'No parent device tokens' };
      }

      const message = {
        title: '📍 Location Update',
        body: `${childUser.name}'s location has been updated`
      };

      const notificationData = {
        type: 'location_update',
        childId: childId,
        childName: childUser.name,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        timestamp: new Date().toISOString()
      };

      const results = [];
      for (const token of parentTokens) {
        const result = await this.sendToToken(token.expoPushToken, message, notificationData);
        results.push(result);
      }

      return { success: true, results, parentId: parentUser.id };
    } catch (error) {
      console.error('Error notifying parent on location update:', error);
      return { success: false, error: error.message };
    }
  }

  // Send bulk notifications to multiple users
  async sendBulkNotifications(userIds, message, data = {}) {
    try {
      const results = [];
      
      for (const userId of userIds) {
        const result = await this.sendToUser(userId, message, data);
        results.push({ userId, result });
      }

      return { success: true, results };
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Check delivery status of push notifications
  async checkDeliveryStatus(tickets) {
    try {
      const receiptIds = [];
      for (const ticket of tickets) {
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
      }

      if (receiptIds.length === 0) {
        return { success: false, error: 'No receipt IDs found' };
      }

      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      const receipts = [];

      for (const chunk of receiptIdChunks) {
        try {
          const receiptChunk = await this.expo.getPushNotificationReceiptsAsync(chunk);
          receipts.push(...receiptChunk);
        } catch (error) {
          console.error('Error getting push notification receipts:', error);
        }
      }

      return { success: true, receipts };
    } catch (error) {
      console.error('Error checking delivery status:', error);
      return { success: false, error: error.message };
    }
  }

  // Get service status
  getStatus() {
    return {
      service: 'Expo Push Notifications',
      version: '1.0.0',
      sdkVersion: this.expo.version,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const pushService = new PushService();

module.exports = pushService;
