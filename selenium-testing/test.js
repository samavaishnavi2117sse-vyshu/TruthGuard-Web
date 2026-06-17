const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const ExcelJS = require('exceljs');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3000;
const WEB_APP_URL = `http://localhost:${PORT}`;
const REPORT_FILE = path.join(__dirname, 'Selenium_Test_Report.xlsx');

let webServerProcess = null;
let driver = null;
const testResults = [];

// Helper to start the Express server
function startServer() {
  return new Promise((resolve, reject) => {
    console.log("Starting Web Application server...");
    const serverPath = path.join(__dirname, '../web-app/server.js');
    
    // Pass execution path reload just in case
    const env = { ...process.env };
    
    webServerProcess = spawn('node', [serverPath], { env });

    webServerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server]: ${output.trim()}`);
      if (output.includes(`running on http://localhost:${PORT}`)) {
        resolve();
      }
    });

    webServerProcess.stderr.on('data', (data) => {
      console.error(`[Server Error]: ${data.toString()}`);
    });

    webServerProcess.on('error', (err) => {
      reject(err);
    });

    // Timeout if server doesn't start in 10s
    setTimeout(() => {
      resolve(); // Proceed anyway
    }, 8000);
  });
}

// Log test case helper
function logTestResult(id, name, description, status, duration, error = '') {
  testResults.push({ id, name, description, status, duration, error });
  console.log(`[${status}] ${id}: ${name} (${duration}ms)${error ? ' - ' + error : ''}`);
}

