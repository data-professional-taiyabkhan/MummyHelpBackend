const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api';
let parentToken = '';
let childToken = '';
let parentId = '';
let childId = '';
let pairingCode = '';

// Test data
const testData = {
  parent: {
    email: 'parent-test@example.com',
    password: 'password123',
    name: 'Test Parent',
    role: 'mother'
  },
  child: {
    email: 'child-test@example.com',
    password: 'password123',
    name: 'Test Child',
    role: 'child'
  }
};

async function testPhaseB() {
  console.log('🚀 Starting Phase B Testing: Push Notifications End-to-End\n');

  try {
    // Step 1: Create parent user
    console.log('1️⃣ Creating parent user...');
    const parentSignup = await axios.post(`${BASE_URL}/auth/signup`, testData.parent);
    parentId = parentSignup.data.data.user.id;
    console.log('✅ Parent created:', parentSignup.data.data.user.name);

    // Step 2: Create child user
    console.log('\n2️⃣ Creating child user...');
    const childSignup = await axios.post(`${BASE_URL}/auth/signup`, testData.child);
    childId = childSignup.data.data.user.id;
    pairingCode = childSignup.data.data.user.pairingCode;
    console.log('✅ Child created:', childSignup.data.data.user.name);
    console.log('🔑 Pairing code:', pairingCode);

    // Step 3: Parent signs in
    console.log('\n3️⃣ Parent signing in...');
    const parentSignin = await axios.post(`${BASE_URL}/auth/signin`, {
      email: testData.parent.email,
      password: testData.parent.password
    });
    parentToken = parentSignin.data.data.token;
    console.log('✅ Parent signed in, token received');

    // Step 4: Pair users
    console.log('\n4️⃣ Pairing parent with child...');
    const pairing = await axios.post(`${BASE_URL}/users/pair`, {
      pairingCode: pairingCode
    }, {
      headers: { Authorization: `Bearer ${parentToken}` }
    });
    console.log('✅ Users paired successfully');

    // Step 5: Child signs in
    console.log('\n5️⃣ Child signing in...');
    const childSignin = await axios.post(`${BASE_URL}/auth/signin`, {
      email: testData.child.email,
      password: testData.child.password
    });
    childToken = childSignin.data.data.token;
    console.log('✅ Child signed in, token received');

    // Step 6: Register device tokens (simulate app registration)
    console.log('\n6️⃣ Registering device tokens...');
    
    // Register parent device token
    const parentDeviceToken = await axios.post(`${BASE_URL}/device-tokens`, {
      platform: 'ios',
      expoPushToken: 'ExponentPushToken[parent-test-token]'
    }, {
      headers: { Authorization: `Bearer ${parentToken}` }
    });
    console.log('✅ Parent device token registered');

    // Register child device token
    const childDeviceToken = await axios.post(`${BASE_URL}/device-tokens`, {
      platform: 'ios',
      expoPushToken: 'ExponentPushToken[child-test-token]'
    }, {
      headers: { Authorization: `Bearer ${childToken}` }
    });
    console.log('✅ Child device token registered');

    // Step 7: Test alert creation (this should trigger push notification)
    console.log('\n7️⃣ Testing alert creation...');
    const alert = await axios.post(`${BASE_URL}/alerts/create`, {
      type: 'emergency',
      message: 'Test emergency alert from Phase B testing'
    }, {
      headers: { Authorization: `Bearer ${childToken}` }
    });
    console.log('✅ Alert created successfully');
    console.log('📱 Push notification should have been sent to parent device');

    // Step 8: Verify alert exists
    console.log('\n8️⃣ Verifying alert in database...');
    const alerts = await axios.get(`${BASE_URL}/alerts/paired-alerts`, {
      headers: { Authorization: `Bearer ${parentToken}` }
    });
    console.log('✅ Parent can see child alerts:', alerts.data.data.alerts.length, 'alerts found');

    // Step 9: Check device tokens
    console.log('\n9️⃣ Checking registered device tokens...');
    const parentTokens = await axios.get(`${BASE_URL}/device-tokens`, {
      headers: { Authorization: `Bearer ${parentToken}` }
    });
    const childTokens = await axios.get(`${BASE_URL}/device-tokens`, {
      headers: { Authorization: `Bearer ${childToken}` }
    });
    console.log('✅ Parent tokens:', parentTokens.data.data.deviceTokens.length);
    console.log('✅ Child tokens:', childTokens.data.data.deviceTokens.length);

    console.log('\n🎉 Phase B Testing Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Parent and child users created and paired');
    console.log('   • Device tokens registered with backend');
    console.log('   • Alert creation working');
    console.log('   • Push notification system ready');
    console.log('\n🔍 Next Steps:');
    console.log('   • Test with real Expo push tokens from your iPhone');
    console.log('   • Verify push notifications are received');
    console.log('   • Move to Phase C (Live Location Streaming)');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('URL:', error.config?.url);
  }
}

// Run the test
testPhaseB();
