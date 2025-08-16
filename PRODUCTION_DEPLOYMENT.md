# 🚀 MummyHelp Backend Production Deployment Guide

This guide will walk you through deploying the MummyHelp backend to production.

## 📋 Prerequisites

- Node.js 16+ installed on your server
- Docker and Docker Compose (optional, for containerized deployment)
- Supabase account and project
- Domain name (for production)
- SSL certificate (for HTTPS)

## 🔧 Environment Setup

### 1. Create Production Environment File

```bash
cp env.example .env.production
```

Edit `.env.production` with your production values:

```env
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=https://yourdomain.com
GOOGLE_SPEECH_API_KEY=your-google-api-key
EXPO_ACCESS_TOKEN=your-expo-token
```

### 2. Install Dependencies

```bash
npm install
```

## 🏗️ Building for Production

### Option 1: Direct Deployment

```bash
# Build the application
npm run build:prod

# The dist/ folder now contains production-ready files
```

### Option 2: Docker Deployment

```bash
# Build Docker image
docker build -t mummyhelp-backend .

# Or use docker-compose
docker-compose up -d --build
```

## 🚀 Deployment Methods

### Method 1: Traditional Server Deployment

1. **Upload files to your server:**
   ```bash
   scp -r dist/* user@your-server:/path/to/app/
   ```

2. **Install production dependencies:**
   ```bash
   npm install --production
   ```

3. **Set environment variables:**
   ```bash
   export NODE_ENV=production
   export SUPABASE_URL=your-url
   # ... other variables
   ```

4. **Start the application:**
   ```bash
   npm start
   ```

### Method 2: Docker Deployment

1. **Build and run with Docker:**
   ```bash
   docker-compose up -d
   ```

2. **Check status:**
   ```bash
   docker-compose ps
   docker-compose logs -f mummyhelp-api
   ```

### Method 3: PM2 Process Manager (Recommended)

1. **Install PM2 globally:**
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem file:**
   ```bash
   pm2 ecosystem
   ```

3. **Edit ecosystem.config.js:**
   ```javascript
   module.exports = {
     apps: [{
       name: 'mummyhelp-api',
       script: 'server.js',
       cwd: '/path/to/your/app',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       env_file: '.env.production'
     }]
   };
   ```

4. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # API (if exposed directly)
sudo ufw enable
```

### 2. SSL/HTTPS Setup

#### Using Let's Encrypt with Certbot:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Using Nginx as Reverse Proxy:

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream mummyhelp-api {
        server localhost:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        location / {
            proxy_pass http://mummyhelp-api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## 📊 Monitoring and Logging

### 1. Application Logs

```bash
# View logs
pm2 logs mummyhelp-api

# Or with Docker
docker-compose logs -f mummyhelp-api
```

### 2. System Monitoring

```bash
# Install monitoring tools
npm install -g clinic

# Profile your application
clinic doctor -- node server.js
```

### 3. Health Checks

The application includes a health check endpoint at `/health`. Use this for:

- Load balancer health checks
- Monitoring service checks
- Docker health checks

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build for production
        run: npm run build:prod
        
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            cd /path/to/app
            git pull origin main
            npm install --production
            pm2 restart mummyhelp-api
```

## 🧪 Testing Production

### 1. Health Check

```bash
curl https://yourdomain.com/health
```

### 2. API Endpoints

```bash
# Test authentication
curl -X POST https://yourdomain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 3. Load Testing

```bash
# Install artillery
npm install -g artillery

# Create load test
artillery quick --count 100 --num 10 https://yourdomain.com/health
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **Permission denied:**
   ```bash
   sudo chown -R $USER:$USER /path/to/app
   ```

3. **Environment variables not loaded:**
   ```bash
   # Check if .env file exists
   ls -la .env*
   
   # Verify variables are loaded
   node -e "console.log(process.env.NODE_ENV)"
   ```

### Log Analysis

```bash
# Check application logs
pm2 logs mummyhelp-api --lines 100

# Check system logs
sudo journalctl -u your-service -f

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 📈 Performance Optimization

### 1. Enable Compression

Already configured in the application.

### 2. Database Connection Pooling

Configure in your Supabase project settings.

### 3. Caching

Consider adding Redis for session storage and caching.

### 4. Load Balancing

For high traffic, use multiple instances behind a load balancer.

## 🔄 Updates and Maintenance

### 1. Zero-Downtime Updates

```bash
# With PM2
pm2 reload mummyhelp-api

# With Docker
docker-compose up -d --no-deps mummyhelp-api
```

### 2. Database Migrations

```bash
# Run database updates
node scripts/migrate.js
```

### 3. Backup Strategy

```bash
# Database backup (if using Supabase, use their backup features)
# File backup
tar -czf backup-$(date +%Y%m%d).tar.gz /path/to/app
```

## 📞 Support and Monitoring

- **Health Check URL**: `https://yourdomain.com/health`
- **Logs**: Check PM2 or Docker logs
- **Monitoring**: Set up alerts for response time and error rates
- **Backup**: Regular database and file backups

## ✅ Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Monitoring set up
- [ ] Logs configured
- [ ] Backup strategy in place
- [ ] Health checks working
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

---

**🚀 Your MummyHelp backend is now production-ready!**

For additional support, check the main README.md or create an issue in the repository.
