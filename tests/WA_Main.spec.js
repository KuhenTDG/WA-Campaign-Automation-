const { test, expect, chromium } = require('@playwright/test');
const { sendMessage, sendMessageToBox, uploadReceipt, chatWithAgent, getMostRecentBotMessage, CONFIG } = require('./helpers/WA_helpers');

// Import campaign configuration
const CAMPAIGN_CONFIG = require('./config/campaign-config');

// import the separate test files
const { testSearchContact } = require('./test-cases/search-contact.spec.js');
//const { testTriggerMessage } = require('./test-cases/trigger-msg.spec.js');
//const { testNameValidation } = require('./test-cases/name-validation.spec.js');
const { testReceiptValidation } = require('./test-cases/upload-receipt.spec.js');


// let receiptValidationResults = {
//     passed: true,
//     failures: [],
//     blurryReceiptAccepted: false,
//     validReceiptRejected: false,
//     secondBlurryReceiptAccepted: false,
//     criticalFailure: false
// };

test.describe('WhatsApp Automation Tests', () => {
    let browser, context, page;

    // Setup: Login once for all tests
    test.beforeAll(async () => {
        test.setTimeout(1800000); // 5 minutes for setup

        // Launch browser
        browser = await chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        context = await browser.newContext({
            recordVideo: {
                dir: './test-results/videos',
                size: { width: 1280, height: 720 }
            },
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        // Login to WhatsApp Web (scan QR once)
        console.log("=========== TEST 1 Opening WhatsApp Web... =============");
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);

        // Handle QR code scanning once for all tests
        try {
            const qrCode = await page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 5000 });
            if (qrCode) {
                console.log("📱 QR Code found! Please scan it to continue...");
                await page.screenshot({ path: 'screenshots/qr-code.png', fullPage: true });
            }
        } catch {
            console.log("ℹ️ No QR code found - checking login status.");
        }

        // Wait for login completion
        await page.waitForSelector('div[contenteditable="true"][data-tab="3"]', { timeout: 120000 });
        console.log("✅ Logged in successfully! Ready for tests.");
        await page.screenshot({ path: 'screenshots/login-success.png', fullPage: true });
    });


    // Call your test function here:
    test('Search contact test', async () => {
        await testSearchContact(page, CAMPAIGN_CONFIG);
    });

   /* test('Trigger Message Test', async () => {
        await testTriggerMessage(page, CAMPAIGN_CONFIG);
    });

    test('Name Validation Test', async () => {
        await testNameValidation(page, CAMPAIGN_CONFIG);
    });*/

    test('Upload Receipt Test', async () => {
        test.setTimeout(600000);
        await testReceiptValidation(page, CAMPAIGN_CONFIG);
    });

});