async function runTests() {
  const options = new chrome.Options();
  // Run headless to work in virtual environment
  options.addArguments('--headless=new');
  options.addArguments('--disable-gpu');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');

  console.log("Initializing Chrome WebDriver...");
  driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  console.log(`Navigating to TruthGuard Web App at: ${WEB_APP_URL}`);
  
  // TC-001: Navigation & Load Page
  let startTime = Date.now();
  try {
    await driver.get(WEB_APP_URL);
    await driver.wait(until.titleContains('TruthGuard'), 5000);
    logTestResult('TC-001', 'Load Web Application', 'Load main landing page and verify the HTML title.', 'PASSED', Date.now() - startTime);
  } catch (err) {
    logTestResult('TC-001', 'Load Web Application', 'Load main landing page and verify the HTML title.', 'FAILED', Date.now() - startTime, err.message);
    throw err; // Stop testing if we can't even load the site
  }

  // TC-002: Verify Home Screen UI elements
  startTime = Date.now();
  try {
    const titleEl = await driver.findElement(By.className('hero-title'));
    const text = await titleEl.getText();
    if (text === 'TRUTHGUARD') {
      logTestResult('TC-002', 'Verify Home UI Elements', 'Verify existence of title banner on home screen.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error(`Title mismatch: expected 'TRUTHGUARD' but got '${text}'`);
    }
  } catch (err) {
    logTestResult('TC-002', 'Verify Home UI Elements', 'Verify existence of title banner on home screen.', 'FAILED', Date.now() - startTime, err.message);
  }

  // TC-003: Verify Navigation to Verify Screen
  startTime = Date.now();
  try {
    const navVerify = await driver.findElement(By.id('nav-verify'));
    await navVerify.click();
    await driver.sleep(500); // Wait for transition animation
    const verifyScreen = await driver.findElement(By.id('screen-verify'));
    const isDisplayed = await verifyScreen.isDisplayed();
    if (isDisplayed) {
      logTestResult('TC-003', 'Navigate to Verify Screen', 'Click side navigation link to Verify News and check visibility.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error('Verify screen not displayed after navigation click.');
    }
  } catch (err) {
    logTestResult('TC-003', 'Navigate to Verify Screen', 'Click side navigation link to Verify News and check visibility.', 'FAILED', Date.now() - startTime, err.message);
  }

  // TC-004: Test Fake News Detection Logic
  startTime = Date.now();
  try {
    const textInput = await driver.findElement(By.id('news-input'));
    await textInput.clear();
    await textInput.sendKeys('BREAKING: This is a fake news claim! Completely shocking rumor and hoax!');
    
    const analyzeBtn = await driver.findElement(By.id('analyze-btn'));
    await analyzeBtn.click();
    
    // Wait for results
    await driver.wait(until.elementLocated(By.id('result-title')), 3000);
    const resultTitle = await driver.findElement(By.id('result-title'));
    await driver.wait(until.elementIsVisible(resultTitle), 2000);
    
    const textResult = await resultTitle.getText();
    const resultConfidence = await driver.findElement(By.id('result-confidence')).getText();
    
    if (textResult.includes('Likely Fake News') && resultConfidence.includes('88%')) {
      logTestResult('TC-004', 'Verify Fake News Detection', 'Analyze input text with keywords and check "Likely Fake News" result.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error(`Unexpected result message: '${textResult}' with confidence '${resultConfidence}'`);
    }
  } catch (err) {
    logTestResult('TC-004', 'Verify Fake News Detection', 'Analyze input text with keywords and check "Likely Fake News" result.', 'FAILED', Date.now() - startTime, err.message);
  }

  // TC-005: Test Genuine News Detection Logic
  startTime = Date.now();
  try {
    const textInput = await driver.findElement(By.id('news-input'));
    await textInput.clear();
    await textInput.sendKeys('NASA scientists have launched a brand new weather and climate satellite to monitor global warming.');
    
    const analyzeBtn = await driver.findElement(By.id('analyze-btn'));
    await analyzeBtn.click();
    
    await driver.sleep(500); // Wait for recalculation
    const resultTitle = await driver.findElement(By.id('result-title'));
    const textResult = await resultTitle.getText();
    const resultConfidence = await driver.findElement(By.id('result-confidence')).getText();
    
    if (textResult.includes('Likely Genuine News') && resultConfidence.includes('94%')) {
      logTestResult('TC-005', 'Verify Genuine News Detection', 'Analyze genuine article text and check "Likely Genuine News" result.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error(`Unexpected result message: '${textResult}' with confidence '${resultConfidence}'`);
    }
  } catch (err) {
    logTestResult('TC-005', 'Verify Genuine News Detection', 'Analyze genuine article text and check "Likely Genuine News" result.', 'FAILED', Date.now() - startTime, err.message);
  }

  // TC-006: Verify Trending News Display
  startTime = Date.now();
  try {
    const navTrending = await driver.findElement(By.id('nav-trending'));
    await navTrending.click();
    await driver.sleep(500);
    
    const newsCards = await driver.findElements(By.className('news-card'));
    if (newsCards.length > 0) {
      logTestResult('TC-006', 'Verify Trending News Screen', 'Navigate to Trending and check list items loading.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error('No trending news items were loaded in the DOM.');
    }
  } catch (err) {
    logTestResult('TC-006', 'Verify Trending News Screen', 'Navigate to Trending and check list items loading.', 'FAILED', Date.now() - startTime, err.message);
  }

  // TC-007: Verify Dashboard Screen Stats Update
  startTime = Date.now();
  try {
    const navDashboard = await driver.findElement(By.id('nav-dashboard'));
    await navDashboard.click();
    await driver.sleep(500);
    
    const totalEl = await driver.findElement(By.id('dashboard-total'));
    const totalVal = await totalEl.getText();
    
    // We run 2 verifications during the test. So default 25 + 2 = 27 verified.
    if (parseInt(totalVal) >= 27) {
      logTestResult('TC-007', 'Verify Dashboard Statistics', 'Verify Dashboard increments correctly after E2E runs.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error(`Total verified articles count mismatch: expected >=27, got '${totalVal}'`);
    }
  } catch (err) {
    logTestResult('TC-007', 'Verify Dashboard Statistics', 'Verify Dashboard increments correctly after E2E runs.', 'FAILED', Date.now() - startTime, err.message);
  }

  // TC-008: Verify About Screen Info
  startTime = Date.now();
  try {
    const navAbout = await driver.findElement(By.id('nav-about'));
    await navAbout.click();
    await driver.sleep(500);
    
    const aboutTitle = await driver.findElement(By.className('about-title'));
    const text = await aboutTitle.getText();
    if (text === 'TruthGuard') {
      logTestResult('TC-008', 'Verify About Screen Information', 'Navigate to About and check app metadata layout.', 'PASSED', Date.now() - startTime);
    } else {
      throw new Error(`About title mismatch: got '${text}'`);
    }
  } catch (err) {
    logTestResult('TC-008', 'Verify About Screen Information', 'Navigate to About and check app metadata layout.', 'FAILED', Date.now() - startTime, err.message);
  }
}

// Generate stylized Excel Report using exceljs
async function generateExcelReport() {
  console.log("Generating styled Excel report...");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('E2E Web Test Summary');

  // Sheet View configuration (grid lines visible)
  sheet.views = [{ showGridLines: true }];

  // Title styling
  sheet.mergeCells('A1:F1');
  const titleRow = sheet.getRow(1);
  titleRow.height = 40;
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'TruthGuard - Selenium Web E2E Test Report';
  titleCell.font = { name: 'Outfit', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Metadata Row
  sheet.addRow([]);
  sheet.addRow(['Platform', 'Web Application (Google Chrome)', 'Date', new Date().toLocaleDateString(), 'Engine', 'Node.js Selenium-Webdriver']);
  sheet.addRow(['Host URL', WEB_APP_URL, 'Time', new Date().toLocaleTimeString(), 'Status', 'Completed']);
  
  // Format metadata bold labels
  ['A3', 'A4', 'C3', 'C4', 'E3', 'E4'].forEach(cellRef => {
    sheet.getCell(cellRef).font = { bold: true, size: 10, name: 'Plus Jakarta Sans' };
  });

  sheet.addRow([]);

  // Stats Summary
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.status === 'PASSED').length;
  const failedTests = totalTests - passedTests;
  const passRate = totalTests > 0 ? Math.round((passPassed = passedTests / totalTests) * 100) : 0;

  sheet.addRow(['Total Tests', totalTests, 'Passed', passedTests, 'Failed', failedTests]);
  sheet.addRow(['Pass Rate', `${passRate}%`]);
  
  // Style Stats Summary table
  const statRow1 = sheet.getRow(6);
  const statRow2 = sheet.getRow(7);
  statRow1.font = { bold: true, name: 'Plus Jakarta Sans' };
  statRow2.font = { bold: true, name: 'Plus Jakarta Sans' };
  
  sheet.getCell('A6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };
  sheet.getCell('C6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }; // Light green
  sheet.getCell('E6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } }; // Light red
  sheet.getCell('A7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };

  sheet.addRow([]);

  // Table Headers
  const headerRowNumber = 9;
  sheet.getRow(headerRowNumber).values = ['Test ID', 'Test Case Name', 'Description', 'Status', 'Duration (ms)', 'Error / Assertion Logs'];
  const headerRow = sheet.getRow(headerRowNumber);
  headerRow.height = 28;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Plus Jakarta Sans', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 || colNumber === 4 ? 'center' : 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBDC3C7' } },
      bottom: { style: 'medium', color: { argb: 'FF2C3E50' } },
      left: { style: 'thin', color: { argb: 'FFBDC3C7' } },
      right: { style: 'thin', color: { argb: 'FFBDC3C7' } }
    };
  });

  // Populate Test Case rows
  testResults.forEach((test, index) => {
    const rowNum = headerRowNumber + 1 + index;
    sheet.addRow([test.id, test.name, test.description, test.status, test.duration, test.error]);
    const row = sheet.getRow(rowNum);
    row.height = 24;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Plus Jakarta Sans', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };

      // Align columns
      if (colNumber === 1) cell.alignment = { horizontal: 'center' };
      if (colNumber === 4) cell.alignment = { horizontal: 'center' };
      if (colNumber === 5) cell.alignment = { horizontal: 'right' };

      // Highlight PASSED / FAILED cells
      if (colNumber === 4) {
        if (cell.value === 'PASSED') {
          cell.font = { name: 'Plus Jakarta Sans', bold: true, color: { argb: 'FF155724' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
        } else {
          cell.font = { name: 'Plus Jakarta Sans', bold: true, color: { argb: 'FF721C24' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
        }
      }
    });
  });

  // Column Width adjustments
  sheet.columns = [
    { width: 12 }, // ID
    { width: 28 }, // Name
    { width: 45 }, // Description
    { width: 15 }, // Status
    { width: 15 }, // Duration
    { width: 50 }  // Error
  ];

  await workbook.xlsx.writeFile(REPORT_FILE);
  console.log(`Excel report successfully saved to: ${REPORT_FILE}`);
}

async function main() {
  try {
    // 1. Start Web Server
    await startServer();

    // 2. Execute Selenium Script
    await runTests();
  } catch (err) {
    console.error("Critical test execution failure: ", err);
  } finally {
    // 3. Clean up webdriver
    if (driver) {
      console.log("Shutting down Chrome WebDriver...");
      await driver.quit();
    }

    // 4. Generate Reports
    await generateExcelReport();

    // 5. Shutdown Web Server
    if (webServerProcess) {
      console.log("Stopping Web Application server...");
      webServerProcess.kill();
    }

    console.log("Selenium testing lifecycle completed.");
  }
}

main();
