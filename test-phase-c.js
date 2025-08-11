const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let authToken = '';
let childUserId = '';
let parentUserId = '';

// Test data
const testUsers = {
  child: {
    name: 'Test Child',
    email: 'child-test@example.com',
    password: 'testpass123',
    role: 'child'
  },
  parent: {
    name: 'Test Parent',
    email: 'parent-test@example.com',
    password: 'testpass123',
    role: 'parent'
  }
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Request failed: ${method} ${endpoint}`, error.response?.data || error.message);
    throw error;
  }
};

// Test functions
const testUserCreation = async () => {
  console.log('\n🔧 Testing User Creation...');
  
  try {
    // Create child user
    const childResponse = await axios.post(`${API_BASE_URL}/auth/signup`, testUsers.child);
    if (childResponse.data.success) {
      childUserId = childResponse.data.user.id;
      console.log('✅ Child user created successfully');
    }

    // Create parent user
    const parentResponse = await axios.post(`${API_BASE_URL}/auth/signup`, testUsers.parent);
    if (parentResponse.data.success) {
      parentUserId = parentResponse.data.user.id;
      console.log('✅ Parent user created successfully');
    }

    return true;
  } catch (error) {
    console.error('❌ User creation failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testUserSignin = async () => {
  console.log('\n🔐 Testing User Signin...');
  
  try {
    // Sign in as child
    const childSignin = await axios.post(`${API_BASE_URL}/auth/signin`, {
      email: testUsers.child.email,
      password: testUsers.child.password
    });

    if (childSignin.data.success) {
      authToken = childSignin.data.token;
      console.log('✅ Child signed in successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Child signin failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testPairing = async () => {
  console.log('\n🔗 Testing User Pairing...');
  
  try {
    // Get pairing code as child
    const pairingCodeResponse = await makeRequest('GET', '/users/pairing-code');
    if (!pairingCodeResponse.success) {
      throw new Error('Failed to get pairing code');
    }

    const pairingCode = pairingCodeResponse.data.pairingCode;
    console.log(`📱 Child pairing code: ${pairingCode}`);

    // Sign in as parent
    const parentSignin = await axios.post(`${API_BASE_URL}/auth/signin`, {
      email: testUsers.parent.email,
      password: testUsers.parent.password
    });

    if (!parentSignin.data.success) {
      throw new Error('Parent signin failed');
    }

    const parentToken = parentSignin.data.token;

    // Pair parent with child
    const pairResponse = await axios.post(`${API_BASE_URL}/users/pair`, {
      pairingCode
    }, {
      headers: {
        'Authorization': `Bearer ${parentToken}`
      }
    });

    if (pairResponse.data.success) {
      console.log('✅ Parent and child paired successfully');
      
      // Switch back to child token for further testing
      authToken = childSignin.data.token;
      return true;
    }
  } catch (error) {
    console.error('❌ Pairing failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testDeviceTokenRegistration = async () => {
  console.log('\n📱 Testing Device Token Registration...');
  
  try {
    const deviceToken = 'ExponentPushToken[test-token-123]';
    const platform = 'ios';

    const response = await makeRequest('POST', '/device-tokens', {
      platform,
      expoPushToken: deviceToken
    });

    if (response.success) {
      console.log('✅ Device token registered successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Device token registration failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testAlertCreation = async () => {
  console.log('\n🚨 Testing Alert Creation...');
  
  try {
    const alertData = {
      type: 'emergency',
      message: 'Test emergency alert from Phase C testing',
      latitude: 37.78825,
      longitude: -122.4324,
      accuracy: 5.0
    };

    const response = await makeRequest('POST', '/alerts/create', alertData);

    if (response.success) {
      console.log('✅ Emergency alert created successfully');
      console.log(`📍 Alert ID: ${response.data.alert.id}`);
      return response.data.alert.id;
    }
  } catch (error) {
    console.error('❌ Alert creation failed:', error.response?.data?.message || error.message);
    return null;
  }
};

const testLocationCreation = async () => {
  console.log('\n📍 Testing Location Creation...');
  
  try {
    const locationData = {
      latitude: 37.78825,
      longitude: -122.4324,
      accuracy: 5.0,
      heading: 90,
      speed: 0,
      altitude: 100
    };

    const response = await makeRequest('POST', '/locations', locationData);

    if (response.success) {
      console.log('✅ Location created successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Location creation failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testLocationRetrieval = async () => {
  console.log('\n🗺️ Testing Location Retrieval...');
  
  try {
    // Get latest location for child
    const response = await makeRequest('GET', `/locations/latest/${childUserId}`);

    if (response.success) {
      console.log('✅ Latest location retrieved successfully');
      console.log(`📍 Location: ${response.data.latitude}, ${response.data.longitude}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Location retrieval failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testAlertRetrieval = async () => {
  console.log('\n📋 Testing Alert Retrieval...');
  
  try {
    // Get child's alerts
    const childAlerts = await makeRequest('GET', '/alerts/my-alerts');
    if (childAlerts.success) {
      console.log(`✅ Child alerts retrieved: ${childAlerts.data.length} alerts`);
    }

    // Switch to parent token to get paired alerts
    const parentSignin = await axios.post(`${API_BASE_URL}/auth/signin`, {
      email: testUsers.parent.email,
      password: testUsers.parent.password
    });

    if (parentSignin.data.success) {
      const parentToken = parentSignin.data.token;
      
      const pairedAlerts = await axios.get(`${API_BASE_URL}/alerts/paired-alerts`, {
        headers: {
          'Authorization': `Bearer ${parentToken}`
        }
      });

      if (pairedAlerts.data.success) {
        console.log(`✅ Parent retrieved paired alerts: ${pairedAlerts.data.data.length} alerts`);
        return true;
      }
    }
  } catch (error) {
    console.error('❌ Alert retrieval failed:', error.response?.data?.message || error.message);
    return false;
  }
};

const testCleanup = async () => {
  console.log('\n🧹 Testing Cleanup...');
  
  try {
    // Delete test users (this would require admin privileges in a real app)
    console.log('ℹ️ Test users would be cleaned up in production');
    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    return false;
  }
};

// Main test execution
const runPhaseCTests = async () => {
  console.log('🚀 Starting Phase C Tests - Live Location Streaming & Map Screen');
  console.log('=' .repeat(60));

  try {
    // Test user creation and pairing
    if (!(await testUserCreation())) return;
    if (!(await testUserSignin())) return;
    if (!(await testPairing())) return;

    // Test device token registration
    if (!(await testDeviceTokenRegistration())) return;

    // Test alert creation (this should trigger background location in the app)
    const alertId = await testAlertCreation();
    if (!alertId) return;

    // Test location creation and retrieval
    if (!(await testLocationCreation())) return;
    if (!(await testLocationRetrieval())) return;

    // Test alert retrieval from parent perspective
    if (!(await testAlertRetrieval())) return;

    // Cleanup
    await testCleanup();

    console.log('\n🎉 Phase C Tests Completed Successfully!');
    console.log('\n📱 Next Steps for App Testing:');
    console.log('1. Install the required dependencies: npm install');
    console.log('2. Build and run the app on your iPhone');
    console.log('3. Test the complete flow:');
    console.log('   - Child creates emergency alert');
    console.log('   - Background location tracking starts');
    console.log('   - Parent receives push notification');
    console.log('   - Parent taps notification → navigates to map');
    console.log('   - Map shows child\'s live location with polling');

  } catch (error) {
    console.error('\n💥 Phase C Tests Failed:', error.message);
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runPhaseCTests();
}

module.exports = { runPhaseCTests };
