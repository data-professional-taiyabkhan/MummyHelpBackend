const { supabase } = require('../config/database');

class Alert {
  constructor(data = {}) {
    this.id = data.id;
    this.userId = data.user_id;
    this.type = data.type;
    this.message = data.message;
    this.location = data.location;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.accuracy = data.accuracy;
    this.address = data.address;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.acknowledgedAt = data.acknowledged_at;
    this.acknowledgedBy = data.acknowledged_by;
    this.cancelled = data.cancelled;
    this.cancelledAt = data.cancelled_at;
  }

  // Create a new alert
  static async create(alertData) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          user_id: alertData.userId,
          type: alertData.type,
          message: alertData.message,
          location: alertData.location,
          latitude: alertData.latitude,
          longitude: alertData.longitude,
          accuracy: alertData.accuracy,
          address: alertData.address,
          status: alertData.status || 'active'
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Alert(data);
    } catch (error) {
      throw error;
    }
  }

  // Find alert by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Alert not found
        }
        throw new Error(error.message);
      }

      return new Alert(data);
    } catch (error) {
      throw error;
    }
  }

  // Find alerts by user ID
  static async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(alert => new Alert(alert));
    } catch (error) {
      throw error;
    }
  }

  // Find alerts by paired user ID (for parent to see child's alerts)
  static async findByPairedUserId(pairedUserId) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', pairedUserId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(alert => new Alert(alert));
    } catch (error) {
      throw error;
    }
  }

  // Find active alerts
  static async findActive() {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'active')
        .eq('cancelled', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(alert => new Alert(alert));
    } catch (error) {
      throw error;
    }
  }

  // Find active alerts by user ID
  static async findActiveByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('cancelled', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(alert => new Alert(alert));
    } catch (error) {
      throw error;
    }
  }

  // Update alert
  async update(updateData) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Alert(data);
    } catch (error) {
      throw error;
    }
  }

  // Acknowledge alert
  async acknowledge(acknowledgedBy) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: acknowledgedBy
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Alert(data);
    } catch (error) {
      throw error;
    }
  }

  // Cancel alert
  async cancel() {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .update({
          cancelled: true,
          cancelled_at: new Date().toISOString()
        })
        .eq('id', this.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new Alert(data);
    } catch (error) {
      throw error;
    }
  }

  // Delete alert
  async delete() {
    try {
      const { error } = await supabase
        .from('alerts')
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

  // Get alert with user information
  static async findByIdWithUser(id) {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          user:users!alerts_user_id_fkey(
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
          return null; // Alert not found
        }
        throw new Error(error.message);
      }

      return new Alert(data);
    } catch (error) {
      throw error;
    }
  }

  // Get alerts with user information
  static async findWithUser(criteria = {}) {
    try {
      let query = supabase
        .from('alerts')
        .select(`
          *,
          user:users!alerts_user_id_fkey(
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
      if (criteria.status) {
        query = query.eq('status', criteria.status);
      }
      if (criteria.type) {
        query = query.eq('type', criteria.type);
      }
      if (criteria.cancelled !== undefined) {
        query = query.eq('cancelled', criteria.cancelled);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return data.map(alert => new Alert(alert));
    } catch (error) {
      throw error;
    }
  }

  // Remove password from JSON output
  toJSON() {
    const alert = { ...this };
    return alert;
  }
}

module.exports = Alert;
