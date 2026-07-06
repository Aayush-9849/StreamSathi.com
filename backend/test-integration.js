const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const http = require('http');

require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamsathi';

// Helper to make HTTP requests
const makeRequest = (options, postData = null, isMultipart = false) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (postData) {
      if (isMultipart) {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
};

const run = async () => {
  console.log('Starting StreamSathi integration tests...\n');

  // Connect to DB directly to seed and clean test data
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB for integration checks.');

  // Clean test databases for a fresh test run (targeting only test sandboxed data)
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }), 'orders');

  const testUser = await User.findOne({ email: 'testuser@gmail.com' });
  if (testUser) {
    await Order.deleteMany({ userId: testUser._id });
    await User.deleteOne({ email: 'testuser@gmail.com' });
  }
  console.log('Cleaned test sandbox data from local database.');

  // Re-seed or update admin user, plans, and settings for the clean test run
  const bcrypt = require('bcrypt');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('12345', salt);
  
  await mongoose.connection.db.collection('users').updateOne(
    { email: 'kumaryada263@gmail.com' },
    {
      $set: {
        isAdmin: true,
        isVerified: true
      },
      $setOnInsert: {
        name: 'System Administrator',
        passwordHash,
        whatsApp: '+977-9800000000'
      }
    },
    { upsert: true }
  );

  const platforms = ['Netflix', 'Amazon Prime', 'SonyLIV', 'Zee5'];
  for (const platform of platforms) {
    const isNetflix = platform === 'Netflix';
    const plansInfo = [
      { name: 'Mobile', price: isNetflix ? 150 : 100, details: '1 Screen, Mobile only (SD)', popular: false },
      { name: 'Basic', price: isNetflix ? 350 : 200, details: '1 Screen, All devices (720p)', popular: false },
      { name: 'Standard', price: isNetflix ? 800 : 350, details: '2 Screens, All devices (1080p)', popular: false },
      { name: 'Premium UHD', price: isNetflix ? 1100 : 500, details: '4 Screens, All devices (4K)', popular: true }
    ];
    for (const plan of plansInfo) {
      await mongoose.connection.db.collection('plans').updateOne(
        { platform, name: plan.name },
        { $setOnInsert: { price: plan.price, details: plan.details, popular: plan.popular } },
        { upsert: true }
      );
    }
  }

  await mongoose.connection.db.collection('settings').updateOne(
    { key: 'esewa_qr' },
    { $setOnInsert: { value: '/images/esewa_qr.jpg' } },
    { upsert: true }
  );
  await mongoose.connection.db.collection('settings').updateOne(
    { key: 'khalti_qr' },
    { $setOnInsert: { value: '/images/khalti_qr.jpg' } },
    { upsert: true }
  );
  console.log('Seeded / Verified database collections for integration check.');

  // 1. Register test user
  console.log('\nStep 1: Registering new customer...');
  const regRes = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Test Customer',
    email: 'testuser@gmail.com',
    password: 'password123',
    whatsApp: '+977-9800000000'
  });

  if (regRes.status !== 201 || !regRes.body.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
  }
  const customerToken = regRes.body.token;
  console.log('Customer registered successfully and received a login token.');

  // 4. Place order with Multer file upload
  console.log('\nStep 2: Simulating purchase checkout with receipt upload...');
  
  // Create a dummy image receipt file
  const dummyReceiptPath = path.join(__dirname, 'dummy_receipt.jpg');
  fs.writeFileSync(dummyReceiptPath, 'DUMMY IMAGE RECEIPT CONTENT');
  
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fileContent = fs.readFileSync(dummyReceiptPath);
  
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="platform"\r\n\r\nNetflix\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="planSelected"\r\n\r\nPremium UHD\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="amountPaidNPR"\r\n\r\n1100\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="targetStreamingGmail"\r\n\r\nmynetflix@gmail.com\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="targetStreamingPassword"\r\n\r\nnetflix123!\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="paymentMethod"\r\n\r\neSewa\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="screenshot"; filename="receipt.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    fileContent,
    `\r\n--${boundary}--\r\n`
  ];

  const payload = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));

  const orderRes = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/orders/place-order',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${customerToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    }
  }, payload, true);

  // Clean up dummy local receipt file
  if (fs.existsSync(dummyReceiptPath)) fs.unlinkSync(dummyReceiptPath);

  if (orderRes.status !== 201 || !orderRes.body.success) {
    throw new Error(`Order placement failed: ${JSON.stringify(orderRes.body)}`);
  }
  console.log(`Order placed successfully! Order ID: ${orderRes.body.order._id}. Status: ${orderRes.body.order.status}`);

  // 5. Query user orders
  console.log('\nStep 3: Checking customer dashboard history...');
  const historyRes = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/orders/my-orders',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });

  if (historyRes.status !== 200 || historyRes.body.orders.length !== 1) {
    throw new Error(`History query failed: ${JSON.stringify(historyRes.body)}`);
  }
  console.log(`Customer dashboard displays order with status: ${historyRes.body.orders[0].status}`);

  // 6. Login pre-seeded Admin user
  console.log('\nStep 4: Logging in pre-seeded system administrator...');
  const adminLogin = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'kumaryada263@gmail.com',
    password: '12345'
  });

  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
  }

  const adminToken = adminLogin.body.token;
  console.log('Administrator account logged in.');

  // 7. Get global orders as Admin
  console.log('\nStep 5: Querying all global incoming orders as administrator...');
  const globalOrders = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/orders/admin/all',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const foundPlacedOrder = globalOrders.body.orders.some(o => o._id.toString() === orderRes.body.order._id.toString());
  if (globalOrders.status !== 200 || !foundPlacedOrder) {
    throw new Error(`Admin global orders query failed to find placed order: ${JSON.stringify(globalOrders.body)}`);
  }
  console.log(`Admin panel successfully retrieved global orders and found placed test order.`);

  // 8. Get customers as Admin
  console.log('\nStep 6: Querying customer list as administrator...');
  const customerList = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/admin/customers',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const foundCustomer = customerList.body.customers.some(c => c.email === 'testuser@gmail.com');
  if (customerList.status !== 200 || !foundCustomer) {
    throw new Error(`Admin customer list failed to find test customer: ${JSON.stringify(customerList.body)}`);
  }
  console.log(`Admin customer list shows ${customerList.body.totalCustomers} customer account(s).`);

  // 9. Update status to Active as Admin
  console.log('\nStep 7: Activating order and marking it as Active...');
  const updateRes = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: `/api/orders/admin/update-status/${orderRes.body.order._id}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { status: 'Active' });

  if (updateRes.status !== 200 || !updateRes.body.success) {
    throw new Error(`Admin status update failed: ${JSON.stringify(updateRes.body)}`);
  }
  console.log('Admin marked activation order as Active.');

  // 10. Re-check my orders as Customer
  console.log('\nStep 8: Checking customer history to verify activation status...');
  const finalCheck = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/orders/my-orders',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });

  if (finalCheck.body.orders[0].status !== 'Active') {
    throw new Error(`Order was not activated successfully. Current status: ${finalCheck.body.orders[0].status}`);
  }
  console.log('Customer dashboard reflects updated status: Active.');

  // 11. Check email configuration status and test validation as Admin
  console.log('\nStep 9: Checking admin email sender status and validation...');
  const emailStatusRes = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/admin/email-status',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (emailStatusRes.status !== 200) {
    throw new Error(`Admin email status check failed: ${JSON.stringify(emailStatusRes.body)}`);
  }
  console.log(`Email sender status check verified. Configured: ${emailStatusRes.body.configured}`);

  // Test send email validation (invalid email format should reject)
  const invalidEmailRes = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/admin/send-email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    recipientEmail: 'invalid-email-address',
    subject: 'Test Subject',
    message: 'Test Message'
  });
  if (invalidEmailRes.status !== 400 || !invalidEmailRes.body.message.includes('valid recipient email')) {
    throw new Error(`Email validation check failed: ${JSON.stringify(invalidEmailRes.body)}`);
  }
  console.log('Admin email validation correctly rejected invalid email format.');

  // 12. Delete customer account
  console.log('\nStep 10: Deleting customer account...');
  const deleteAccount = await makeRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/me',
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });

  if (deleteAccount.status !== 200 || !deleteAccount.body.success) {
    throw new Error(`Customer account deletion failed: ${JSON.stringify(deleteAccount.body)}`);
  }
  console.log('Customer account deleted successfully.');

  console.log('\n======================================');
  console.log('✓ ALL INTEGRATION TESTS PASSED CLEANLY!');
  console.log('======================================\n');

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('❌ INTEGRATION TEST FAILED:', err);
  await mongoose.disconnect();
  process.exit(1);
});
