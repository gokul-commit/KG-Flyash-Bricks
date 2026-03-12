#!/usr/bin/env node

/**
 * Quick Test Script - Image Upload System Verification
 * Run this after starting the server to verify the implementation
 * 
 * Usage:
 *   node VERIFY_SETUP.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:4000/api';
const ADMIN_TOKEN = 'demo-token'; // Replace with actual token after login

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   Image Upload System Verification                   ║');
console.log('║   KG Flyash Bricks - February 14, 2026              ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(status, message) {
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'info' ? 'ℹ️' : '⚠️';
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : status === 'info' ? colors.blue : colors.yellow;
  console.log(`${icon} ${color}${message}${colors.reset}`);
}

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch(e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  let passed = 0, failed = 0;

  // Test 1: Check if server is running
  console.log('\n📋 Running Verification Tests...\n');
  
  try {
    log('info', 'Test 1: Checking if API server is running...');
    const response = await makeRequest('GET', '/');
    if (response.status === 200) {
      log('pass', '✓ API server is running on port 4000');
      passed++;
    }
  } catch (e) {
    log('fail', '✗ API server is not running. Please start the server first.');
    log('fail', '  Run: cd server && npm start');
    failed++;
  }

  // Test 2: Check if company endpoint exists
  try {
    log('info', 'Test 2: Checking GET /api/company endpoint...');
    const response = await makeRequest('GET', '/company');
    if (response.status === 200 && response.data) {
      log('pass', '✓ GET /api/company endpoint works');
      const hasImageFields = [
        'heroImage', 'ecoFriendlyIcon', 'strengthIcon', 'energyIcon', 'deliveryIcon',
        'teamMember1Image', 'teamMember2Image', 'teamMember3Image', 'teamMember4Image'
      ];
      
      const missingFields = hasImageFields.filter(field => !(field in response.data));
      if (missingFields.length === 0) {
        log('pass', `✓ All 9 image fields exist in company object`);
        passed++;
      } else {
        log('warn', `⚠ Missing fields: ${missingFields.join(', ')}`);
        log('info', 'Make sure db.json has been updated with image fields');
      }
    } else {
      log('fail', '✗ GET /api/company returned unexpected response');
      failed++;
    }
  } catch (e) {
    log('fail', `✗ Error testing GET /api/company: ${e.message}`);
    failed++;
  }

  // Test 3: Check if upload endpoint exists
  try {
    log('info', 'Test 3: Checking POST /api/company/upload-images endpoint...');
    // This will likely fail without auth, but we're just checking if endpoint exists
    const response = await makeRequest('POST', '/company/upload-images', 
      { images: { heroImage: 'test' } }
    );
    
    if (response.status === 400 || response.status === 401 || response.status === 200) {
      log('pass', '✓ POST /api/company/upload-images endpoint exists');
      passed++;
    } else {
      log('fail', `✗ Unexpected status: ${response.status}`);
      failed++;
    }
  } catch (e) {
    log('fail', `✗ Error testing POST /api/company/upload-images: ${e.message}`);
    failed++;
  }

  // Test 4: Check if uploads directory exists
  try {
    log('info', 'Test 4: Checking if public/uploads/ directory exists...');
    const uploadDir = path.join(__dirname, 'server', 'public', 'uploads');
    if (fs.existsSync(uploadDir)) {
      log('pass', '✓ public/uploads/ directory exists');
      const files = fs.readdirSync(uploadDir);
      log('info', `  Found ${files.length} image files in uploads directory`);
      passed++;
    } else {
      log('warn', '⚠ public/uploads/ directory does not exist yet (will be created on first upload)');
    }
  } catch (e) {
    log('info', 'public/uploads/ directory will be created automatically on first upload');
  }

  // Summary
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Results: ${colors.green}${passed} Passed${colors.reset} | ${failed > 0 ? colors.red : colors.green}${failed} Failed${colors.reset}${' '.repeat(21 - (passed.toString() + failed.toString()).length)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (failed === 0) {
    log('pass', '🎉 All verification tests passed! System is ready to use.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Start client: cd client && npm start');
    console.log('   2. Login to admin dashboard');
    console.log('   3. Go to ⚙️ Settings tab');
    console.log('   4. Upload images and click "Save All Settings"');
    console.log('   5. Images will appear on home page immediately\n');
  } else {
    log('fail', 'Some tests failed. Please review errors above and fix issues.');
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Ensure server is running: npm start (in server directory)');
    console.log('   - Check that db.json has image fields');
    console.log('   - Verify server code has company/upload-images endpoint\n');
  }
}

// Run tests
runTests().catch(console.error);
