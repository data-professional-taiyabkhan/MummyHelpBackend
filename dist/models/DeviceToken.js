const { supabase } = require('../config/database');

class DeviceToken {
  constructor(data = {}) {
    this.id = data.id;
    this.userId = data.user_id;
    this.platform = data.platform;
    this.expoPushToken = data.expo_push_token;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new device token
  static async create(tokenData) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .insert({
          user_id: tokenData.userId,
          platform: tokenData.platform,
          expo_push_token: tokenData.expoPushToken
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new DeviceToken(data);
    } catch (error) {
      throw error;
    }
  }

  // Find device tokens by user ID
  static async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return data.map(token => new DeviceToken(token));
    } catch (error) {
      throw error;
    }
  }

  // Find device token by Expo push token
  static async findByExpoToken(expoToken) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('expo_push_token', expoToken)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Token not found
        }
        throw new Error(error.message);
      }

      return new DeviceToken(data);
    } catch (error) {
      throw error;
    }
  }

  // Update device token
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new DeviceToken(data);
    } catch (error) {
      throw error;
    }
  }

  // Delete device token
  async delete() {
    try {
      const { error } = await supabase
        .from('device_tokens')
        .delete()
        .eq('id', this.id);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Delete all tokens for a user
  static async deleteByUserId(userId) {
    try {
      const { error } = await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Get all tokens for a specific platform
  static async findByPlatform(platform) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('platform', platform);

      if (error) {
        throw new Error(error.message);
      }

      return data.map(token => new DeviceToken(token));
    } catch (error) {
      throw error;
    }
  }

  // Get all active tokens (for push notifications)
  static async getAllActive() {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(token => new DeviceToken(token));
    } catch (error) {
      throw error;
    }
  }

  // Remove password from JSON output
  toJSON() {
    const token = { ...this };
    return token;
  }
}

module.exports = DeviceToken;
