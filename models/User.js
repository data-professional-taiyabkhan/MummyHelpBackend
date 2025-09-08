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
    this.emailVerified = data.email_verified;
    this.verificationToken = data.verification_token;
    this.verificationTokenExpires = data.verification_token_expires;
    this.resetToken = data.reset_token;
    this.resetTokenExpires = data.reset_token_expires;
  }

  // Create a new user
  static async create(userData) {
    try {
      // Hash password before saving
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Generate verification token
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
          email_verified: false,
          verification_token: verificationToken,
          verification_token_expires: verificationTokenExpires.toISOString(),
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const user = new User(data);
      
      // Log verification token for development (in production, send email)
      console.log(`Verification token for ${user.email}: ${verificationToken}`);
      console.log(`Verification link: http://your-app-domain/verify-email?token=${verificationToken}`);

      return user;
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

  // Set password reset token
  async setResetToken(token, expiry) {
    await this.update({
      reset_token: token,
      reset_token_expires: expiry.toISOString()
    });
    this.resetToken = token;
    this.resetTokenExpires = expiry.toISOString();
  }

  // Find user by reset token
  static async findByResetToken(token) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('reset_token', token)
        .gt('reset_token_expires', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Token not found or expired
        }
        throw new Error(error.message);
      }

      return new User(data);
    } catch (error) {
      throw error;
    }
  }

  // Reset password and clear reset token
  async resetPassword(newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    });
    
    this.password = hashedPassword;
    this.resetToken = null;
    this.resetTokenExpires = null;
  }

  // Set email verification token
  async setVerificationToken(token) {
    await this.update({
      verification_token: token,
      verification_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });
    this.verificationToken = token;
    this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  // Find user by verification token
  static async findByVerificationToken(token) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('verification_token', token)
        .gt('verification_token_expires', new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Token not found or expired
        }
        throw new Error(error.message);
      }

      return new User(data);
    } catch (error) {
      throw error;
    }
  }

  // Verify email and clear verification token
  async verifyEmail() {
    await this.update({
      email_verified: true,
      verification_token: null,
      verification_token_expires: null
    });
    
    this.emailVerified = true;
    this.verificationToken = null;
    this.verificationTokenExpires = null;
  }

  // Remove password and sensitive tokens from JSON output
  toJSON() {
    const user = { ...this };
    delete user.password;
    delete user.resetToken;
    delete user.resetTokenExpires;
    delete user.verificationToken;
    delete user.verificationTokenExpires;
    return user;
  }
}

module.exports = User; 