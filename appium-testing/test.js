/**
 * TruthGuard Android Application - Appium E2E Test Suite
 * 64 Test Cases covering all Compose modules and user flows
 * Report: Appium_E2E_Report_TruthGuard.xlsx
 */

const { remote } = require('webdriverio');
const ExcelJS = require('exceljs');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const APPIUM_PORT = 4723;
// Use forward slashes — required for WebDriverIO on Windows
const APK_PATH = 'C:/Users/HP/Projects/TRUTH GUARD/app/build/outputs/apk/debug/app-debug.apk';
const REPORT_FILE = path.join(__dirname, `Appium_E2E_Report_TruthGuard_${new Date().toISOString().replace(/[:.]/g, '-').slice(0,19)}.xlsx`);
const ADB_PATH = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe';
const ANDROID_SDK = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk';

// ── Inject Android SDK and Java env vars immediately so all child processes inherit them
process.env.JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';
process.env.ANDROID_HOME = ANDROID_SDK;
process.env.ANDROID_SDK_ROOT = ANDROID_SDK;
process.env.PATH = (process.env.PATH || '') +
  `;C:\\Program Files\\Android\\Android Studio\\jbr\\bin` +
  `;${ANDROID_SDK}\\platform-tools` +
  `;${ANDROID_SDK}\\tools` +
  `;${ANDROID_SDK}\\emulator`;

let appiumProcess = null;
let driver = null;
const results = [];
let suiteStart = Date.now();

// ─── COLORS ───────────────────────────────────────────────────────────────────
const COLORS = {
  headerBg:   '1A1A2E',   // Dark navy
  headerText: 'FFFFFF',
  subHeaderBg:'16213E',
  moduleBg:   '0F3460',
  moduleText: 'E94560',
  passedBg:   'D4EDDA',
  passedText: '155724',
  failedBg:   'F8D7DA',
  failedText: '721C24',
  skippedBg:  'FFF3CD',
  skippedText:'856404',
  rowAlt:     'F8F9FA',
  rowNorm:    'FFFFFF',
  accent:     '0F3460',
  statPass:   '28A745',
  statFail:   'DC3545',
  statTotal:  '17A2B8',
  border:     'BDC3C7',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function log(status, id, name, duration, err = '') {
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️';
  console.log(`  ${icon} [${id}] ${name} (${duration}ms)${err ? ' → ' + err.substring(0, 80) : ''}`);
}

function record(module, id, name, desc, status, duration, error = '') {
  results.push({ module, id, name, desc, status, duration, error });
  log(status, id, name, duration, error);
}

async function dismissSystemAlerts() {
  try {
    const dialogTitle = await driver.$('android=new UiSelector().resourceId("android:id/alertTitle")');
    if (await dialogTitle.isExisting()) {
      const text = await dialogTitle.getText();
      if (text.includes("responding") || text.includes("System UI")) {
        console.log('⚠️ System UI alert detected. Dismissing...');
        const waitBtn = await driver.$('android=new UiSelector().resourceId("android:id/aerr_wait")');
        if (await waitBtn.isExisting()) {
          await waitBtn.click();
          console.log('   Clicked "Wait" button.');
          await driver.pause(1000);
        }
      }
    }
  } catch (e) {
    // Ignore any errors during dismissal check
  }
}

async function tc(module, id, name, desc, fn) {
  const t0 = Date.now();
  try {
    await dismissSystemAlerts();
    await fn();
    record(module, id, name, desc, 'PASSED', Date.now() - t0);
  } catch (e) {
    record(module, id, name, desc, 'FAILED', Date.now() - t0, e.message || String(e));
  }
}

function runCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => {
      if (err) resolve('');
      else resolve(stdout.trim());
    });
  });
}

function checkPort(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.connect(port, '127.0.0.1', () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => {
      resolve(false);
    });
  });
}

async function getElByText(text) {
  await dismissSystemAlerts();
  return await driver.$(`android=new UiSelector().textContains("${text}")`);
}

async function clickText(text) {
  await dismissSystemAlerts();
  const el = await getElByText(text);
  await el.waitForExist({ timeout: 10000 });
  await el.click();
  await driver.pause(1000);
}

async function goBack() {
  await dismissSystemAlerts();
  await driver.back();
  await driver.pause(1000);
}

async function assertTextPresent(text) {
  await dismissSystemAlerts();
  const el = await driver.$(`android=new UiSelector().textContains("${text}")`);
  const exist = await el.isExisting();
  if (!exist) throw new Error(`Text "${text}" not found on screen`);
}

// ─── APPIUM SERVER & EMULATOR LIFECYCLE ───────────────────────────────────────
async function startAppiumServer() {
  if (await checkPort(APPIUM_PORT)) {
    console.log(`📡 Appium server already running on port ${APPIUM_PORT}. Reusing.`);
    // Kill and restart to ensure it has ANDROID_HOME in its env
    return;
  }
  console.log('⏳ Spawning Appium server...');
  appiumProcess = spawn('node', [
    path.join(__dirname, 'node_modules', 'appium', 'build', 'lib', 'main.js'),
    '--port', APPIUM_PORT.toString()
  ], {
    shell: false,
    stdio: 'pipe',
    env: { ...process.env }  // inherits ANDROID_HOME we set above
  });

  appiumProcess.stdout.on('data', (data) => {
    process.stdout.write(`[Appium] ${data}`);
  });
  appiumProcess.stderr.on('data', (data) => {
    process.stderr.write(`[Appium ERR] ${data}`);
  });

  let appiumReady = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await checkPort(APPIUM_PORT)) {
      appiumReady = true;
      break;
    }
  }

  if (!appiumReady) {
    throw new Error(`Appium server failed to start on port ${APPIUM_PORT}`);
  }
  console.log('🚀 Appium server started successfully.');
}

