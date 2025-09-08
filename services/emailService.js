const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.setupTransporter();
  }

  setupTransporter() {
    try {
      if (this.isDevelopment) {
        // For development, we'll just log emails to console
        this.isConfigured = true;
        return;
      }

      // Production email configuration
      if (process.env.EMAIL_SERVICE && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        this.transporter = nodemailer.createTransporter({
          service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS, // App password for Gmail
          },
        });
        this.isConfigured = true;
      } else {
        console.warn('Email service not configured. Set EMAIL_SERVICE, EMAIL_USER, and EMAIL_PASS environment variables.');
      }
    } catch (error) {
      console.error('Error setting up email service:', error);
    }
  }

  async sendPasswordResetEmail(email, resetToken) {
    try {
      const resetLink = process.env.APP_URL 
        ? `${process.env.APP_URL}/reset-password?token=${resetToken}`
        : `http://localhost:3000/reset-password?token=${resetToken}`;

      const subject = 'MummyHelp - Password Reset Request';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛡️ MummyHelp</h1>
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your MummyHelp password. If you didn't make this request, please ignore this email.</p>
              <p>To reset your password, click the button below:</p>
              <a href="${resetLink}" class="button">Reset My Password</a>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${resetLink}</p>
              <p><strong>This link will expire in 15 minutes for security reasons.</strong></p>
              <p>If you're having trouble, please contact our support team.</p>
              <p>Best regards,<br>The MummyHelp Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (this.isDevelopment) {
        // In development, log the email content instead of sending
        console.log('\n=== PASSWORD RESET EMAIL ===');
        console.log(`To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Reset Link: ${resetLink}`);
        console.log(`Reset Token: ${resetToken}`);
        console.log('=============================\n');
        return { success: true, isDevelopment: true };
      }

      if (!this.isConfigured) {
        throw new Error('Email service not configured');
      }

      const result = await this.transporter.sendMail({
        from: `"MummyHelp" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email, verificationToken) {
    try {
      const verificationLink = process.env.APP_URL 
        ? `${process.env.APP_URL}/verify-email?token=${verificationToken}`
        : `http://localhost:3000/verify-email?token=${verificationToken}`;

      const subject = 'MummyHelp - Verify Your Email Address';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛡️ MummyHelp</h1>
              <h2>Welcome! Please Verify Your Email</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for joining MummyHelp! To complete your account setup and access all features, please verify your email address.</p>
              <p>Click the button below to verify your email:</p>
              <a href="${verificationLink}" class="button">Verify My Email</a>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${verificationLink}</p>
              <p><strong>This link will expire in 24 hours for security reasons.</strong></p>
              <p>Once verified, you'll have access to all MummyHelp features including:</p>
              <ul>
                <li>🚨 Emergency alerts</li>
                <li>📍 Location sharing</li>
                <li>🎤 Voice commands</li>
                <li>👥 Family connections</li>
              </ul>
              <p>If you didn't create this account, please ignore this email.</p>
              <p>Best regards,<br>The MummyHelp Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      if (this.isDevelopment) {
        // In development, log the email content instead of sending
        console.log('\n=== EMAIL VERIFICATION EMAIL ===');
        console.log(`To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Verification Link: ${verificationLink}`);
        console.log(`Verification Token: ${verificationToken}`);
        console.log('==================================\n');
        return { success: true, isDevelopment: true };
      }

      if (!this.isConfigured) {
        throw new Error('Email service not configured');
      }

      const result = await this.transporter.sendMail({
        from: `"MummyHelp" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlContent,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
