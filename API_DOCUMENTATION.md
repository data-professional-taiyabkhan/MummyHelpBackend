# MummyHelp API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints Overview

### 🔐 Authentication Endpoints
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/signin` - Login user
- `GET /api/auth/me` - Get current user profile

### 👤 User Management Endpoints
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/pairing-code` - Get pairing code (child only)
- `POST /api/users/pair` - Pair with another user
- `GET /api/users/paired-user` - Get paired user info
- `DELETE /api/users/unpair` - Unpair from user
- `GET /api/users/all` - Get all users

### 🚨 Emergency Alert Endpoints
- `POST /api/alerts/create` - Create emergency alert
- `GET /api/alerts/my-alerts` - Get user's alerts
- `GET /api/alerts/paired-alerts` - Get paired user's alerts
- `PUT /api/alerts/:id/acknowledge` - Acknowledge alert
- `DELETE /api/alerts/:id` - Delete alert
- `GET /api/alerts/active` - Get all active alerts

### 🏥 Health Check
- `GET /health` - API health status

---

## Detailed Endpoint Documentation

### 🔐 Authentication

#### POST /api/auth/signup
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "mother"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "mother",
      "pairingCode": null,
      "isPaired": false,
      "pairedWith": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt-token-here"
  }
}
```

#### POST /api/auth/signin
Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "mother",
      "pairingCode": null,
      "isPaired": false,
      "pairedWith": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt-token-here"
  }
}
```

#### GET /api/auth/me
Get current user profile (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "mother",
      "pairingCode": null,
      "isPaired": false,
      "pairedWith": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 👤 User Management

#### GET /api/users/profile
Get current user profile (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "mother",
      "pairingCode": null,
      "isPaired": false,
      "pairedWith": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /api/users/profile
Update user profile (requires authentication).

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "updated@example.com",
      "name": "Updated Name",
      "role": "mother",
      "pairingCode": null,
      "isPaired": false,
      "pairedWith": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /api/users/pairing-code
Get pairing code for child users (requires authentication, child role only).

**Response:**
```json
{
  "success": true,
  "data": {
    "pairingCode": "123456"
  }
}
```

#### POST /api/users/pair
Pair with another user using pairing code (requires authentication).

**Request Body:**
```json
{
  "pairingCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Users paired successfully",
  "data": {
    "pairedUser": {
      "id": "uuid",
      "name": "Child Name",
      "role": "child"
    }
  }
}
```

#### GET /api/users/paired-user
Get information about paired user (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "pairedUser": {
      "id": "uuid",
      "name": "Child Name",
      "role": "child",
      "lastLogin": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### DELETE /api/users/unpair
Unpair from current user (requires authentication).

**Response:**
```json
{
  "success": true,
  "message": "Users unpaired successfully"
}
```

#### GET /api/users/all
Get all users (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "role": "mother",
        "is_paired": false,
        "created_at": "2024-01-01T00:00:00.000Z",
        "last_login": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 🚨 Emergency Alerts

#### POST /api/alerts/create
Create a new emergency alert (requires authentication and pairing).

**Request Body:**
```json
{
  "type": "emergency",
  "message": "I need help immediately!",
  "location": "Central Park, New York"
}
```

**Alert Types:**
- `emergency` - Urgent emergency situation
- `help` - Need assistance
- `check-in` - Regular check-in

**Response:**
```json
{
  "success": true,
  "message": "Alert created successfully",
  "data": {
    "alert": {
      "id": 1,
      "userId": "uuid",
      "userName": "John Doe",
      "userRole": "mother",
      "type": "emergency",
      "message": "I need help immediately!",
      "location": "Central Park, New York",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "acknowledgedAt": null,
      "acknowledgedBy": null,
      "pairedUser": {
        "id": "uuid",
        "name": "Child Name",
        "role": "child"
      }
    }
  }
}
```

#### GET /api/alerts/my-alerts
Get current user's alerts (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 1,
        "userId": "uuid",
        "userName": "John Doe",
        "userRole": "mother",
        "type": "emergency",
        "message": "I need help immediately!",
        "location": "Central Park, New York",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "acknowledgedAt": null,
        "acknowledgedBy": null
      }
    ]
  }
}
```

#### GET /api/alerts/paired-alerts
Get alerts from paired user (requires authentication and pairing).

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 1,
        "userId": "uuid",
        "userName": "Child Name",
        "userRole": "child",
        "type": "emergency",
        "message": "I need help immediately!",
        "location": "Central Park, New York",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "acknowledgedAt": null,
        "acknowledgedBy": null
      }
    ]
  }
}
```

#### PUT /api/alerts/:id/acknowledge
Acknowledge an alert (requires authentication).

**Response:**
```json
{
  "success": true,
  "message": "Alert acknowledged successfully",
  "data": {
    "alert": {
      "id": 1,
      "userId": "uuid",
      "userName": "Child Name",
      "userRole": "child",
      "type": "emergency",
      "message": "I need help immediately!",
      "location": "Central Park, New York",
      "status": "acknowledged",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "acknowledgedAt": "2024-01-01T00:00:00.000Z",
      "acknowledgedBy": "uuid"
    }
  }
}
```

#### DELETE /api/alerts/:id
Delete an alert (requires authentication, owner only).

**Response:**
```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```

#### GET /api/alerts/active
Get all active alerts (requires authentication).

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 1,
        "userId": "uuid",
        "userName": "John Doe",
        "userRole": "mother",
        "type": "emergency",
        "message": "I need help immediately!",
        "location": "Central Park, New York",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "acknowledgedAt": null,
        "acknowledgedBy": null
      }
    ]
  }
}
```

### 🏥 Health Check

#### GET /health
Check API health status.

**Response:**
```json
{
  "success": true,
  "message": "MummyHelp API is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "mode": "development"
}
```

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "invalid-email",
      "msg": "Please provide a valid email",
      "path": "email",
      "location": "body"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Only children can generate pairing codes"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Testing with Postman

1. Import the `MummyHelp_API_Postman_Collection.json` file into Postman
2. Set the `baseUrl` variable to `http://localhost:3000`
3. Start with the "Health Check" endpoint to verify the API is running
4. Create users using the signup endpoints
5. Login to get a JWT token (automatically stored in the `authToken` variable)
6. Test all other endpoints with the authentication token

## Testing Workflow

1. **Health Check**: Verify API is running
2. **Create Mother Account**: Use signup with role "mother"
3. **Create Child Account**: Use signup with role "child"
4. **Login as Child**: Get pairing code
5. **Login as Mother**: Use pairing code to pair accounts
6. **Create Alerts**: Test emergency alert functionality
7. **Acknowledge Alerts**: Test alert acknowledgment
8. **View Alerts**: Test alert retrieval endpoints 