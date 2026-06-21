const { remote } = require('webdriverio');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const APPIUM_PORT = 4725; // Use a different port to avoid conflict
const APK_PATH = 'C:/Users/HP/Projects/TRUTH GUARD/app/build/outputs/apk/debug/app-debug.apk';
const ADB_PATH = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const ANDROID_SDK = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk';

process.env.JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';
process.env.ANDROID_HOME = ANDROID_SDK;
process.env.ANDROID_SDK_ROOT = ANDROID_SDK;
process.env.PATH = (process.env.PATH || '') +
  `;C:\\Program Files\\Android\\Android Studio\\jbr\\bin` +
  `;${ANDROID_SDK}\\platform-tools`;

async function main() {
  // Dismiss keyguard & any System UI dialogs first
  const execSync = require('child_process').execSync;
  console.log('Dismissing keyguard and system UI alerts...');
  try {
    execSync(`"${ADB_PATH}" shell wm dismiss-keyguard`);
    execSync(`"${ADB_PATH}" shell input keyevent 4`);
    execSync(`"${ADB_PATH}" shell input keyevent 4`);
  } catch (e) {
    console.warn('ADB command failed:', e.message);
  }

  console.log('Spawning Appium server on port', APPIUM_PORT);
  const appiumProcess = spawn('node', [
    path.join(__dirname, 'node_modules', 'appium', 'build', 'lib', 'main.js'),
    '--port', APPIUM_PORT.toString()
  ], {
    shell: false,
    stdio: 'ignore',
    env: { ...process.env }
  });

  // Wait for Appium to start
  await new Promise(r => setTimeout(r, 5000));

  const wdOpts = {
    hostname: '127.0.0.1',
    port: APPIUM_PORT,
    path: '/',
    protocol: 'http',
    logLevel: 'warn',
    transformRequest: (requestOptions) => {
      if (requestOptions.headers && typeof requestOptions.headers.delete === 'function') {
        requestOptions.headers.delete('Connection');
        requestOptions.headers.delete('Content-Length');
      }
      return requestOptions;
    },
    capabilities: {
      platformName: 'Android',
      'appium:deviceName': 'emulator-5554',
      'appium:udid': 'emulator-5554',
      'appium:app': APK_PATH,
      'appium:automationName': 'UiAutomator2',
      'appium:autoGrantPermissions': true,
      'appium:uiautomator2ServerLaunchTimeout': 90000,
    }
  };

  console.log('Connecting WebdriverIO client...');
  let driver;
  try {
    driver = await remote(wdOpts);
    console.log('Session started. Waiting 10s for application launch and settle...');
    await new Promise(r => setTimeout(r, 10000));

    console.log('Getting page source XML...');
    const src = await driver.getPageSource();
    console.log('====================================');
    console.log('PAGE SOURCE XML:');
    console.log('====================================');
    console.log(src);
    console.log('====================================');
  } catch (err) {
    console.error('Test run failed:', err);
  } finally {
    if (driver) {
      await driver.deleteSession().catch(() => {});
    }
    appiumProcess.kill();
  }
}

main().catch(console.error);
