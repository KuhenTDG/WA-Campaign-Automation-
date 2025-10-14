
const { test, expect, chromium } = require('@playwright/test');
const { sendMessage, sendMessageToBox, uploadReceipt, chatWithAgent, CONFIG } = require('./helpers/WA_helpers');

// Import campaign configuration
const CAMPAIGN_CONFIG = require('./config/campaign-config');    //+60 11-2635 2586 (to test blurry receipt) || Whatsapp Automation


test.describe('WhatsApp Automation Tests', () => {
    let browser, context, page;

    // Setup: Login once for all tests
    test.beforeAll(async () => {
        test.setTimeout(300000); // 5 minutes for setup

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


    //=================================== Test 1 Search and Open Contact =========================================

    // Test 1: Search and open contact
    test('Search and open contact by name or phone number', async () => {
        test.setTimeout(180000); // 3 minutes

        try {
            await test.step('Search for contact by name or phone number', async () => {
                console.log(`🔍 Searching for contact: ${CAMPAIGN_CONFIG.contactName}`);

                // Look for search box
                const searchSelectors = [
                    '[data-testid="chat-list-search"]',
                    'div[contenteditable="true"][data-tab="3"]',
                    'div[contenteditable="true"]'
                ];

                let searchBox = null;
                for (const selector of searchSelectors) {
                    try {
                        searchBox = await page.waitForSelector(selector, { timeout: 10000 });
                        if (searchBox) {
                            console.log(`📍 Found search box with selector: ${selector}`);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!searchBox) {
                    throw new Error('Could not find search box');
                }

                // Search by contact name
                await searchBox.click();
                await searchBox.fill(''); // Clear existing text
                await searchBox.type(CAMPAIGN_CONFIG.contactName, { delay: 100 });
                await page.waitForSelector('[data-testid="cell-frame-container"], div[role="listitem"]', { timeout: 400 }).catch(() => { });

                // Look for contact result by name
                const contactByNameSelectors = [
                    `span[title="${CAMPAIGN_CONFIG.contactName}"]`,
                    `span[title*="${CAMPAIGN_CONFIG.contactName}"]`,
                    '[data-testid="cell-frame-container"]',
                    'div[role="listitem"]'
                ];

                let contactFound = false;
                for (const selector of contactByNameSelectors) {
                    try {
                        const contactElement = await page.waitForSelector(selector, { timeout: 800 });
                        if (contactElement) {
                            console.log(`📱 Found contact by name with selector: ${selector}`);
                            await contactElement.click();
                            await page.waitForTimeout(800);
                            await page.screenshot({ path: 'screenshots/contact-opened-by-name.png', fullPage: true });
                            console.log(`✅ Contact "${CAMPAIGN_CONFIG.contactName}" opened successfully`);
                            contactFound = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!contactFound) {
                    console.log("⚠️ Could not find contact by name");
                    await page.screenshot({ path: 'screenshots/contact-not-found.png', fullPage: true });
                    throw new Error(`Contact not found: ${CAMPAIGN_CONFIG.contactName}`);
                }
            });

            await test.step('Verify contact chat is opened', async () => {
                console.log("✅ Verifying contact chat is opened...");

                // Verify we're in a chat by looking for message input or chat header
                const chatVerificationSelectors = [
                    'div[contenteditable="true"][data-tab="10"]', // Message input
                    'div[data-testid="conversation-compose-box-input"]',
                    'header[data-testid="conversation-header"]'
                ];

                let chatOpened = false;
                for (const selector of chatVerificationSelectors) {
                    try {
                        const chatElement = await page.waitForSelector(selector, { timeout: 8000 });
                        if (chatElement) {
                            console.log(`✅ Chat verified with selector: ${selector}`);
                            await page.screenshot({ path: 'screenshots/chat-verification.png', fullPage: true });
                            chatOpened = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!chatOpened) {
                    throw new Error('Could not verify that chat is opened');
                }

                console.log("🎉 Contact chat opened successfully!");
            });

            console.log("🎉 Contact search and open completed successfully!");

        } catch (error) {
            console.error(`❌ Error in contact search: ${error.message}`);
            await page.screenshot({
                path: `test-results/contact-search-error-${Date.now()}.png`,
                fullPage: true
            });
            throw error;
        }
    });

    //=================================== Test 2 Send trigger message ===========================================================================



    // Test 2: Send trigger message, detect campaign name, and handle proceed button  
    test('Send trigger message and handle proceed button', async () => {
        test.setTimeout(180000); // 3 minutes

        try {
            // Send trigger message
            await test.step('Send trigger message', async () => {
                console.log("============ TEST 2 - Send trigger message =============");
                console.log(`📤 Using trigger message: "${CAMPAIGN_CONFIG.triggerMessage}"`);
                await sendMessage(page, CAMPAIGN_CONFIG.triggerMessage, "Trigger message");
                await page.waitForTimeout(CAMPAIGN_CONFIG.timeouts.messageWait);
                await page.screenshot({ path: 'screenshots/after-trigger-message.png', fullPage: true });
            });

            // Look for exact campaign name
            await test.step('Detect exact campaign name', async () => {
                console.log(`🔍 Looking for campaign: "${CAMPAIGN_CONFIG.exactCampaignName}"`);

                const maxWaitTime = 60000; // 60 seconds max waiting time
                const interval = 3000; // check every 3 seconds
                const start = Date.now();
                let found = false;

                while (Date.now() - start < maxWaitTime) {
                    const campaignElement = await page.locator('span.selectable-text.copyable-text', {
                        hasText: CAMPAIGN_CONFIG.exactCampaignName
                    }).first();

                    if (await campaignElement.isVisible().catch(() => false)) {
                        console.log(`✅ EXACT campaign name '${CAMPAIGN_CONFIG.exactCampaignName}' detected!`);
                        await page.screenshot({ path: 'screenshots/campaign-detected.png', fullPage: true });
                        found = true;
                        break;
                    } else {
                        const waited = ((Date.now() - start) / 1000).toFixed(0);
                        console.log(`⏳ Waiting... ${waited}s elapsed (still not detected)`);
                        await page.waitForTimeout(interval);
                    }
                }

                if (!found) {
                    console.log(`❌ EXACT campaign name '${CAMPAIGN_CONFIG.exactCampaignName}' not found after ${maxWaitTime / 1000}s`);
                    await page.screenshot({ path: 'screenshots/campaign-not-found-debug.png', fullPage: true });
                    throw new Error(`Test failed: EXACT campaign name '${CAMPAIGN_CONFIG.exactCampaignName}' not detected`);
                }
            });   

            // Click Proceed button (only if campaign name was found)
            await test.step('Click most recent Proceed button', async () => {
                console.log("🔘 Looking for the most recent Proceed button...");

                try {
                    // Wait for any Proceed button to appear first (give enough time)
                    await page.waitForSelector('div._ahef[role="button"]:has-text("Proceed")', {
                        timeout: 30000, // wait up to 30 seconds
                        state: 'attached'
                    });

                    // Once at least one exists, get all of them
                    const proceedButtons = await page.$$('div._ahef[role="button"]:has-text("Proceed")');

                    if (proceedButtons.length === 0) {
                        console.log("❌ No Proceed button found even after waiting.");
                        await page.screenshot({ path: 'screenshots/proceed-button-debug.png', fullPage: true });
                        throw new Error("Proceed button not found after waiting");
                    }

                    // Pick the last (most recent) Proceed button
                    const latestProceedButton = proceedButtons[proceedButtons.length - 1];

                    await latestProceedButton.scrollIntoViewIfNeeded();
                    await latestProceedButton.waitForElementState('visible');
                    await latestProceedButton.click({ delay: 100 });
                    console.log("✅ Clicked the most recent Proceed button!");
                    await page.waitForTimeout(CAMPAIGN_CONFIG.timeouts.buttonClick);
                    await page.screenshot({ path: 'screenshots/proceed-button-clicked.png', fullPage: true });

                } catch (error) {
                    console.log("❌ Failed to click the most recent Proceed button");
                    await page.screenshot({ path: 'screenshots/proceed-button-debug.png', fullPage: true });
                    throw error;
                }
            });

            // Verify name request message appears
            await test.step('Verify name request message', async () => {
                console.log("🔍 Looking for name request message...");

                try {
                    // Wait for the response after clicking proceed
                    await page.waitForTimeout(5000);

                    // Get page content to check for name-related prompts
                    const pageContent = await page.textContent('body');

                    // Define possible name request variations (case-insensitive)
                    const nameRequestPatterns = [
                        "please reply with your name",
                        "reply with your name",
                        "please enter your name",
                        "enter your name",
                        "send your name",
                        "send full name",
                        "provide your name",
                        "tell us your name",
                        "share your name"
                    ];

                    let nameRequestFound = false;
                    let foundPattern = "";

                    // Check if any of the patterns exist in the page content (case-insensitive)
                    if (pageContent) {
                        const lowerPageContent = pageContent.toLowerCase();

                        for (const pattern of nameRequestPatterns) {
                            if (lowerPageContent.includes(pattern.toLowerCase())) {
                                nameRequestFound = true;
                                foundPattern = pattern;
                                break;
                            }
                        }
                    }

                    if (nameRequestFound) {
                        console.log(`✅ Name request message detected! Found pattern: "${foundPattern}"`);
                        await page.screenshot({ path: 'screenshots/name-request-detected.png', fullPage: true });
                    } else {
                        throw new Error("Name request message not found");
                    }

                } catch (error) {
                    console.log("❌ Name request message not found");
                    await page.screenshot({ path: 'screenshots/name-request-debug.png', fullPage: true });

                    // Log actual content for debugging
                    const actualContent = await page.textContent('body').catch(() => 'Could not get page content');
                    console.log("📝 Actual page content preview:", actualContent?.substring(0, 500) + "...");

                    // Close browser and fail the test
                    console.log("🚫 Closing browser due to name request message not found");
                    await page.close();
                    throw new Error("Test failed: Name request message not detected after clicking Proceed");
                }
            });

            console.log("🎉 Trigger message workflow completed successfully!");

        } catch (error) {
            console.error(`❌ Error in trigger message workflow: ${error.message}`);
            await page.screenshot({
                path: `test-results/trigger-error-${Date.now()}.png`,
                fullPage: true
            });

            throw error;
        }
    });


    //=================================== Test 3 Name Validation ===========================================================================

// Test 3: Name validation with error sequence
test('Send user name with error sequence and validation', async () => {
    test.setTimeout(180000); // 3 minutes

    const userName = "Kuhen test";
    let validationResults = {
        passed: true,
        failures: [],
        invalidNamesAccepted: []
    };

    // FIRST: Verify name request message is present before starting validation
    await test.step('Verify name request message before validation', async () => {
        console.log("========== TEST 3 Starting - Checking for name request message ===========");

        try {
            await page.waitForTimeout(5000);
            const pageContent = await page.textContent('body');

            // Define possible name request variations
            const nameRequestPatterns = [
                "please reply with your name",
                "reply with your name",
                "please enter your name",
                "enter your name",
                "send your name",
                "send full name",
                "provide your name"
            ];

            let nameRequestFound = false;
            let foundPattern = "";

            if (pageContent) {
                const lowerPageContent = pageContent.toLowerCase();
                for (const pattern of nameRequestPatterns) {
                    if (lowerPageContent.includes(pattern.toLowerCase())) {
                        nameRequestFound = true;
                        foundPattern = pattern;
                        break;
                    }
                }
            }

            if (nameRequestFound) {
                console.log(`✅ Name request message detected! Found pattern: "${foundPattern}"`);
                console.log("🚀 Proceeding with name validation test...");
                await page.screenshot({ path: 'screenshots/name-request-verified-test3.png', fullPage: true });
            } else {
                throw new Error("Name request message not found - cannot start validation");
            }

        } catch (error) {
            console.log("❌ Name request message not found at start of Test 3");
            await page.screenshot({ path: 'screenshots/test3-name-request-missing.png', fullPage: true });
            console.log("🚫 Closing browser - name request message not found at start of Test 3");
            await page.close();
            throw new Error("Test 3 failed: Name request message not detected - cannot proceed with validation");
        }
    });

    await test.step('Send user name with error sequence and validation', async () => {
        console.log("========== TEST 3 Starting name validation test ===========");
        await page.waitForTimeout(9000);

        // Error name test cases
        const invalidNames = ['123', '✅✅✅', 'Kuhen test ✅', 'Kuhen test 123'];

        for (const [index, invalidName] of invalidNames.entries()) {
            console.log(`🚫 Sending invalid name #${index + 1}: "${invalidName}"`);
            await sendMessageToBox(page, invalidName);
            
            // WAIT 5 seconds after sending for system to process
            await page.waitForTimeout(5000);

            console.log(`🔍 Checking system response for "${invalidName}"...`);

            let rejected = false;
            let proceeded = false;
            let attempts = 0;
            const maxAttempts = 10;

            while (!rejected && !proceeded && attempts < maxAttempts) {
                attempts++;
                
                // WAIT 1 second before each check attempt
                await page.waitForTimeout(1000);

                try {
                    const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text, span.selectable-text');
                    
                    // Check if selectableTexts is valid and iterable
                    if (!selectableTexts || !Array.isArray(selectableTexts) || selectableTexts.length === 0) {
                        console.log(`⚠️ Selectable texts not ready yet, waiting...`);
                        await page.waitForTimeout(2000);
                        continue;
                    }

                    for (let element of selectableTexts) {
                        const text = await element.textContent();

                        if (text) {
                            // CRITICAL: Check for ACCEPTANCE patterns FIRST (system moved to receipt upload)
                            if (
                                text.includes("Please submit your receipt as a proof of purchase") ||
                                text.includes("The receipt must contain the following information") ||
                                (text.includes("Store Name") && text.includes("Receipt Date") && text.includes("Product Name")) ||
                                text.includes("receipt must contain the following information") ||
                                text.includes("clear and readable receipt")
                            ) {
                                console.log(`❌ CRITICAL: System ACCEPTED invalid name "${invalidName}" and proceeded to receipt upload!`);
                                console.log(`📝 Receipt upload message detected: ${text.substring(0, 200)}...`);
                                proceeded = true;
                                break;
                            }

                            // Check for REJECTION patterns (only if not proceeded)
                            // TRUE REJECTION = System asks for name again with error message
                            if (
                                text.includes("Please enter your FULL NAME ONLY as per your NRIC") ||
                                text.includes("without any numbers, symbols or images") ||
                                text.includes("Invalid name format") ||
                                text.includes("Name should only contain letters") ||
                                text.includes("Please try again") ||
                                text.includes("Please reply with your Name.​")
                            ) {
                                console.log(`✅ System REJECTED invalid name "${invalidName}" as expected!`);
                                console.log(`📝 Rejection message: ${text.substring(0, 200)}...`);
                                rejected = true;
                                await page.screenshot({
                                    path: `screenshots/name-rejected-${invalidName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                                    fullPage: true
                                });
                                break;
                            }
                        }
                    }

                    if (rejected || proceeded) {
                        break;
                    }

                } catch (error) {
                    console.log(`⚠️ Error during message check: ${error.message}`);
                    // WAIT 2 seconds after error
                    await page.waitForTimeout(2000);
                }

                if (!rejected && !proceeded) {
                    console.log(`Waiting for system response... (${attempts}/${maxAttempts})`);
                    // WAIT 2 seconds before next attempt
                    await page.waitForTimeout(2000);
                }
            }

            // Handle the results
            if (proceeded) {
                const failureMessage = `❌ VALIDATION FAILED: System accepted invalid name "${invalidName}" and proceeded to receipt upload step!`;
                console.log(failureMessage);
                validationResults.passed = false;
                validationResults.failures.push(failureMessage);
                validationResults.invalidNamesAccepted.push(invalidName);

                await page.screenshot({
                    path: `screenshots/FAILED-name-accepted-${invalidName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.png`,
                    fullPage: true
                });

                console.log(`🛑 STOPPING name validation test - system accepted invalid name. Moving to next test...`);
                break;
            } else if (rejected) {
                console.log(`✅ System correctly rejected "${invalidName}"`);
                console.log(`⏳ Waiting 8 seconds for system to complete error message sequence...`);
                // WAIT 8 seconds after rejection
                await page.waitForTimeout(8000);
                console.log(`✅ Wait complete. Ready for next invalid name test.`);
            } else {
                console.log(`⚠️ No clear response detected for "${invalidName}"`);
                // WAIT 8 seconds if unclear
                await page.waitForTimeout(8000);
            }
        }

        // Only send correct name if no invalid names were accepted
        if (validationResults.invalidNamesAccepted.length === 0) {
            console.log(`✅ All invalid names were rejected. Now sending correct name: "${userName}"`);
            await sendMessageToBox(page, userName);
            
            // WAIT 5 seconds after sending valid name
            await page.waitForTimeout(5000);

            console.log("🔍 Verifying acceptance of valid name...");

            let accepted = false;
            let attempts = 0;
            const maxAttempts = 10;

            while (!accepted && attempts < maxAttempts) {
                attempts++;
                
                // WAIT 1 second before each check
                await page.waitForTimeout(1000);

                try {
                    const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text, span.selectable-text');
                    
                    // Check if selectableTexts is valid
                    if (!selectableTexts || !Array.isArray(selectableTexts) || selectableTexts.length === 0) {
                        console.log(`⚠️ Elements not ready yet, waiting...`);
                        await page.waitForTimeout(2000);
                        continue;
                    }

                    for (let element of selectableTexts) {
                        const text = await element.textContent();

                        if (text && (
                            text.includes("Please submit your receipt as a proof of purchase") ||
                            (text.includes("Store Name") && text.includes("Receipt Date") && text.includes("Product Name"))
                        )) {
                            console.log(`🎉 Valid name "${userName}" ACCEPTED! System moved to receipt upload step.`);
                            accepted = true;
                            await page.screenshot({ path: 'screenshots/valid-name-accepted.png', fullPage: true });
                            break;
                        }
                    }

                    if (accepted) {
                        break;
                    }

                } catch (error) {
                    console.log(`⚠️ Error checking acceptance: ${error.message}`);
                    // WAIT 2 seconds after error
                    await page.waitForTimeout(2000);
                }

                if (!accepted) {
                    console.log(`❌ Receipt upload instruction not found yet. Waiting 2 seconds... (${attempts}/${maxAttempts})`);
                    // WAIT 2 seconds before retry
                    await page.waitForTimeout(2000);
                }
            }

            if (!accepted) {
                console.log(`⚠️ No clear success indicator found for valid name "${userName}"`);
                const warningMessage = `Valid name "${userName}" may not have been accepted properly - receipt upload instruction not found`;
                validationResults.failures.push(warningMessage);
                validationResults.passed = false;
            }
        } else {
            console.log(`🚫 Skipping valid name test because system already accepted invalid name(s): ${validationResults.invalidNamesAccepted.join(', ')}`);
        }

        await page.screenshot({ path: 'screenshots/name-validation-complete.png', fullPage: true });
    });

    // Handle test result
    if (!validationResults.passed) {
        console.log("\n========== NAME VALIDATION TEST RESULTS ==========");
        console.log("⚠️ Name validation completed with issues:");
        validationResults.failures.forEach(failure => console.log(`  - ${failure}`));

        if (validationResults.invalidNamesAccepted.length > 0) {
            console.log(`\n📋 Invalid names that were incorrectly accepted: ${validationResults.invalidNamesAccepted.join(', ')}`);
        }

        console.log("\n❌ NAME VALIDATION TEST FAILED");
        console.log("🌐 Browser remains open for subsequent tests");
        console.log("⏭️ Moving to next test...");
        console.log("====================================================\n");

        test.info().attachments.push({
            name: 'validation-failure-details',
            contentType: 'text/plain',
            body: Buffer.from(`Validation Failures:\n${validationResults.failures.join('\n')}\n\nInvalid names accepted: ${validationResults.invalidNamesAccepted.join(', ')}`)
        });

        test.fail();
        throw new Error(`Name validation failed: ${validationResults.failures.join('; ')}`);
    } else {
        console.log("\n========== NAME VALIDATION TEST RESULTS ==========");
        console.log("🎉 Name validation workflow completed successfully!");
        console.log("✅ All invalid names were properly rejected");
        console.log("✅ Valid name was properly accepted");
        console.log("====================================================\n");
    }
});


    //=================================== Test 4 Upload Receipt ===========================================================================

    // Test 4: Receipt upload with invalid input validation and blank/blurry validation
    test('Receipt error validation and upload', async () => {
        test.setTimeout(300000); // 5 minutes

        const receiptPath = "demo-receipt.jpg"; // Valid receipt
        const blankReceiptPath = "blank-receipt.jpg"; // Blank/blurry receipt

        let receiptValidationResults = {
            passed: true,
            failures: [],
            blurryReceiptAccepted: false
        };

        // Helper function to get recent messages
        async function getRecentMessages(page, count = 3) {
            const messages = await page.$$eval(
                '[data-testid="msg-container"]',
                (msgs, count) => msgs.slice(-count).map(msg => msg.textContent),
                count
            );
            return messages;
        }

        try {
            // Step 1: Wait for receipt instruction message
            await test.step('Wait for receipt instruction', async () => {
                console.log("============= TEST 4 - Waiting for receipt instruction message =============");

                let instructionFound = false;
                let attempts = 0;
                const maxAttempts = 10;

                while (!instructionFound && attempts < maxAttempts) {
                    attempts++;
                    console.log(`Attempt ${attempts}: Checking for instruction message...`);

                    try {
                        const selectableTexts = await page.$$('span.selectable-text.copyable-text');
                        const instructionPatterns = [
                            'Please submit your receipt',
                            //'Next step',
                            'Please upload',
                            'Proceed'
                        ];

                        for (let element of selectableTexts) {
                            const text = await element.textContent();
                            if (text && instructionPatterns.some(pattern => text.includes(pattern))) {
                                console.log("✅ Found instruction using selectable-text span!");
                                instructionFound = true;
                                break;
                            }
                        }

                        if (instructionFound) {
                            console.log("✅ Receipt instruction message detected!");
                            await page.waitForTimeout(5000);
                            break;
                        }

                        console.log(`❌ Instruction not found yet. Waiting 3 seconds... (${attempts}/${maxAttempts})`);
                        await page.waitForTimeout(3000);

                    } catch (error) {
                        console.log(`⚠️ Error checking for instruction: ${error.message}`);
                        await page.waitForTimeout(3000);
                    }
                }

                if (!instructionFound) {
                    console.log("⚠️ Receipt instruction not found, proceeding with tests...");
                }
            });

            // Step 2: Invalid input validation tests
            await test.step('Invalid input validation tests', async () => {
                console.log("============= Starting invalid input validation tests =============");

                // Error Test 1: Send numbers (should be rejected)
                console.log("⚠️ Error Test 1: Sending numbers...");
                await sendMessageToBox(page, "123456");
                await page.waitForTimeout(10000);

                const messages1 = await page.$$eval('[data-testid="msg-container"]', msgs =>
                    msgs.slice(-2).map(msg => msg.textContent.toLowerCase())
                );

                for (const message of messages1) {
                    if (message.includes('thank') || message.includes('received') ||
                        message.includes('processing') || message.includes('next') ||
                        message.includes('continue')) {
                        throw new Error("Program closed: System accepted numbers when it should reject them.");
                    }
                }

                // Error Test 2: Send text (should be rejected)  
                console.log("⚠️ Error Test 2: Sending text...");
                await sendMessageToBox(page, "Hello");
                await page.waitForTimeout(10000);

                const messages2 = await page.$$eval('[data-testid="msg-container"]', msgs =>
                    msgs.slice(-2).map(msg => msg.textContent.toLowerCase())
                );

                for (const message of messages2) {
                    if (message.includes('thank') || message.includes('received') ||
                        message.includes('processing') || message.includes('next') ||
                        message.includes('continue')) {
                        throw new Error("Program closed: System accepted text when it should reject it.");
                    }
                }

                // Error Test 3: Send emojis (should be rejected)
                console.log("⚠️ Error Test 3: Sending emojis...");
                await sendMessageToBox(page, "✅✅✅");
                await page.waitForTimeout(8000);

                const messages3 = await page.$$eval('[data-testid="msg-container"]', msgs =>
                    msgs.slice(-2).map(msg => msg.textContent.toLowerCase())
                );

                for (const message of messages3) {
                    if (message.includes('thank') || message.includes('received') ||
                        message.includes('processing') || message.includes('next') ||
                        message.includes('continue')) {
                        throw new Error("Program closed: System accepted emojis when it should reject them.");
                    }
                }

                console.log("🎯 All invalid input tests completed successfully!");
                await page.screenshot({ path: 'screenshots/after-invalid-input-tests.png', fullPage: true });
            });

            // Step 3: Upload blank receipt and wait for rejection
            await test.step('Upload blank receipt and capture rejection message', async () => {
                console.log("📸 Uploading blank/blurry receipt...");

                try {
                    await uploadReceipt(page, blankReceiptPath);
                    console.log("⏳ Waiting for system response...");
                    await page.waitForTimeout(15000);
                    console.log("🔍 Looking for rejection message in recent chat...");

                    let rejectionFound = false;
                    let acceptanceFound = false;
                    let attempts = 0;
                    const maxAttempts = 10;

                    while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                        attempts++;
                        console.log(`Attempt ${attempts}: Checking for system response...`);

                        try {
                            // Check using selectable-text spans (THIS IS THE ONE THAT WORKS)
                            const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text');
                            console.log(`Found ${selectableTexts.length} selectable text elements`);

                            for (let element of selectableTexts) {
                                const text = await element.textContent();

                                // Check for REJECTION messages (CORRECT behavior)
                                if (text && (
                                    text.includes("Sorry, but we were unable to verify your receipt") ||
                                    text.includes("unable to verify your receipt") ||
                                    text.includes("could not verify") ||
                                    text.includes("blurry") ||
                                    text.includes("unclear") ||
                                    text.includes("not clear") ||
                                    text.toLowerCase().includes("manual review")
                                )) {
                                    console.log("✅ Found rejection message using selectable-text span!");
                                    console.log(`📝 Full message: ${text}`);
                                    rejectionFound = true;
                                    await page.screenshot({
                                        path: 'screenshots/blank-receipt-properly-rejected.png',
                                        fullPage: true
                                    });
                                    break;
                                }

                                // Check if system ACCEPTED instead (CRITICAL FAILURE)
                                if (text && (
                                    text.includes("Thank you for your submission") ||
                                    text.includes("successfully received") ||
                                    text.includes("validated") ||
                                    text.includes("approved") ||
                                    text.includes("received your details and will proceed") ||
                                    text.includes("verification successful") ||
                                    text.includes("receipt has been accepted")
                                )) {
                                    console.log("❌ CRITICAL FAILURE: System ACCEPTED blank/blurry receipt!");
                                    console.log(`📝 Acceptance message: ${text}`);
                                    acceptanceFound = true;
                                    receiptValidationResults.blurryReceiptAccepted = true;
                                    receiptValidationResults.passed = false;
                                    receiptValidationResults.failures.push("System INCORRECTLY ACCEPTED blank/blurry receipt instead of rejecting it");

                                    await page.screenshot({
                                        path: 'screenshots/FAILED-blank-receipt-incorrectly-accepted.png',
                                        fullPage: true
                                    });
                                    break;
                                }
                            }

                            if (rejectionFound || acceptanceFound) {
                                break;
                            }

                            // Also check recent messages as backup
                            const recentMessages = await getRecentMessages(page, 5);

                            for (const message of recentMessages) {
                                // Check for rejection
                                if (message && (
                                    message.includes("Sorry, but we were unable to verify your receipt") ||
                                    message.includes("unable to verify your receipt") ||
                                    message.includes("could not verify") ||
                                    message.includes("blurry") ||
                                    message.toLowerCase().includes("manual review")
                                )) {
                                    console.log("✅ Found rejection message in recent messages!");
                                    rejectionFound = true;
                                    break;
                                }

                                // Check for acceptance (FAILURE)
                                if (message && (
                                    message.includes("Thank you for your submission") ||
                                    message.includes("received your details and will proceed") ||
                                    message.includes("successfully received") ||
                                    message.includes("validated")
                                )) {
                                    console.log("❌ CRITICAL: System ACCEPTED blank receipt (found in recent messages)!");
                                    acceptanceFound = true;
                                    receiptValidationResults.blurryReceiptAccepted = true;
                                    receiptValidationResults.passed = false;
                                    receiptValidationResults.failures.push("System accepted blank/blurry receipt (detected in recent messages)");
                                    break;
                                }
                            }

                        } catch (innerError) {
                            console.log(`⚠️ Error during message check: ${innerError.message}`);
                        }

                        if (rejectionFound || acceptanceFound) {
                            break;
                        }

                        console.log(`❌ System response not found yet. Waiting 3 seconds... (${attempts}/${maxAttempts})`);
                        await page.waitForTimeout(3000);
                    }

                    // Handle results
                    if (rejectionFound) {
                        console.log("🎉 Blank receipt validation PASSED - System CORRECTLY REJECTED blurry receipt!");
                    } else if (acceptanceFound) {
                        console.log("❌ Blank receipt validation FAILED - System ACCEPTED invalid receipt!");
                        console.log("🛑 STOPPING receipt validation tests - will skip to next test (Chat with Agent)...");
                    } else {
                        const noResponseMessage = "⚠️ No clear response found for blank receipt after waiting";
                        console.log(noResponseMessage);
                        receiptValidationResults.passed = false;
                        receiptValidationResults.failures.push(noResponseMessage);
                    }

                } catch (error) {
                    console.log(`❌ Error during blank receipt upload: ${error.message}`);
                    receiptValidationResults.passed = false;
                    receiptValidationResults.failures.push(`Blank receipt test error: ${error.message}`);
                }
            });

            // Step 4: Click Resubmit button
            await test.step('Click latest Resubmit New Receipt button', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("⚠️ Skipping resubmit click - test already failed (blank receipt was accepted)");
                    return;
                }

                console.log("🔄 Waiting for the latest 'Resubmit New Receipt' button to appear...");
                await page.waitForTimeout(2000);

                try {
                    const buttons = await page.$$('div._ahei:has-text("Resubmit New Receipt")');
                    console.log(`Found ${buttons.length} 'Resubmit New Receipt' buttons`);

                    if (buttons.length === 0) {
                        throw new Error("❌ No Resubmit buttons found on the page.");
                    }

                    const latestButton = buttons[buttons.length - 1];
                    console.log("✅ Targeting the latest Resubmit button...");

                    await latestButton.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(1000);

                    console.log("🖱️ Clicking latest Resubmit button...");
                    await latestButton.click({ force: true });
                    console.log("✅ Latest Resubmit button clicked successfully!");
                    await page.waitForTimeout(5000);

                } catch (error) {
                    console.error(`❌ Failed to click latest Resubmit button: ${error.message}`);
                    await page.screenshot({ path: 'screenshots/latest-resubmit-failed.png', fullPage: true });
                    throw error;
                }
            });

            // Step 5: Wait for NEW instruction message
            await test.step('Capture NEW detailed instruction message', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("⚠️ Skipping instruction capture - test already failed (blank receipt was accepted)");
                    return;
                }

                console.log("============= Waiting for NEW detailed instruction message (STRICT MODE) =============");

                let instructionFound = false;
                let fullMessageCaptured = false;
                let attempts = 0;
                const maxAttempts = 10;

                while ((!instructionFound || !fullMessageCaptured) && attempts < maxAttempts) {
                    attempts++;
                    console.log(`Attempt ${attempts}: Looking for COMPLETE NEW instruction message...`);

                    try {
                        const allSpans = await page.$$('span._ao3e.selectable-text.copyable-text, span.x1lliihq, span.selectable-text');
                        console.log(`Found ${allSpans.length} text elements to check`);

                        for (let span of allSpans) {
                            const text = await span.textContent();

                            if (text && (
                                text.includes("Please submit your receipt as a proof of purchase") ||
                                text.includes("receipt must contain the following information")
                            )) {
                                console.log("🔍 Found instruction message, verifying it's complete...");

                                const hasProofOfPurchase = text.includes("proof of purchase");
                                const hasReceiptMustContain = text.includes("receipt must contain");
                                const messageLength = text.length;
                                console.log(`📏 Message length: ${messageLength} characters`);

                                if (hasProofOfPurchase && hasReceiptMustContain && messageLength > 100) {
                                    console.log("✅ Message appears COMPLETE! Verifying stability...");
                                    await page.waitForTimeout(2000);

                                    const reconfirmText = await span.textContent();
                                    if (reconfirmText === text && reconfirmText.length === messageLength) {
                                        console.log("✅ NEW detailed instruction FULLY LOADED and STABLE in chat!");
                                        console.log(`📝 Full message: ${text}`);
                                        instructionFound = true;
                                        fullMessageCaptured = true;
                                        await page.screenshot({
                                            path: 'screenshots/NEW-instruction-captured.png',
                                            fullPage: true
                                        });
                                        break;
                                    } else {
                                        console.log("⚠️ Message still loading, waiting longer...");
                                    }
                                } else {
                                    console.log("⚠️ Message found but incomplete. Missing elements:");
                                    console.log(`   - Proof of purchase: ${hasProofOfPurchase}`);
                                    console.log(`   - Receipt must contain: ${hasReceiptMustContain}`);
                                    console.log(`   - Length check (>100): ${messageLength > 100}`);
                                }
                            }
                        }

                    } catch (error) {
                        console.log(`⚠️ Error during instruction check: ${error.message}`);
                    }

                    if (instructionFound && fullMessageCaptured) {
                        break;
                    }

                    console.log(`❌ COMPLETE NEW instruction not found yet. Waiting 3 seconds... (${attempts}/${maxAttempts})`);
                    await page.waitForTimeout(3000);
                }

                if (instructionFound && fullMessageCaptured) {
                    console.log("✅ ✅ NEW instruction FULLY CAPTURED and VERIFIED! Ready to upload valid receipt.");
                    await page.waitForTimeout(3000);
                } else {
                    console.log("⚠️ NEW instruction message not found or incomplete in recent chat");
                    console.log("ℹ️ Continuing with valid receipt upload anyway...");
                }
            });

            // Step 6: Upload valid receipt
            await test.step('Upload valid receipt', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("⚠️ Skipping valid receipt upload - test already failed (blank receipt was accepted)");
                    return;
                }

                console.log("📸 Starting valid receipt upload...");

                try {
                    await uploadReceipt(page, receiptPath);
                    await page.waitForTimeout(15000);

                    console.log("🔍 Checking for receipt acceptance...");
                    const recentMessages = await getRecentMessages(page, 3);
                    const recentText = recentMessages.join(' ').toLowerCase();

                    console.log("📝 Recent messages after valid receipt upload:", recentMessages);

                    if (recentText.includes('thank') || recentText.includes('received') ||
                        recentText.includes('processing') || recentText.includes('success') ||
                        recentText.includes('approved')) {
                        console.log("✅ Valid receipt appears to have been accepted");
                    }

                    await page.screenshot({ path: 'screenshots/valid-receipt-upload-complete.png', fullPage: true });

                } catch (error) {
                    console.error("❌ Valid receipt upload failed:", error.message);
                    await page.screenshot({ path: 'screenshots/valid-receipt-upload-failed.png', fullPage: true });
                    throw error;
                }
            });

            // Step 7: Detect success validation message
            await test.step('Wait for validation success message', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("🚫 Skipping validation success check - test already failed (blank receipt was accepted)");
                    return;
                }

                console.log("============= Waiting for validation success message =============");

                let successFound = false;
                let attempts = 0;
                const maxAttempts = 10;

                while (!successFound && attempts < maxAttempts) {
                    attempts++;
                    console.log(`Attempt ${attempts}: Looking for success validation message...`);

                    try {
                        const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text');
                        console.log(`Found ${selectableTexts.length} selectable text elements`);

                        for (let element of selectableTexts) {
                            const text = await element.textContent();

                            if (text && (
                                (text.includes("Thank you for your submission") && text.includes("received your details")) ||
                                (text.includes("Thank you for your submission") && text.includes("proceed with validation"))
                            )) {
                                console.log("✅ Found validation success message!");
                                console.log(`📝 Full message: ${text}`);
                                successFound = true;
                                await page.screenshot({ path: 'screenshots/validation-success-detected.png', fullPage: true });
                                break;
                            }
                        }

                    } catch (error) {
                        console.log(`⚠️ Error during success message check: ${error.message}`);
                    }

                    if (successFound) {
                        break;
                    }

                    console.log(`❌ Success message not found yet. Waiting 3 seconds... (${attempts}/${maxAttempts})`);
                    await page.waitForTimeout(3000);
                }

                if (!successFound) {
                    console.log("⚠️ Validation success message not found");
                    receiptValidationResults.passed = false;
                    receiptValidationResults.failures.push("Validation success message not detected after valid receipt");
                } else {
                    console.log("✅ Validation success message detected! Proceeding to second blank receipt test...");
                }
            });

            // Step 8: Click Submit New Receipt button
            await test.step('Click Submit New Receipt button after success message', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("🚫 Skipping Submit New Receipt button - test already failed (first blank receipt was accepted)");
                    return;
                }

                console.log("🔄 Looking for 'Submit New Receipt' button after success message...");
                await page.waitForTimeout(3000);

                try {
                    // Direct XPath targeting (THIS IS THE ONE THAT WORKS)
                    const xpath = '//div[contains(@class, "_ahei") and contains(., "Submit New Receipt")]';
                    const button = await page.waitForSelector(`xpath=${xpath}`, { timeout: 5000 });

                    if (button) {
                        console.log(`✅ Found button with xpath`);
                        const buttonText = await button.textContent();
                        console.log(`Button text: "${buttonText}"`);

                        await button.scrollIntoViewIfNeeded();
                        await page.waitForTimeout(1000);

                        await button.evaluate(el => el.click());
                        console.log("✅ Submit New Receipt button clicked via evaluate!");
                        await page.waitForTimeout(5000);
                    }

                } catch (error) {
                    console.error(`❌ Failed to click Submit New Receipt button: ${error.message}`);
                    await page.screenshot({ path: 'screenshots/submit-new-receipt-button-not-found.png', fullPage: true });
                    receiptValidationResults.passed = false;
                    receiptValidationResults.failures.push(`Failed to click Submit New Receipt button: ${error.message}`);
                }
            });

            // Step 9: Wait for instruction message again (REUSING Step 5 logic)
            await test.step('Capture instruction message after Submit New Receipt', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("⚠️ Skipping instruction capture - test already failed");
                    return;
                }

                console.log("============= Waiting for instruction message after Submit New Receipt =============");

                let instructionFound = false;
                let attempts = 0;
                const maxAttempts = 10;

                while (!instructionFound && attempts < maxAttempts) {
                    attempts++;
                    console.log(`Attempt ${attempts}: Looking for COMPLETE instruction message...`);

                    try {
                        const allSpans = await page.$$('span._ao3e.selectable-text.copyable-text');
                        console.log(`Found ${allSpans.length} text elements to check`);

                        for (let span of allSpans) {
                            const text = await span.textContent();

                            if (text && text.includes("Please submit your receipt as a proof of purchase")) {
                                console.log("🔍 Found instruction message, verifying completeness...");
                                const messageLength = text.length;
                                console.log(`📏 Message length: ${messageLength} characters`);

                                if (messageLength > 100) {
                                    await page.waitForTimeout(2000);
                                    const reconfirmText = await span.textContent();

                                    if (reconfirmText === text) {
                                        console.log("✅ Instruction FULLY LOADED and STABLE!");
                                        console.log(`📝 Full message: ${text}`);
                                        instructionFound = true;
                                        break;
                                    }
                                }
                            }
                        }

                    } catch (error) {
                        console.log(`⚠️ Error during instruction check: ${error.message}`);
                    }

                    if (instructionFound) {
                        break;
                    }

                    console.log(`❌ Instruction not found yet. Waiting 3 seconds... (${attempts}/${maxAttempts})`);
                    await page.waitForTimeout(3000);
                }

                if (instructionFound) {
                    console.log("✅ Instruction captured! Ready for second blank receipt.");
                    await page.waitForTimeout(3000);
                }
            });

            // Step 10: Upload second blank receipt
            await test.step('Upload second blank receipt after successful validation', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("🚫 Skipping Upload second blank receipt - test already failed (first blank receipt was accepted)");
                    return;
                }

                console.log("📸 Uploading second blank/blurry receipt...");

                try {
                    await uploadReceipt(page, blankReceiptPath);
                    console.log("⏳ Waiting for system response...");
                    await page.waitForTimeout(15000);
                    console.log("🔍 Looking for rejection message for second blank receipt...");

                    let rejectionFound = false;
                    let attempts = 0;
                    const maxAttempts = 10;

                    while (!rejectionFound && attempts < maxAttempts) {
                        attempts++;
                        console.log(`Attempt ${attempts}: Checking for rejection instruction message...`);

                        try {
                            const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text');
                            console.log(`Found ${selectableTexts.length} selectable text elements`);

                            for (let element of selectableTexts) {
                                const text = await element.textContent();

                                if (text && (
                                    text.includes("Please submit your receipt as a proof of purchase") ||
                                    (text.includes("Store Name") && text.includes("Receipt Date") && text.includes("Product Name"))
                                )) {
                                    console.log("✅ Found receipt instruction message for second blank receipt!");
                                    console.log(`📝 Full message: ${text}`);
                                    rejectionFound = true;
                                    await page.screenshot({ path: 'screenshots/second-blank-receipt-rejected.png', fullPage: true });
                                    break;
                                }
                            }

                        } catch (innerError) {
                            console.log(`⚠️ Error during message check: ${innerError.message}`);
                        }

                        if (rejectionFound) {
                            break;
                        }

                        console.log(`❌ Rejection message not found yet. Waiting 3 seconds... (${attempts}/${maxAttempts})`);
                        await page.waitForTimeout(3000);
                    }

                    if (!rejectionFound) {
                        const noResponseMessage = "⚠️ No rejection message found for second blank receipt";
                        console.log(noResponseMessage);
                        receiptValidationResults.passed = false;
                        receiptValidationResults.failures.push(noResponseMessage);
                    } else {
                        console.log("✅ System CORRECTLY REJECTED second blank receipt!");
                    }

                } catch (error) {
                    console.log(`⚠️ Second blank receipt upload test failed: ${error.message}`);
                    receiptValidationResults.passed = false;
                    receiptValidationResults.failures.push(`Second blank receipt test error: ${error.message}`);
                }
            });

            // Step 11: Click Proceed button
            await test.step('Click Proceed button', async () => {
                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("🚫 Skipping Proceed button - test already failed (first blank receipt was accepted)");
                    return;
                }

                console.log("🔄 Looking for 'Proceed' button...");
                await page.waitForTimeout(3000);

                try {
                    // THIS IS THE METHOD THAT WORKS
                    const proceedButtons = await page.$$('div._ahei');
                    console.log(`Found ${proceedButtons.length} div._ahei elements`);

                    for (const button of proceedButtons) {
                        const text = await button.textContent();
                        console.log(`Checking button text: "${text}"`);

                        if (text && text.trim() === 'Proceed') {
                            console.log("✅ Found Proceed button! Clicking...");
                            await button.click();
                            console.log("✅ Proceed button clicked successfully!");
                            await page.screenshot({ path: 'screenshots/proceed-button-clicked.png', fullPage: true });
                            await page.waitForTimeout(5000);
                            break;
                        }
                    }

                } catch (error) {
                    console.error(`❌ Failed to click Proceed button: ${error.message}`);
                    await page.screenshot({ path: 'screenshots/proceed-button-not-found.png', fullPage: true });
                    receiptValidationResults.passed = false;
                    receiptValidationResults.failures.push(`Failed to click Proceed button: ${error.message}`);
                }
            });


            // FINAL: Handle receipt validation test result - FAIL but keep browser open
            if (!receiptValidationResults.passed) {
                console.log("\n========== RECEIPT VALIDATION TEST RESULTS ==========");
                console.log("⚠️ Receipt validation completed with FAILURES:");
                receiptValidationResults.failures.forEach(failure => console.log(`  - ${failure}`));

                if (receiptValidationResults.blurryReceiptAccepted) {
                    console.log("\n📋 CRITICAL ISSUE: System accepted invalid (blank/blurry) receipt(s)");
                    console.log("🛑 Remaining receipt validation steps were skipped");
                }

                console.log("\n❌ RECEIPT VALIDATION TEST FAILED");
                console.log("🌐 Browser remains open for subsequent tests");
                console.log("⏭️ Moving to next test: Chat with Agent...");
                console.log("====================================================\n");

                // Add detailed info for reporting
                test.info().attachments.push({
                    name: 'receipt-validation-failure-details',
                    contentType: 'text/plain',
                    body: Buffer.from(
                        `Receipt Validation Failures:\n${receiptValidationResults.failures.join('\n')}\n\n` +
                        `Blurry receipt accepted: ${receiptValidationResults.blurryReceiptAccepted}\n` +
                        `Test skipped remaining steps: ${receiptValidationResults.blurryReceiptAccepted}`
                    )
                });

                // Mark test as failed but don't stop execution
                test.fail();
                throw new Error(`Receipt validation failed: ${receiptValidationResults.failures.join('; ')}`);
            } else {
                console.log("\n========== RECEIPT VALIDATION TEST RESULTS ==========");
                console.log("🎉 Receipt validation workflow completed successfully!");
                console.log("✅ All invalid receipts were properly rejected");
                console.log("✅ Valid receipt was properly accepted");
                console.log("====================================================\n");
            }

        } catch (error) {
            console.error("❌ Receipt validation test encountered an error:", error.message);
            await page.screenshot({ path: 'screenshots/receipt-test-error.png', fullPage: true });

            // Mark test as failed but allow continuation
            receiptValidationResults.passed = false;
            receiptValidationResults.failures.push(`Test execution error: ${error.message}`);

            test.fail();
            throw error;
        }
    });


    //=================================== Test 5 Chat with Agent ===========================================================================


    // Test 5: Chat with Agent functionality
    test('Chat with Agent functionality', async () => {
        test.setTimeout(300000); // 5 minutes

        // Test configuration
        const TEST_CONFIG = {
            agentMessage: "Hi...How to do this...",  //
            expectedResponse: "Got a question? Just type in your enquiry below — our Agent will get back to you within 3 working days. We're here to help!",
            timeouts: {
                responseWait: 15000
            }
        };

        try {
            // Step 1: Chat with Agent and validate system response
            await test.step('Chat with Agent and validate system response', async () => {
                console.log("============= TEST 5 - Starting Chat with Agent workflow =============");

                await chatWithAgent(page, TEST_CONFIG.agentMessage, TEST_CONFIG.expectedResponse, { delay: 100 });
                await page.waitForTimeout(3000);
                await page.screenshot({ path: 'screenshots/agent-workflow-completed.png', fullPage: true });
                console.log("✅ Chat with Agent workflow completed successfully!");
            });

            console.log("🎉 Chat with Agent functionality completed successfully!");

        } catch (error) {
            console.error(`❌ Error in agent message workflow: ${error.message}`);
            await page.screenshot({
                path: `test-results/agent-workflow-error-${Date.now()}.png`,
                fullPage: true
            });
            throw error;
        }


        // Keep browser open for inspection in non-CI environments
        if (!process.env.CI) {
            console.log("Browser will remain open for inspection...");
            await page.waitForTimeout(10000);
        }
    });
});




/*

Please replace these entries directly in the code.

1. contactName: "+60 11-2635 2586"
2. triggerMessage: "hello world"
3. exactCampaignName = "Dettol BDI Guardian Exclusive Contest"


*/

