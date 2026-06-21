const { remote } = require('webdriverio');

const APPIUM_PORT = 4723;
const APK_PATH = 'C:/Users/HP/Projects/TRUTH GUARD/app/build/outputs/apk/debug/app-debug.apk';

async function main() {
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

  console.log('Connecting to Appium...');
  const driver = await remote(wdOpts);
  console.log('Session started. Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Dumping page source...');
  const src = await driver.getPageSource();
  console.log('Page Source:\n', src);
  
  await driver.deleteSession();
}

main().catch(console.error);