async function verifyEmulatorBooted() {
  const adbCall = `"${ADB_PATH}"`;
  console.log('⏳ Checking if Android device/emulator is online...');
  
  // Wait for at least one device to show up in ADB
  let deviceFound = false;
  let devices = await runCmd(`${adbCall} devices`);
  if (devices.includes('\tdevice') || devices.includes('emulator-5554')) {
    deviceFound = true;
  }

  if (!deviceFound) {
    console.log('⏳ No online emulator detected. Launching Pixel_6 AVD...');
    const emulatorCall = 'C:\\Users\\HP\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe';
    try {
      const child = spawn(emulatorCall, ['-avd', 'Pixel_6', '-no-snapshot', '-no-boot-anim'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log('   Emulator process spawned. Waiting for ADB registration...');
    } catch (e) {
      console.log(`   ⚠️ Failed to spawn emulator programmatically: ${e.message}`);
    }

    // Now wait up to 60 seconds for ADB to see the device
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      devices = await runCmd(`${adbCall} devices`);
      if (devices.includes('\tdevice') || devices.includes('emulator-5554')) {
        deviceFound = true;
        break;
      }
      console.log('   Waiting for device to register with ADB...');
    }
  }

  if (!deviceFound) {
    throw new Error('No online Android emulator or device detected by ADB');
  }

  console.log('⏳ Waiting for system boot animations to finish...');
  let booted = false;
  for (let i = 0; i < 45; i++) {
    const bootCompleted = await runCmd(`${adbCall} shell getprop sys.boot_completed`);
    if (bootCompleted === '1') {
      booted = true;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!booted) {
    console.log('⚠️ Warning: sys.boot_completed did not return 1, but continuing tests anyway...');
  } else {
    console.log('✅ Android emulator fully booted and ready.');
  }

  // Dismiss keyguard/lockscreen if active
  await runCmd(`${adbCall} shell wm dismiss-keyguard`);
  // Dismiss any system UI unresponsive alerts/dialogs
  await runCmd(`${adbCall} shell input keyevent 4`);
  await runCmd(`${adbCall} shell input keyevent 4`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════
async function runTests() {
  // Verify APK exists before attempting to connect
  const apkNative = APK_PATH.replace(/\//g, path.sep);
  if (!fs.existsSync(apkNative)) {
    throw new Error(`APK not found at path: ${apkNative}`);
  }
  console.log(`📦 APK found: ${apkNative}`);

  const wdOpts = {
    hostname: '127.0.0.1',
    port: APPIUM_PORT,
    path: '/',
    protocol: 'http',
    logLevel: 'warn',
    connectionRetryTimeout: 180000,
    connectionRetryCount: 3,
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
      'appium:app': apkNative,
      'appium:automationName': 'UiAutomator2',
      'appium:newCommandTimeout': 3600,
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:uiautomator2ServerLaunchTimeout': 90000,
      'appium:uiautomator2ServerInstallTimeout': 90000,
      'appium:androidInstallTimeout': 90000,
      'appium:adbExecTimeout': 60000,
    }
  };

  console.log('\n🧪 Initializing Appium WebDriver client...');
  driver = await remote(wdOpts);
  console.log('📲 TruthGuard Android App launched successfully.');

  // ── MODULE 1: APP LOAD & GLOBAL STRUCTURE ──────────────
  console.log('\n📋 MODULE 1: App Load & Global Structure');

  await tc('App Load', 'TC-001', 'App loads successfully', 'Verify the package loads without crash', async () => {
    const pkg = await driver.getCurrentPackage();
    if (!pkg.includes('truthguard')) throw new Error(`Unexpected package: ${pkg}`);
  });

  await tc('App Load', 'TC-002', 'Home screen title correct', 'Title text "TRUTHGUARD" is visible', async () => {
    await assertTextPresent('TRUTHGUARD');
  });

  await tc('App Load', 'TC-003', 'Hero subtitle visible', 'Subtitle "AI Powered Fake News Detection" is visible', async () => {
    await assertTextPresent('AI Powered Fake News Detection');
  });

  await tc('App Load', 'TC-004', 'Shield emoji logo visible', 'Shield logo text "🛡️" is visible', async () => {
    await assertTextPresent('🛡️');
  });

  await tc('App Load', 'TC-005', 'Verify News button exists', 'Button containing text "Verify News" is visible', async () => {
    const btn = await getElByText('Verify News');
    if (!await btn.isExisting()) throw new Error('Verify News button not found');
  });

  await tc('App Load', 'TC-006', 'Trending News button exists', 'Button containing text "Trending News" is visible', async () => {
    const btn = await getElByText('Trending News');
    if (!await btn.isExisting()) throw new Error('Trending News button not found');
  });

  await tc('App Load', 'TC-007', 'Dashboard button exists', 'Button containing text "Dashboard" is visible', async () => {
    const btn = await getElByText('Dashboard');
    if (!await btn.isExisting()) throw new Error('Dashboard button not found');
  });

  await tc('App Load', 'TC-008', 'About button exists', 'Button containing text "About" is visible', async () => {
    const btn = await getElByText('About');
    if (!await btn.isExisting()) throw new Error('About button not found');
  });

  await tc('App Load', 'TC-009', 'Version indicator visible', 'Version text "Version 1.0" is visible', async () => {
    await assertTextPresent('Version 1.0');
  });

  // ── MODULE 2: SIDEBAR / SCREEN NAVIGATION ──────────────
  console.log('\n📋 MODULE 2: Sidebar / Screen Navigation');

  await tc('Navigation', 'TC-010', 'Navigate Home → Verify Screen', 'Click Verify News and verify Verify Screen is active', async () => {
    await clickText('Verify News');
    await assertTextPresent('Verify News');
  });

  await tc('Navigation', 'TC-011', 'Navigate Verify Screen → Home', 'Press system Back button and verify Home Screen is active', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  await tc('Navigation', 'TC-012', 'Navigate Home → Trending Screen', 'Click Trending News and verify Trending Screen is active', async () => {
    await clickText('Trending News');
    await assertTextPresent('Trending News');
  });

  await tc('Navigation', 'TC-013', 'Navigate Trending Screen → Home', 'Press system Back button and verify Home Screen is active', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  await tc('Navigation', 'TC-014', 'Navigate Home → Dashboard Screen', 'Click Dashboard and verify Dashboard Screen is active', async () => {
    await clickText('Dashboard');
    await assertTextPresent('Dashboard');
  });

  await tc('Navigation', 'TC-015', 'Navigate Dashboard Screen → Home', 'Press system Back button and verify Home Screen is active', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  await tc('Navigation', 'TC-016', 'Navigate Home → About Screen', 'Click About and verify About Screen is active', async () => {
    await clickText('About');
    await assertTextPresent('TruthGuard');
  });

  await tc('Navigation', 'TC-017', 'Navigate About Screen → Home', 'Press system Back button and verify Home Screen is active', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  // ── MODULE 3: NEWS VERIFICATION SYSTEM ──────────────
  console.log('\n📋 MODULE 3: News Verification System');

  await tc('News Verification', 'TC-018', 'Outlined text field present', 'EditText input field is visible on Verify Screen', async () => {
    await clickText('Verify News');
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    if (!await input.isExisting()) throw new Error('EditText input field not found');
  });

  await tc('News Verification', 'TC-019', 'Analyze button present', 'Analyze button is visible on Verify Screen', async () => {
    const btn = await getElByText('Analyze');
    if (!await btn.isExisting()) throw new Error('Analyze button not found');
  });

  await tc('News Verification', 'TC-020', 'Analyze genuine news', 'Verify genuine news is analyzed correctly', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('NASA scientists confirm space mission successfully reached orbit around Earth.');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
  });

  await tc('News Verification', 'TC-021', 'Genuine result text is correct', 'Result card shows Likely Genuine News', async () => {
    await assertTextPresent('Likely Genuine News');
  });

  await tc('News Verification', 'TC-022', 'Genuine result confidence is 94%', 'Result confidence shows 94%', async () => {
    await assertTextPresent('94%');
  });

  await tc('News Verification', 'TC-023', 'Genuine recommendation correct', 'Result recommendation shows reliable message', async () => {
    await assertTextPresent('This news appears reliable');
  });

  await tc('News Verification', 'TC-024', 'Analyze fake news (using "fake")', 'Input contains "fake" → Likely Fake News', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('This is a completely fake news story about the government.');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
  });

  await tc('News Verification', 'TC-025', 'Fake result text is correct', 'Result card shows Likely Fake News', async () => {
    await assertTextPresent('Likely Fake News');
  });

  await tc('News Verification', 'TC-026', 'Fake result confidence is 88%', 'Result confidence shows 88%', async () => {
    await assertTextPresent('88%');
  });

  await tc('News Verification', 'TC-027', 'Fake recommendation correct', 'Result recommendation suggests verification', async () => {
    await assertTextPresent('Verify this news using trusted sources');
  });

  await tc('News Verification', 'TC-028', 'Analyze hoax news (using "hoax")', 'Input contains "hoax" → Likely Fake News', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('A dangerous hoax is spreading on social media.');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Fake News');
  });

  await tc('News Verification', 'TC-029', 'Analyze rumor news (using "rumor")', 'Input contains "rumor" → Likely Fake News', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('There is a rumor that local schools are closing tomorrow.');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Fake News');
  });

  await tc('News Verification', 'TC-030', 'Analyze clickbait news (using "clickbait")', 'Input contains "clickbait" → Likely Fake News', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('You wont believe this shocking clickbait headline!');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Fake News');
  });

  await tc('News Verification', 'TC-031', 'Analyze shocking news (using "shocking")', 'Input contains "shocking" → Likely Fake News', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('A shocking report reveals unexpected details.');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Fake News');
  });

  await tc('News Verification', 'TC-032', 'Empty verification behavior', 'Submitting empty text produces Likely Genuine News', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Genuine News');
  });

  await tc('News Verification', 'TC-033', 'Case-insensitive classification', 'UPPERCASE keyword "HOAX" triggers Fake', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    await input.setValue('THIS IS A MASSIVE HOAX REPORTED ONLINE.');
    const btn = await getElByText('Analyze');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Fake News');
  });

  await tc('News Verification', 'TC-034', 'Navigate back to home from Verify', 'Verify screen exit functions correctly', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  // ── MODULE 4: TRENDING NEWS ──────────────
  console.log('\n📋 MODULE 4: Trending News');

  await tc('Trending News', 'TC-035', 'Trending Screen header visible', 'Trending News header is rendered', async () => {
    await clickText('Trending News');
    await assertTextPresent('Trending News');
  });

  await tc('Trending News', 'TC-036', 'BBC News Item visible', 'Trending list contains BBC article', async () => {
    await assertTextPresent('BBC');
    await assertTextPresent('Scientists discover new climate monitoring technology');
  });

  await tc('Trending News', 'TC-037', 'Reuters News Item visible', 'Trending list contains Reuters article', async () => {
    await assertTextPresent('Reuters');
    await assertTextPresent('AI transforming healthcare worldwide');
  });

  await tc('Trending News', 'TC-038', 'NASA News Item visible', 'Trending list contains NASA article', async () => {
    await assertTextPresent('NASA');
    await assertTextPresent('Space mission successfully reaches orbit');
  });

  await tc('Trending News', 'TC-039', 'Bloomberg News Item visible', 'Trending list contains Bloomberg article', async () => {
    await assertTextPresent('Bloomberg');
    await assertTextPresent('Global economy shows positive growth');
  });

  await tc('Trending News', 'TC-040', 'UNESCO News Item visible', 'Trending list contains UNESCO article', async () => {
    await assertTextPresent('UNESCO');
    await assertTextPresent('Education sector adopts AI learning tools');
  });

  await tc('Trending News', 'TC-041', 'Navigate back to home from Trending', 'Trending screen exit functions correctly', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  // ── MODULE 5: DASHBOARD METRICS ──────────────
  console.log('\n📋 MODULE 5: Dashboard Metrics');

  await tc('Dashboard', 'TC-042', 'Dashboard Screen header visible', 'Dashboard header is rendered', async () => {
    await clickText('Dashboard');
    await assertTextPresent('Dashboard');
  });

  await tc('Dashboard', 'TC-043', 'Articles Verified card visible', 'Verified stat card shows label and value', async () => {
    await assertTextPresent('Articles Verified');
    await assertTextPresent('25');
  });

  await tc('Dashboard', 'TC-044', 'True News card visible', 'True news stat card shows label and value', async () => {
    await assertTextPresent('True News');
    await assertTextPresent('18');
  });

  await tc('Dashboard', 'TC-045', 'Fake News card visible', 'Fake news stat card shows label and value', async () => {
    await assertTextPresent('Fake News');
    await assertTextPresent('7');
  });

  await tc('Dashboard', 'TC-046', 'Accuracy card visible', 'Accuracy stat card shows label and value', async () => {
    await assertTextPresent('Accuracy');
    await assertTextPresent('92%');
  });

  await tc('Dashboard', 'TC-047', 'Navigate back to home from Dashboard', 'Dashboard screen exit functions correctly', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  // ── MODULE 6: ABOUT SCREEN DETAILS ──────────────
  console.log('\n📋 MODULE 6: About Screen Details');

  await tc('About', 'TC-048', 'About Screen header visible', 'About screen title is rendered', async () => {
    await clickText('About');
    await assertTextPresent('TruthGuard');
  });

  await tc('About', 'TC-049', 'Developer info visible', 'Educational purpose indicator text is visible', async () => {
    await assertTextPresent('Developed for Educational Purpose');
  });

  await tc('About', 'TC-050', 'Version label visible', 'Version info text "Version : 1.0" is visible', async () => {
    await assertTextPresent('Version : 1.0');
  });

  await tc('About', 'TC-051', 'Technology stack details visible', 'Kotlin technology tag is visible', async () => {
    await assertTextPresent('Technology : Kotlin + Jetpack Compose + AI');
  });

  await tc('About', 'TC-052', 'Copyright notice visible', 'Copyright notice text "© TruthGuard 2025" is visible', async () => {
    await assertTextPresent('© TruthGuard 2025');
  });

  await tc('About', 'TC-053', 'Navigate back to home from About', 'About screen exit functions correctly', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  // ── MODULE 7: ROBUSTNESS & EDGE CASES ──────────────
  console.log('\n📋 MODULE 7: Robustness & Edge Cases');

  await tc('Edge Cases', 'TC-054', 'Verify screen multiple analyses', 'Multiple sequential verifications work without screen crash', async () => {
    await clickText('Verify News');
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    const btn = await getElByText('Analyze');

    await input.setValue('First genuine news sample text.');
    await btn.click();
    await driver.pause(1000);
    await assertTextPresent('Likely Genuine News');

    await input.setValue('Second fake rumor sample text.');
    await btn.click();
    await driver.pause(1000);
    await assertTextPresent('Likely Fake News');
  });

  await tc('Edge Cases', 'TC-055', 'Verify back navigation clears screen state', 'Exiting and re-entering verify clears previous result card', async () => {
    await goBack();
    await clickText('Verify News');
    const resultCardTitle = await driver.$('android=new UiSelector().text("Analysis Result")');
    if (await resultCardTitle.isExisting()) throw new Error('Result card should be hidden on fresh load');
  });

  await tc('Edge Cases', 'TC-056', 'Verify long input handling', 'Inputting extremely long text does not cause UI lag/crash', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    const btn = await getElByText('Analyze');
    const longText = 'A '.repeat(500) + 'genuine news report.';
    await input.setValue(longText);
    await btn.click();
    await driver.pause(2000);
    await assertTextPresent('Likely Genuine News');
  });

  await tc('Edge Cases', 'TC-057', 'Verify special characters input', 'Text containing emojis and symbols is processed correctly', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    const btn = await getElByText('Analyze');
    await input.setValue('Climate report! 🌍🔥 (Fake facts reported by bloggers).');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Fake News');
  });

  await tc('Edge Cases', 'TC-058', 'Verify input with only whitespace', 'Text containing only spaces behaves as genuine', async () => {
    const input = await driver.$('android=new UiSelector().className("android.widget.EditText")');
    const btn = await getElByText('Analyze');
    await input.setValue('     ');
    await btn.click();
    await driver.pause(1500);
    await assertTextPresent('Likely Genuine News');
  });

  await tc('Edge Cases', 'TC-059', 'Exit verify screen at end', 'Return to home screen', async () => {
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  // ── MODULE 8: END-TO-END FLOW INTEGRATION ──────────────
  console.log('\n📋 MODULE 8: End-to-End Flow Integration');

  await tc('E2E Flow', 'TC-060', 'Navigate all screens sequentially', 'All screens open and transition successfully', async () => {
    await clickText('Verify News');
    await goBack();
    await clickText('Trending News');
    await goBack();
    await clickText('Dashboard');
    await goBack();
    await clickText('About');
    await goBack();
    await assertTextPresent('TRUTHGUARD');
  });

  await tc('E2E Flow', 'TC-061', 'Dashboard counts verification count consistency', 'Articles Verified shows expected default baseline', async () => {
    await clickText('Dashboard');
    await assertTextPresent('25');
    await goBack();
  });

  await tc('E2E Flow', 'TC-062', 'Dashboard accuracy percentage consistency', 'Accuracy shows expected default baseline', async () => {
    await clickText('Dashboard');
    await assertTextPresent('92%');
    await goBack();
  });

  await tc('E2E Flow', 'TC-063', 'Dashboard fake count consistency', 'Fake News shows expected default baseline', async () => {
    await clickText('Dashboard');
    await assertTextPresent('7');
    await goBack();
  });

  await tc('E2E Flow', 'TC-064', 'Dashboard true count consistency', 'True News shows expected default baseline', async () => {
    await clickText('Dashboard');
    await assertTextPresent('18');
    await goBack();
  });

  console.log('\n✅ All tests completed.');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXCEL REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════
async function generateReport() {
  console.log('\n📊 Generating Excel Report...');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TruthGuard Appium Suite';
  wb.created = new Date();

  // ── Summary Sheet ──────────────────────────────────────────────────────────
  const summary = wb.addWorksheet('📋 Summary', { views: [{ showGridLines: false }] });

  const passed  = results.filter(r => r.status === 'PASSED').length;
  const failed  = results.filter(r => r.status === 'FAILED').length;
  const total   = results.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const duration = ((Date.now() - suiteStart) / 1000).toFixed(1);

  // Title banner
  summary.mergeCells('A1:H1');
  const titleCell = summary.getCell('A1');
  titleCell.value = '🛡️  TRUTHGUARD ANDROID APP  —  APPIUM E2E TEST REPORT';
  titleCell.font   = { name: 'Outfit', size: 16, bold: true, color: { argb: `FF${COLORS.headerText}` } };
  titleCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.headerBg}` } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summary.getRow(1).height = 52;

  // Subtitle bar
  summary.mergeCells('A2:H2');
  const subCell = summary.getCell('A2');
  subCell.value = `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  |  Engine: Appium 2.x + UiAutomator2  |  Device: Android Emulator (Pixel_6)`;
  subCell.font  = { name: 'Plus Jakarta Sans', size: 10, color: { argb: 'FFB0C4DE' } };
  subCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.subHeaderBg}` } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summary.getRow(2).height = 26;

  summary.addRow([]);

  // KPI Stat boxes (row 4)
  const kpis = [
    { label: 'TOTAL TESTS', value: total,    fg: COLORS.statTotal, col: 'B' },
    { label: 'PASSED',      value: passed,   fg: COLORS.statPass,  col: 'D' },
    { label: 'FAILED',      value: failed,   fg: COLORS.statFail,  col: 'F' },
    { label: 'PASS RATE',   value: `${passRate}%`, fg: COLORS.accent, col: 'H' },
  ];
  for (const kpi of kpis) {
    summary.mergeCells(`${kpi.col}4:${kpi.col}5`);
    const c = summary.getCell(`${kpi.col}4`);
    c.value     = kpi.value;
    c.font      = { name: 'Outfit', size: 28, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${kpi.fg}` } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };

    summary.mergeCells(`${kpi.col}6:${kpi.col}6`);
    const labelCell = summary.getCell(`${kpi.col}6`);
    labelCell.value = kpi.label;
    labelCell.font  = { name: 'Plus Jakarta Sans', size: 9, bold: true, color: { argb: `FF${kpi.fg}` } };
    labelCell.alignment = { horizontal: 'center' };
  }
  summary.getRow(4).height = 44;
  summary.getRow(5).height = 44;
  summary.getRow(6).height = 18;

  summary.addRow([]);
  summary.addRow([]);

  // Execution details table
  const detailsHeaders = [
    ['Test Suite', 'TruthGuard Android Application E2E'],
    ['Target Device', 'Android Emulator (Pixel_6)'],
    ['Total Test Cases', total],
    ['Passed', passed],
    ['Failed', failed],
    ['Pass Rate', `${passRate}%`],
    ['Total Duration', `${duration}s`],
    ['Automation Engine', 'Appium 2.x + UiAutomator2'],
    ['Test Client', 'WebdriverIO v8'],
    ['Test Framework', 'Node.js Custom Runner'],
    ['Report Generated', new Date().toLocaleString('en-IN')],
  ];

  summary.addRow(['', 'EXECUTION DETAILS', '', '', '', '', '', '']);
  const detTitleRow = summary.lastRow;
  detTitleRow.height = 26;
  summary.mergeCells(`B${detTitleRow.number}:H${detTitleRow.number}`);
  summary.getCell(`B${detTitleRow.number}`).font = { name: 'Plus Jakarta Sans', bold: true, size: 12, color: { argb: `FF${COLORS.accent}` } };
  summary.getCell(`B${detTitleRow.number}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };

  for (const [label, value] of detailsHeaders) {
    summary.addRow(['', label, '', value]);
    const r = summary.lastRow;
    r.height = 20;
    r.getCell(2).font = { name: 'Plus Jakarta Sans', bold: true, size: 10 };
    r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
    r.getCell(4).font = { name: 'Plus Jakarta Sans', size: 10 };
    summary.mergeCells(`D${r.number}:H${r.number}`);
  }

  // Module summary section
  summary.addRow([]);
  const moduleRow = summary.addRow(['', 'MODULE BREAKDOWN', '', '', '', '', '', '']);
  summary.mergeCells(`B${moduleRow.number}:H${moduleRow.number}`);
  summary.getCell(`B${moduleRow.number}`).font = { name: 'Plus Jakarta Sans', bold: true, size: 12, color: { argb: `FF${COLORS.accent}` } };
  summary.getCell(`B${moduleRow.number}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  moduleRow.height = 26;

  const modules = [...new Set(results.map(r => r.module))];
  const modHeaderRow = summary.addRow(['', 'Module', '', 'Total', 'Passed', 'Failed', 'Pass Rate', '']);
  modHeaderRow.height = 22;
  ['B','D','E','F','G'].forEach(col => {
    const c = summary.getCell(`${col}${modHeaderRow.number}`);
    c.font = { name: 'Plus Jakarta Sans', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.accent}` } };
    c.alignment = { horizontal: 'center' };
  });

  for (const mod of modules) {
    const modResults = results.filter(r => r.module === mod);
    const mPass = modResults.filter(r => r.status === 'PASSED').length;
    const mFail = modResults.filter(r => r.status === 'FAILED').length;
    const mRate = Math.round((mPass / modResults.length) * 100);
    const mRow = summary.addRow(['', mod, '', modResults.length, mPass, mFail, `${mRate}%`, '']);
    mRow.height = 20;
    mRow.getCell(2).font = { name: 'Plus Jakarta Sans', size: 10, bold: true };
    mRow.getCell(4).alignment = mRow.getCell(5).alignment = mRow.getCell(6).alignment = mRow.getCell(7).alignment = { horizontal: 'center' };
    mRow.getCell(5).font = { name: 'Plus Jakarta Sans', size: 10, color: { argb: `FF${COLORS.statPass}` } };
    mRow.getCell(6).font = { name: 'Plus Jakarta Sans', size: 10, color: { argb: `FF${COLORS.statFail}` } };
    mRow.getCell(7).font = { name: 'Plus Jakarta Sans', size: 10, bold: true };
  }

  summary.columns = [
    { width: 2 }, { width: 30 }, { width: 4 }, { width: 18 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 2 }
  ];

  // ── Test Cases Sheet ────────────────────────────────────────────────────────
  const tcSheet = wb.addWorksheet('🧪 Test Cases', { views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }] });

  // Title banner
  tcSheet.mergeCells('A1:H1');
  const tcTitle = tcSheet.getCell('A1');
  tcTitle.value = '🛡️  TRUTHGUARD ANDROID — APPIUM TEST CASES DETAIL';
  tcTitle.font  = { name: 'Outfit', size: 15, bold: true, color: { argb: `FF${COLORS.headerText}` } };
  tcTitle.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.headerBg}` } };
  tcTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  tcSheet.getRow(1).height = 44;

  // Info bar
  tcSheet.mergeCells('A2:H2');
  const tcInfo = tcSheet.getCell('A2');
  tcInfo.value = `Total: ${total} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${passRate}% | Duration: ${duration}s`;
  tcInfo.font  = { name: 'Plus Jakarta Sans', size: 10, color: { argb: 'FFFFFFFF' } };
  tcInfo.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.subHeaderBg}` } };
  tcInfo.alignment = { vertical: 'middle', horizontal: 'center' };
  tcSheet.getRow(2).height = 22;

  // Column headers
  const headers = ['#', 'Test ID', 'Module', 'Test Case Name', 'Description', 'Status', 'Duration (ms)', 'Error / Notes'];
  tcSheet.addRow(headers);
  const hRow = tcSheet.lastRow;
  hRow.height = 30;
  hRow.eachCell((cell, col) => {
    cell.font      = { name: 'Plus Jakarta Sans', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.accent}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border    = { bottom: { style: 'medium', color: { argb: `FF${COLORS.moduleText}` } } };
  });

  // Data rows
  let rowIndex = 0;
  let currentModule = null;
  for (const r of results) {
    rowIndex++;

    // Module header separator
    if (r.module !== currentModule) {
      currentModule = r.module;
      const sepRow = tcSheet.addRow(['', '', r.module.toUpperCase(), '', '', '', '', '']);
      sepRow.height = 24;
      tcSheet.mergeCells(`C${sepRow.number}:H${sepRow.number}`);
      sepRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.moduleBg}` } };
        cell.font = { name: 'Plus Jakarta Sans', bold: true, size: 10, color: { argb: `FF${COLORS.moduleText}` } };
      });
    }

    const isPass  = r.status === 'PASSED';
    const fillCol = isPass ? COLORS.passedBg : COLORS.failedBg;
    const statFg  = isPass ? COLORS.passedText : COLORS.failedText;
    const rowBg   = rowIndex % 2 === 0 ? COLORS.rowAlt : COLORS.rowNorm;

    const dataRow = tcSheet.addRow([rowIndex, r.id, r.module, r.name, r.desc, r.status, r.duration, r.error || '']);
    dataRow.height = 22;

    dataRow.eachCell((cell, colNum) => {
      cell.font   = { name: 'Plus Jakarta Sans', size: 10 };
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${rowBg}` } };
      cell.border = {
        top:    { style: 'thin', color: { argb: `FF${COLORS.border}` } },
        bottom: { style: 'thin', color: { argb: `FF${COLORS.border}` } },
        left:   { style: 'thin', color: { argb: `FF${COLORS.border}` } },
        right:  { style: 'thin', color: { argb: `FF${COLORS.border}` } },
      };
      if (colNum === 1 || colNum === 2) cell.alignment = { horizontal: 'center' };
      if (colNum === 7) cell.alignment = { horizontal: 'right' };
      if (colNum === 6) {
        cell.font = { name: 'Plus Jakarta Sans', bold: true, size: 10, color: { argb: `FF${statFg}` } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${fillCol}` } };
        cell.alignment = { horizontal: 'center' };
      }
      if (colNum === 8 && r.error) {
        cell.font = { name: 'Plus Jakarta Sans', size: 9, color: { argb: `FF${COLORS.failedText}` } };
        cell.alignment = { wrapText: true };
      }
    });
  }

  tcSheet.columns = [
    { width: 5  },  // #
    { width: 10 },  // ID
    { width: 16 },  // Module
    { width: 40 },  // Name
    { width: 50 },  // Description
    { width: 14 },  // Status
    { width: 14 },  // Duration
    { width: 55 },  // Error
  ];

  // ── Failed Tests Sheet ──────────────────────────────────────────────────────
  const failedResults = results.filter(r => r.status === 'FAILED');
  if (failedResults.length > 0) {
    const failSheet = wb.addWorksheet('❌ Failed Tests', { views: [{ showGridLines: true }] });

    failSheet.mergeCells('A1:G1');
    const fTitle = failSheet.getCell('A1');
    fTitle.value = `❌  FAILED TEST CASES — ${failedResults.length} Failures`;
    fTitle.font  = { name: 'Outfit', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    fTitle.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.statFail}` } };
    fTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    failSheet.getRow(1).height = 40;

    failSheet.addRow(['#', 'Test ID', 'Module', 'Test Case Name', 'Status', 'Duration (ms)', 'Error Message']);
    const fHeader = failSheet.lastRow;
    fHeader.height = 26;
    fHeader.eachCell(cell => {
      cell.font  = { name: 'Plus Jakarta Sans', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.accent}` } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    failedResults.forEach((r, i) => {
      const row = failSheet.addRow([i + 1, r.id, r.module, r.name, r.status, r.duration, r.error]);
      row.height = 30;
      row.eachCell((cell, col) => {
        cell.font   = { name: 'Plus Jakarta Sans', size: 10 };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${COLORS.failedBg}` } };
        if (col === 5) { cell.font = { name: 'Plus Jakarta Sans', bold: true, size: 10, color: { argb: `FF${COLORS.failedText}` } }; cell.alignment = { horizontal: 'center' }; }
        if (col === 7) { cell.alignment = { wrapText: true }; cell.font = { name: 'Plus Jakarta Sans', size: 9, color: { argb: `FF${COLORS.failedText}` } }; }
      });
    });

    failSheet.columns = [
      { width: 5 }, { width: 10 }, { width: 16 }, { width: 42 },
      { width: 12 }, { width: 14 }, { width: 60 }
    ];
  }

  await wb.xlsx.writeFile(REPORT_FILE);
  console.log(`\n📄 Excel report saved → ${REPORT_FILE}`);
  return REPORT_FILE;
}

