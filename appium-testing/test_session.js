// Minimal test: raw HTTP POST to Appium /session
const http = require('http');

const body = JSON.stringify({
  capabilities: {
    alwaysMatch: {
      platformName: 'Android',
      'appium:deviceName': 'emulator-5554',
      'appium:udid': 'emulator-5554',
      'appium:app': 'C:\\Users\\HP\\Projects\\TRUTH GUARD\\app\\build\\outputs\\apk\\debug\\app-debug.apk',
      'appium:automationName': 'UiAutomator2',
      'appium:autoGrantPermissions': true,
    }
  }
});

const options = {
  hostname: '127.0.0.1',
  port: 4723,
  path: '/session',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log('Sending POST to http://127.0.0.1:4723/session ...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      if (json.value && json.value.sessionId) {
        console.log('✅ Session created! ID:', json.value.sessionId);
        // Delete the session
        const del = http.request({
          hostname: '127.0.0.1', port: 4723,
          path: `/session/${json.value.sessionId}`,
          method: 'DELETE',
        }, (r) => { console.log('Session deleted'); });
        del.end();
      } else {
        console.log('❌ Response:', JSON.stringify(json, null, 2).substring(0, 1000));
      }
    } catch (e) {
      console.log('Raw response:', data.substring(0, 1000));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(body);
req.end();
