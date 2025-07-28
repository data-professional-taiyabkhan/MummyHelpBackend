const bcrypt = require('bcryptjs');
const { supabase } = require('../config/database');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role;
    this.name = data.name;
    this.pairingCode = data.pairing_code;
    this.isPaired = data.is_paired;
    this.pairedWith = data.paired_with;
    this.createdAt = data.created_at;
    this.lastLogin = data.last_login;
  }

  // Create a new user
  static async create(userData) {
    try {
      // Hash password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      const { data, error } = await supabase
        .from('users')
        .insert({
          email: userData.email.toLowerCase().trim(),
          password: hashedPassword,
          role: userData.role,
          name: userData.name.trim(),
          pairing_code: userData.pairingCode,
          is_paired: userData.isPaired || false,
          paired_with: userData.pairedWith,
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return new User(data);
    } catch (error) {
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw new Error(error.message);
      }

      return new User(data);
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw new Error(error.message);
      }

      return new User(data);
    } catch (error) {
      throw error;
    }
  }

  // Find user by pairing code
  static async findByPairingCode(pairingCode) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pairing_code', pairingCode)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw new Error(error.message);
      }

      return new User(data);
    } catch (error) {
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    try {
      console.log('DEBUG: Updating user lastLogin for id:', this.id); // Debug log
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', this.id)
        .select();

      if (error) {
        throw new Error(error.message);
      }
      if (!data || data.length !== 1) {
        throw new Error('User not found or multiple users updated');
      }

      return new User(data[0]);
    } catch (error) {
      throw error;
    }
  }

  // Generate pairing code for children
  async generatePairingCode() {
    if (this.role !== 'child') {
      throw new Error('Only children can generate pairing codes');
    }
    
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await this.update({ pairing_code: code });
    this.pairingCode = code;
    return code;
  }

  // Compare password method
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Update last login
  async updateLastLogin() {
    await this.update({ last_login: new Date().toISOString() });
    this.lastLogin = new Date().toISOString();
  }

  // Remove password from JSON output
  toJSON() {
    const user = { ...this };
    delete user.password;
    return user;
  }
}

module.exports = User; 