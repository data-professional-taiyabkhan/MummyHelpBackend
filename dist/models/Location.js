const { supabase } = require('../config/database');

class Location {
  constructor(data = {}) {
    this.id = data.id;
    this.userId = data.user_id;
    this.alertId = data.alert_id;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.accuracy = data.accuracy;
    this.heading = data.heading;
    this.speed = data.speed;
    this.altitude = data.altitude;
    this.address = data.address;
    this.createdAt = data.created_at;
  }

  // Create a new location entry
  static async create(locationData) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .insert({
          user_id: locationData.userId,
          alert_id: locationData.alertId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          heading: locationData.heading,
          speed: locationData.speed,
          altitude: locationData.altitude,
          address: locationData.address
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Location(data);
    } catch (error) {
      throw error;
    }
  }

  // Find location by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Location not found
        }
        throw new Error(error.message);
      }

      return new Location(data);
    } catch (error) {
      throw error;
    }
  }

  // Find locations by user ID
  static async findByUserId(userId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(error.message);
      }

      return data.map(location => new Location(location));
    } catch (error) {
      throw error;
    }
  }

  // Find locations by alert ID
  static async findByAlertId(alertId) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('alert_id', alertId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(location => new Location(location));
    } catch (error) {
      throw error;
    }
  }

  // Get latest location for a user
  static async getLatestByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No location found
        }
        throw new Error(error.message);
      }

      return new Location(data);
    } catch (error) {
      throw error;
    }
  }

  // Get locations within a time range for a user
  static async findByUserIdAndTimeRange(userId, startTime, endTime) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startTime)
        .lte('created_at', endTime)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(location => new Location(data));
    } catch (error) {
      throw error;
    }
  }

  // Get locations within a geographic area
  static async findByUserIdAndBounds(userId, bounds) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .gte('latitude', bounds.south)
        .lte('latitude', bounds.north)
        .gte('longitude', bounds.west)
        .lte('longitude', bounds.east)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(location => new Location(data));
    } catch (error) {
      throw error;
    }
  }

  // Update location
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Location(data);
    } catch (error) {
      throw error;
    }
  }

  // Delete location
  async delete() {
    try {
      const { error } = await supabase
        .from('locations')
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

  // Delete old locations (cleanup)
  static async deleteOldLocations(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('locations')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Get location with user information
  static async findByIdWithUser(id) {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          user:users!locations_user_id_fkey(
            id,
            name,
            role,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Location not found
        }
        throw new Error(error.message);
      }

      return new Location(data);
    } catch (error) {
      throw error;
    }
  }

  // Get locations with user information
  static async findWithUser(criteria = {}) {
    try {
      let query = supabase
        .from('locations')
        .select(`
          *,
          user:users!locations_user_id_fkey(
            id,
            name,
            role,
            email
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (criteria.userId) {
        query = query.eq('user_id', criteria.userId);
      }
      if (criteria.alertId) {
        query = query.eq('alert_id', criteria.alertId);
      }
      if (criteria.limit) {
        query = query.limit(criteria.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return data.map(location => new Location(location));
    } catch (error) {
      throw error;
    }
  }

  // Calculate distance between two locations
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Format distance for display
  static formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  // Remove password from JSON output
  toJSON() {
    const location = { ...this };
    return location;
  }
}

module.exports = Location;
