# Supabase Setup Guide for MummyHelp Backend

## Prerequisites
1. A Supabase account (sign up at https://supabase.com)
2. A new Supabase project

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `mummyhelp-backend` (or your preferred name)
   - Database Password: Create a strong password
   - Region: Choose the closest region to your users
5. Click "Create new project"
6. Wait for the project to be set up (this may take a few minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Set Up the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the contents of `supabase-setup.sql` from this directory
4. Click "Run" to execute the SQL script
5. This will create the `users` table with all necessary indexes and policies

## Step 4: Configure Environment Variables

1. Create a `.env` file in the backend directory (copy from `env.example`)
2. Add your Supabase credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:3001
```

## Step 5: Test the Connection

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. You should see:
   ```
   ✅ Supabase Connected Successfully
   🔗 URL: https://your-project-id.supabase.co
   ```

## Step 6: Test the API

1. Test user registration:
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123",
       "name": "Test User",
       "role": "mother"
     }'
   ```

2. Test user login:
   ```bash
   curl -X POST http://localhost:3000/api/auth/signin \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123"
     }'
   ```

## Database Schema Overview

The `users` table includes:

- `id`: Unique UUID identifier
- `email`: User's email address (unique)
- `password`: Hashed password
- `role`: Either 'mother' or 'child'
- `name`: User's display name
- `pairing_code`: 6-digit code for child-mother pairing
- `is_paired`: Boolean indicating if user is paired
- `paired_with`: Reference to paired user's ID
- `created_at`: Account creation timestamp
- `last_login`: Last login timestamp
- `updated_at`: Last update timestamp

## Security Features

- **Row Level Security (RLS)**: Enabled on the users table
- **Password Hashing**: Passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: All inputs are validated using express-validator
- **CORS Protection**: Configured to allow specific origins

## Troubleshooting

### Connection Issues
- Verify your `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Check that your Supabase project is active
- Ensure the SQL setup script was executed successfully

### Authentication Issues
- Verify your `JWT_SECRET` is set
- Check that the users table was created properly
- Ensure RLS policies are configured correctly

### API Issues
- Check the server logs for detailed error messages
- Verify all environment variables are set
- Test the health endpoint: `GET /health`

## Next Steps

1. Set up your frontend to use the new API endpoints
2. Configure CORS origins for your frontend domain
3. Set up production environment variables
4. Consider setting up database backups
5. Monitor your Supabase usage and costs 