// ─── MARKDOWN SUMMARY ────────────────────────────────────────────────────────
function generateMarkdownSummary() {
  const passed   = results.filter(r => r.status === 'PASSED').length;
  const failed   = results.filter(r => r.status === 'FAILED').length;
  const total    = results.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const duration = ((Date.now() - suiteStart) / 1000).toFixed(1);
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const passBadge = passRate === 100 ? '🟢' : passRate >= 80 ? '🟡' : '🔴';

  let md = `# 🛡️ TruthGuard Android — Appium E2E Test Report\n\n`;
  md += `> **Generated:** ${timestamp} &nbsp;|&nbsp; **Device:** Android Emulator (Pixel_6) &nbsp;|&nbsp; **Engine:** Appium 2.x + WebDriverIO v8\n\n`;
  md += `---\n\n`;

  md += `## 📊 Results Summary\n\n`;
  md += `| ${passBadge} Pass Rate | 📋 Total Tests | ✅ Passed | ❌ Failed | ⏱️ Duration |\n`;
  md += `|:-----------:|:--------------:|:---------:|:---------:|:----------:|\n`;
  md += `| **${passRate}%** | **${total}** | **${passed}** | **${failed}** | **${duration}s** |\n\n`;

  const modules = [...new Set(results.map(r => r.module))];
  md += `## 📋 Module Breakdown\n\n`;
  md += `| Module | Tests | ✅ Passed | ❌ Failed | Pass Rate |\n`;
  md += `|--------|:-----:|:---------:|:---------:|:---------:|\n`;
  for (const mod of modules) {
    const modRes   = results.filter(r => r.module === mod);
    const mPass    = modRes.filter(r => r.status === 'PASSED').length;
    const mFail    = modRes.filter(r => r.status === 'FAILED').length;
    const mRate    = Math.round((mPass / modRes.length) * 100);
    const mIcon    = mFail === 0 ? '✅' : '❌';
    md += `| ${mIcon} ${mod} | ${modRes.length} | ${mPass} | ${mFail} | ${mRate}% |\n`;
  }
  md += `\n`;

  const failedList = results.filter(r => r.status === 'FAILED');
  if (failedList.length > 0) {
    md += `## ❌ Failed Test Cases\n\n`;
    md += `| Test ID | Module | Test Name | Error |\n`;
    md += `|---------|--------|-----------|-------|\n`;
    for (const r of failedList) {
      const errSnippet = (r.error || '').replace(/\|/g, '\\|').substring(0, 120);
      md += `| \`${r.id}\` | ${r.module} | ${r.name} | \`${errSnippet}\` |\n`;
    }
    md += `\n`;
  } else {
    md += `## 🎉 All Tests Passed!\n\n`;
    md += `> All **${total}** test cases passed successfully with a **${passRate}%** pass rate.\n\n`;
  }

  md += `---\n`;
  md += `*Report also available as a downloadable Excel artifact.*\n`;

  const summaryFile = path.join(__dirname, 'test-summary.md');
  fs.writeFileSync(summaryFile, md, 'utf8');
  console.log(`\n📝 Markdown summary saved → ${summaryFile}`);
  return summaryFile;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   🛡️  TRUTHGUARD ANDROID — APPIUM E2E TEST RUNNER');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // 1. Verify/Wait for Emulator Boot completion
    await verifyEmulatorBooted();

    // 2. Start Appium Server
    await startAppiumServer();

    // 3. Run Tests
    await runTests();
  } catch (err) {
    console.error('\n🔴 Critical runner error:', err.message);
  } finally {
    if (driver) {
      console.log('\n🧹 Closing Appium WebDriver client session...');
      try {
        await driver.deleteSession();
      } catch (e) {}
    }
    if (appiumProcess) {
      console.log('🧹 Stopping Appium server...');
      try {
        appiumProcess.kill();
      } catch (e) {}
    }

    const passed  = results.filter(r => r.status === 'PASSED').length;
    const failed  = results.filter(r => r.status === 'FAILED').length;
    const total   = results.length;
    const duration = ((Date.now() - suiteStart) / 1000).toFixed(1);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  📊 RESULTS  |  Total: ${total}  ✅ Passed: ${passed}  ❌ Failed: ${failed}`);
    console.log(`  ⏱️  Duration: ${duration}s  |  Pass Rate: ${Math.round((passed/total)*100)}%`);
    console.log('═══════════════════════════════════════════════════════════');

    if (results.length > 0) {
      await generateReport();
      generateMarkdownSummary();
      console.log('\n✨ Testing complete! Open the Excel report for full details.\n');
    } else {
      console.log('\n⚠️ No tests were executed due to early setup failures.\n');
    }
  }
}

main();
