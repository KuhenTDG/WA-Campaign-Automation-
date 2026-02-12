

const { test, expect, chromium } = require('@playwright/test');
const { sendMessage, sendMessageToBox, uploadReceipt, chatWithAgent, getMostRecentBotMessage } = require('./helpers/WA_helpers');

// Import campaign configuration
const CAMPAIGN_CONFIG = require('./config/campaign-config');

let receiptValidationResults = {
    passed: true,
    failures: [],
    blurryReceiptAccepted: false,
    validReceiptRejected: false,
    secondBlurryReceiptAccepted: false,
    criticalFailure: false
};

test.describe('WhatsApp Automation Tests', () => {
    let browser, context, page;

    // Setup: Login once for all tests
    test.beforeAll(async () => {
        test.setTimeout(300000);

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
    /*  test('Send trigger message and handle proceed button', async () => {
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
              await test.step('Detect campaign message', async () => {
                  console.log(`🔍 Looking for campaign message...`);
                  console.log(`🎯 Searching for: "${CAMPAIGN_CONFIG.exactCampaignName}"`);
  
                  const maxWaitTime = 30000;
                  const interval = 3000;
                  const start = Date.now();
                  let found = false;
  
                  while (Date.now() - start < maxWaitTime) {
                      const elements = await page.locator('span.copyable-text').all();
  
                      for (const el of elements) {
                          const text = await el.textContent().catch(() => '');
  
                          // Normalize both texts to handle line breaks and extra spaces
                          const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase();
                          const normalizedCampaign = CAMPAIGN_CONFIG.exactCampaignName.replace(/\s+/g, ' ').trim().toLowerCase();
  
                          // Check if campaign name exists in the text
                          if (normalizedText.includes(normalizedCampaign)) {
                              console.log(`✅ Campaign message detected!`);
                              console.log(`📄 Found text: "${text.substring(0, 100)}..."`);
                              await page.screenshot({ path: 'screenshots/campaign-detected.png', fullPage: true });
                              found = true;
                              break;
                          }
                      }
  
                      if (found) break;
  
                      const waited = ((Date.now() - start) / 1000).toFixed(0);
                      console.log(`⏳ Waiting... ${waited}s elapsed`);
                      await page.waitForTimeout(interval);
                  }
  
                  if (!found) {
                      console.log(`❌ Campaign message not found: "${CAMPAIGN_CONFIG.exactCampaignName}"`);
                      await page.screenshot({ path: 'screenshots/campaign-not-found.png', fullPage: true });
                      throw new Error(`Campaign message not detected: "${CAMPAIGN_CONFIG.exactCampaignName}"`);
                  }
              });
  
  
  
              // Click Proceed button (only if campaign name was found)
              await test.step('Click most recent Proceed button', async () => {
                  console.log("🔘 Looking for the most recent Proceed button...");
  
                  try {
                      // Wait for any Proceed button to appear first (give enough time)
                      await page.waitForSelector('div._ahef[role="button"]:has-text("Proceed")', {  //####
                          timeout: 30000, // wait up to 30 seconds
                          state: 'attached'
                      });
  
                      // Once at least one exists, get all of them
                      const proceedButtons = await page.$$('div._ahef[role="button"]:has-text("Proceed")');      //####
  
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
  
                      // Helper to get latest bot messages (WhatsApp new UI safe)
                      async function getLastBotMessages(limit = 2) {
                          const nodes = await page.$$(
                              'div.copyable-text span[data-testid="selectable-text"]'
                          );
  
                          if (!nodes || nodes.length === 0) return [];
  
                          const recentNodes = nodes.slice(-limit);
                          const messages = [];
  
                          for (const node of recentNodes) {
                              const text = await page.evaluate(el => {
                                  const clone = el.cloneNode(true);
                                  clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                                  return (clone.innerText || "")
                                      .replace(/\u200B/g, '')      // zero-width space
                                      .replace(/\s+/g, ' ')        // normalize whitespace
                                      .trim();
                              }, node);
  
                              if (text) messages.push(text);
                          }
  
                          return messages;
                      }
  
                      const expectedInstruction = CAMPAIGN_CONFIG.expectedInstructions.nameRequest;
                      let instructionFound = false;
  
                      console.log("🔄 Checking recent bot messages for name request instruction...");
  
                      const recentMessages = await getLastBotMessages(2);
  
                      if (recentMessages.length === 0) {
                          throw new Error("No bot messages found to verify name instruction");
                      }
  
                      for (const msg of recentMessages) {
                          const normalizedText = msg.toLowerCase().trim();
  
                          if (Array.isArray(expectedInstruction)) {
                              // Check if ALL parts exist in the SAME message
                              const allPartsFound = expectedInstruction.every(instr =>
                                  normalizedText.includes(instr.toLowerCase())
                              );
  
                              if (allPartsFound) {
                                  instructionFound = true;
                                  console.log("📝 Matched message:", msg);
                                  break;
                              }
                          } else {
                              if (normalizedText.includes(expectedInstruction.toLowerCase())) {
                                  instructionFound = true;
                                  console.log("📝 Matched message:", msg);
                                  break;
                              }
                          }
                      }
  
                      if (instructionFound) {
                          console.log(`✅ Name request message detected! Found: "${expectedInstruction}"`);
  
                          await page.screenshot({
                              path: 'screenshots/name-request-detected.png',
                              fullPage: true
                          });
  
                      } else {
                          throw new Error(`Name request message not found. Expected: "${expectedInstruction}"`);
                      }
  
                  } catch (error) {
                      console.log("❌ Name request message not found");
  
                      await page.screenshot({
                          path: 'screenshots/name-request-debug.png',
                          fullPage: true
                      });
  
                      // Log actual recent messages for debugging
                      const recentMessages = await (async () => {
                          try {
                              const nodes = await page.$$(
                                  'div.copyable-text span[data-testid="selectable-text"]'
                              );
                              const recent = nodes.slice(-3);
                              const msgs = [];
  
                              for (const node of recent) {
                                  const text = await page.evaluate(el => el.innerText || "", node);
                                  if (text) msgs.push(text.trim());
                              }
  
                              return msgs;
                          } catch {
                              return [];
                          }
                      })();
  
                      console.log("📝 Recent bot messages:", recentMessages);
                      console.log(`🎯 Expected instruction: "${CAMPAIGN_CONFIG.expectedInstructions.nameRequest}"`);
  
                      // Close browser and fail the test
                      console.log("🚫 Closing browser due to name request message not found");
                      await page.close();
                      throw new Error(`Test failed: Expected instruction not detected. Expected: "${CAMPAIGN_CONFIG.expectedInstructions.nameRequest}"`);
                  }
              });
  
  
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
  
                  // Helper to get latest bot messages (same style as your working example)
                  async function getLastBotMessages(limit = 2) {
                      const nodes = await page.$$(
                          'div.copyable-text span[data-testid="selectable-text"]'
                      );
  
                      if (!nodes || nodes.length === 0) return [];
  
                      const recentNodes = nodes.slice(-limit);
                      const messages = [];
  
                      for (const node of recentNodes) {
                          const text = await page.evaluate(el => {
                              const clone = el.cloneNode(true);
                              clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                              return (clone.innerText || "")
                                  .replace(/\u200B/g, '')      // zero-width space
                                  .replace(/\s+/g, ' ')        // normalize whitespace
                                  .trim();
                          }, node);
  
                          if (text) messages.push(text);
                      }
  
                      return messages;
                  }
  
                  const expectedInstruction = CAMPAIGN_CONFIG.expectedInstructions.nameRequest;
                  let instructionFound = false;
  
                  console.log("🔄 Checking recent bot messages for name request instruction...");
  
                  const recentMessages = await getLastBotMessages(2);
  
                  if (recentMessages.length === 0) {
                      throw new Error("No bot messages found to verify name instruction");
                  }
  
                  for (const msg of recentMessages) {
                      const normalizedText = msg.toLowerCase().trim();
  
                      if (Array.isArray(expectedInstruction)) {
                          // Check if ALL instruction parts exist in the same message
                          const allPartsFound = expectedInstruction.every(instr =>
                              normalizedText.includes(instr.toLowerCase())
                          );
  
                          if (allPartsFound) {
                              instructionFound = true;
                              console.log("📝 Matched message:", msg);
                              break;
                          }
                      } else {
                          // Single string fallback
                          if (normalizedText.includes(expectedInstruction.toLowerCase())) {
                              instructionFound = true;
                              console.log("📝 Matched message:", msg);
                              break;
                          }
                      }
                  }
  
                  if (instructionFound) {
                      console.log(`✅ Name request message detected!`);
                      console.log(`🎯 Verified all parts: ${JSON.stringify(expectedInstruction)}`);
                      console.log("🚀 Proceeding with name validation test...");
  
                      await page.screenshot({
                          path: 'screenshots/name-request-verified-test3.png',
                          fullPage: true
                      });
  
                  } else {
                      throw new Error(`Name request message not found. Expected: ${JSON.stringify(expectedInstruction)}`);
                  }
  
              } catch (error) {
                  console.log("❌ Name request message not found at start of Test 3");
  
                  await page.screenshot({
                      path: 'screenshots/test3-name-request-missing.png',
                      fullPage: true
                  });
  
                  // Log actual recent messages for debugging
                  const recentMessages = await (async () => {
                      try {
                          const nodes = await page.$$(
                              'div.copyable-text span[data-testid="selectable-text"]'
                          );
                          const recent = nodes.slice(-3);
                          const msgs = [];
  
                          for (const node of recent) {
                              const text = await page.evaluate(el => el.innerText || "", node);
                              if (text) msgs.push(text.trim());
                          }
  
                          return msgs;
                      } catch {
                          return [];
                      }
                  })();
  
                  console.log("📝 Recent bot messages:", recentMessages);
                  console.log(`🎯 Expected instruction parts: ${JSON.stringify(CAMPAIGN_CONFIG.expectedInstructions.nameRequest)}`);
  
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
                          // Helper to get latest bot messages (same as working receipt flow)
                          async function getLastBotMessages(limit = 3) {
                              const nodes = await page.$$(
                                  'div.copyable-text span[data-testid="selectable-text"]'
                              );
  
                              if (!nodes || nodes.length === 0) return [];
  
                              const recentNodes = nodes.slice(-limit);
                              const messages = [];
  
                              for (const node of recentNodes) {
                                  const text = await page.evaluate(el => {
                                      const clone = el.cloneNode(true);
                                      clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                                      return (clone.innerText || "")
                                          .replace(/\u200B/g, '')      // zero-width space
                                          .replace(/\s+/g, ' ')        // normalize whitespace
                                          .trim();
                                  }, node);
  
                                  if (text) messages.push(text);
                              }
  
                              return messages;
                          }
  
                          const recentMessages = await getLastBotMessages(3);
  
                          if (!recentMessages || recentMessages.length === 0) {
                              console.log(`⚠️ No bot messages detected yet, waiting...`);
                              await page.waitForTimeout(2000);
                              continue;
                          }
  
                          // ✅ Combine last messages into one searchable string
                          let combinedText = recentMessages.join(' ').toLowerCase();
  
  
  
                          // ---- CHECK IC REQUEST (ACCEPTANCE - CRITICAL) ----
                          const icRequestPatterns = CAMPAIGN_CONFIG.expectedInstructions.icRequest;
                          let isICRequestMessage = false;
  
                          if (Array.isArray(icRequestPatterns)) {
                              isICRequestMessage = icRequestPatterns.every(pattern =>
                                  combinedText.includes(pattern.toLowerCase())
                              );
                          } else {
                              isICRequestMessage = combinedText.includes(icRequestPatterns.toLowerCase());
                          }
  
                          if (isICRequestMessage) {
                              console.log(`❌ CRITICAL: System ACCEPTED invalid name "${invalidName}" and proceeded to IC request!`);
                              console.log(`📝 IC request message detected in combined text`);
                              console.log(`🎯 Matched patterns: ${JSON.stringify(icRequestPatterns)}`);
                              proceeded = true;
                              break;
                          }
  
                          // ---- CHECK REJECTION (CORRECT BEHAVIOR) ----
                          const rejectionPatterns = CAMPAIGN_CONFIG.expectedInstructions.nameRejection;
                          let isRejectionMessage = false;
  
                          if (Array.isArray(rejectionPatterns)) {
                              isRejectionMessage = rejectionPatterns.every(pattern =>
                                  combinedText.includes(pattern.toLowerCase())
                              );
                          } else {
                              isRejectionMessage = combinedText.includes(rejectionPatterns.toLowerCase());
                          }
  
                          if (isRejectionMessage) {
                              console.log(`✅ System REJECTED invalid name "${invalidName}" as expected!`);
                              console.log(`📝 Rejection message detected in combined text`);
                              console.log(`🎯 Matched rejection patterns: ${JSON.stringify(rejectionPatterns)}`);
                              rejected = true;
  
                              await page.screenshot({
                                  path: `screenshots/name-rejected-${invalidName.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                                  fullPage: true
                              });
  
                              break;
                          }
  
                      } catch (error) {
                          console.log(`⚠️ Error during message check: ${error.message}`);
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
                      const failureMessage = `❌ VALIDATION FAILED: System accepted invalid name "${invalidName}" and proceeded to IC request step!`;
                      console.log(failureMessage);
                      validationResults.passed = false;
                      validationResults.failures.push(failureMessage);
                      validationResults.invalidNamesAccepted.push(invalidName);
  
                      await page.screenshot({
                          path: `screenshots/FAILED-name-accepted-${invalidName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.png`,
                          fullPage: true
                      });
  
                      console.log(`🛑 STOPPING name validation test - system accepted invalid name. Moving to IC test...`);
                      break;
                  } else if (rejected) {
                      console.log(`✅ System correctly rejected "${invalidName}"`);
                      console.log(`⏳ Waiting 5 seconds for system to complete error message sequence...`);
                      // WAIT 5 seconds after rejection
                      await page.waitForTimeout(5000);
                      console.log(`✅ Wait complete. Ready for next invalid name test.`);
                  } else {
                      console.log(`⚠️ No clear response detected for "${invalidName}"`);
                      // WAIT 8 seconds if unclear
                      await page.waitForTimeout(8000);
  
                      // Close the browser after waiting
                      console.log("🛑 Closing browser due to no response...");
                      await browser.close();
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
  
                          // ✅ GET LAST 2-3 MESSAGES AND COMBINE THEM
                          const recentMessages = selectableTexts.slice(-3);
                          let combinedText = '';
  
                          for (let element of recentMessages) {
                              const text = await element.textContent();
                              if (text) {
                                  combinedText += text.toLowerCase() + ' ';
                              }
                          }
  
  
  
                          const icRequestPatterns = CAMPAIGN_CONFIG.expectedInstructions.icRequest;
                          let isICRequestMessage = false;
  
                          if (Array.isArray(icRequestPatterns)) {
                              // Check if ALL patterns exist in the combined text
                              isICRequestMessage = icRequestPatterns.every(pattern =>
                                  combinedText.toLowerCase().includes(pattern.toLowerCase())
                              );
                          } else {
                              isICRequestMessage = combinedText.toLowerCase().includes(icRequestPatterns.toLowerCase());
                          }
  
                          console.log(`🔍 Checking for IC request. Combined text: "${combinedText.substring(0, 200)}..."`);
                          console.log(`🎯 Looking for patterns:`, icRequestPatterns);
                          console.log(`📊 Match result: ${isICRequestMessage}`);
  
  
                          if (isICRequestMessage) {
                              console.log(`🎉 Valid name "${userName}" ACCEPTED! System moved to IC request step.`);
                              accepted = true;
                              await page.screenshot({ path: 'screenshots/valid-name-accepted.png', fullPage: true });
                              break;
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
                          console.log(`❌ IC request instruction not found yet. Waiting 2 seconds... (${attempts}/${maxAttempts})`);
                          // WAIT 2 seconds before retry
                          await page.waitForTimeout(2000);
                      }
                  }
  
                  if (!accepted) {
                      console.log(`⚠️ No clear success indicator found for valid name "${userName}"`);
                      const warningMessage = `Valid name "${userName}" may not have been accepted properly - IC request instruction not found`;
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
              console.log("⏭️ Moving to IC test...");
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
  
  
      //=================================== Test 4 IC Uploads ===========================================================================
  
      // Test 4: IC validation with error sequence
      test('Send IC number with error sequence and validation', async () => {
          test.setTimeout(180000); // 3 minutes
  
          const validIC = "011218101327";
          let validationResults = {
              passed: true,
              failures: [],
              invalidICsAccepted: []
          };
  
          // FIRST: Verify IC request message is present before starting validation
          await test.step('Verify IC request message before validation', async () => {
              console.log("========== TEST 4 Starting - Checking for IC request message ===========");
  
              try {
                  await page.waitForTimeout(3000); // Brief wait for messages to load
  
                  // ✅ GET RECENT CHAT MESSAGES (same approach as name validation)
                  const selectableTexts = await page.locator('span.selectable-text').all();
  
                  if (selectableTexts.length === 0) {
                      throw new Error("No chat messages found on page");
                  }
  
                  // Get last 3 messages and combine them
                  const recentMessages = selectableTexts.slice(-3);
                  let combinedText = '';
  
                  for (let element of recentMessages) {
                      const text = await element.textContent();
                      if (text) {
                          combinedText += text.toLowerCase() + ' ';
                      }
                  }
  
                  console.log(`🔍 Combined recent messages: "${combinedText.substring(0, 200)}..."`);
  
                  // Get the expected instruction from config
                  const expectedInstruction = CAMPAIGN_CONFIG.expectedInstructions.icRequest;
                  let instructionFound = false;
  
                  if (Array.isArray(expectedInstruction)) {
                      // Check if ALL parts exist in combined text
                      instructionFound = expectedInstruction.every(instr => {
                          if (instr instanceof RegExp) {
                              return instr.test(combinedText);
                          }
                          return combinedText.includes(instr.toLowerCase());
                      });
                  } else {
                      // Single string check
                      instructionFound = combinedText.includes(expectedInstruction.toLowerCase());
                  }
  
                  if (instructionFound) {
                      console.log(`✅ IC request message detected in recent chat!`);
                      console.log(`🎯 Verified instruction: ${JSON.stringify(expectedInstruction)}`);
                      console.log("🚀 Proceeding with IC validation test...");
                      await page.screenshot({
                          path: 'screenshots/ic-request-verified-test4.png',
                          fullPage: true
                      });
                  } else {
                      console.log("❌ IC request message not found in recent chat messages");
                      console.log(`📝 Recent messages: "${combinedText}"`);
                      console.log(`🎯 Expected: ${JSON.stringify(expectedInstruction)}`);
                      throw new Error("IC request instruction not found in recent messages");
                  }
  
              } catch (error) {
                  console.log(`❌ Error detecting IC request: ${error.message}`);
                  await page.screenshot({
                      path: 'screenshots/test4-ic-request-missing.png',
                      fullPage: true
                  });
  
                  console.log("🚫 Test 4 cannot proceed - IC request message not detected");
                  throw new Error("Test 4 failed: IC request message not detected - cannot proceed with validation");
              }
          });
  
          await test.step('Send IC number with error sequence and validation', async () => {
              console.log("========== TEST 4 Starting IC validation test ===========");
              await page.waitForTimeout(9000);
  
              // Error IC test cases
              const invalidICs = ['hello', '✅✅✅', '1234', '1234567891234', '011218-10-1127'];
  
              for (const [index, invalidIC] of invalidICs.entries()) {
                  console.log(`🚫 Sending invalid IC #${index + 1}: "${invalidIC}"`);
                  await sendMessageToBox(page, invalidIC);
  
                  // WAIT 5 seconds after sending for system to process
                  await page.waitForTimeout(5000);
  
                  console.log(`🔍 Checking system response for "${invalidIC}"...`);
  
                  let rejected = false;
                  let proceeded = false;
                  let attempts = 0;
                  const maxAttempts = 10;
  
                  while (!rejected && !proceeded && attempts < maxAttempts) {
                      attempts++;
                      await page.waitForTimeout(1000);
  
                      try {
                          const selectableTexts = await page.$$('[data-testid="selectable-text"]');
  
                          if (!selectableTexts || !Array.isArray(selectableTexts) || selectableTexts.length === 0) {
                              console.log(`⚠️ Selectable texts not ready yet, waiting...`);
                              await page.waitForTimeout(2000);
                              continue;
                          }
  
                          // ✅ GET LAST 3-4 MESSAGES AND COMBINE THEM (increased to catch full sequence)
                          const recentMessages = selectableTexts.slice(-4);
                          let combinedText = '';
  
                          for (let element of recentMessages) {
                              const text = await element.textContent();
                              if (text) {
                                  combinedText += text.toLowerCase() + ' ';
                              }
                          }
  
                          console.log(`📝 Combined text preview: "${combinedText.substring(0, 150)}..."`);
  
                          // ✅ IMPROVED: Check receipt upload patterns
                          const receiptUploadPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;
                          let isReceiptUploadMessage = false;
  
                          if (Array.isArray(receiptUploadPatterns)) {
                              isReceiptUploadMessage = receiptUploadPatterns.every(pattern => {
                                  if (pattern instanceof RegExp) {
                                      return pattern.test(combinedText);
                                  }
                                  return combinedText.includes(pattern.toLowerCase());
                              });
                          } else {
                              isReceiptUploadMessage = combinedText.includes(receiptUploadPatterns.toLowerCase());
                          }
  
                          // CRITICAL: Check if system ACCEPTED invalid IC and moved to receipt upload
                          if (isReceiptUploadMessage) {
                              console.log(`❌ CRITICAL FAILURE: System ACCEPTED invalid IC "${invalidIC}"!`);
                              console.log(`📝 Receipt upload message found in: "${combinedText.substring(0, 200)}"`);
                              console.log(`🎯 Matched patterns: ${JSON.stringify(receiptUploadPatterns)}`);
                              proceeded = true;
  
                              // Log the failure
                              const failureMessage = `System incorrectly accepted invalid IC "${invalidIC}" and proceeded to receipt upload`;
                              validationResults.passed = false;
                              validationResults.failures.push(failureMessage);
                              validationResults.invalidICsAccepted.push(invalidIC);
  
                              await page.screenshot({
                                  path: `screenshots/CRITICAL-FAIL-ic-accepted-${invalidIC.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                                  fullPage: true
                              });
                              break;
                          }
  
                          // ✅ IMPROVED: Check for REJECTION patterns
                          const rejectionPatterns = CAMPAIGN_CONFIG.expectedInstructions.icRejection;
                          let isRejectionMessage = false;
  
                          if (Array.isArray(rejectionPatterns)) {
                              isRejectionMessage = rejectionPatterns.every(pattern => {
                                  if (pattern instanceof RegExp) {
                                      return pattern.test(combinedText);
                                  }
                                  return combinedText.includes(pattern.toLowerCase());
                              });
                          } else {
                              isRejectionMessage = combinedText.includes(rejectionPatterns.toLowerCase());
                          }
  
                          if (isRejectionMessage) {
                              console.log(`✅ SUCCESS: System REJECTED invalid IC "${invalidIC}" correctly!`);
                              console.log(`📝 Rejection found in: "${combinedText.substring(0, 200)}"`);
                              console.log(`🎯 Matched rejection patterns: ${JSON.stringify(rejectionPatterns)}`);
                              rejected = true;
                              await page.screenshot({
                                  path: `screenshots/ic-rejected-${invalidIC.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                                  fullPage: true
                              });
                              break;
                          }
  
                      } catch (error) {
                          console.log(`⚠️ Error during message check: ${error.message}`);
                          await page.waitForTimeout(2000);
                      }
  
                      if (!rejected && !proceeded) {
                          console.log(`⏳ Waiting for system response... (${attempts}/${maxAttempts})`);
                          await page.waitForTimeout(2000);
                      }
                  }
  
                  // Handle the results after each invalid IC
                  if (proceeded) {
                      console.log(`\n🛑 STOPPING IC TEST - System accepted invalid IC "${invalidIC}"`);
                      console.log(`❌ Test marked as FAILED`);
                      break; // Stop testing more invalid ICs
                  } else if (rejected) {
                      console.log(`✅ System correctly rejected "${invalidIC}"`);
                      console.log(`⏳ Waiting 5 seconds for next test...`);
                      await page.waitForTimeout(5000);
                  } else {
                      console.log(`⚠️ No clear response for "${invalidIC}" after ${maxAttempts} attempts`);
                      console.log(`🛑 Stopping test - unclear system behavior`);
                      await page.screenshot({
                          path: `screenshots/no-response-${invalidIC.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                          fullPage: true
                      });
                      validationResults.passed = false;
                      validationResults.failures.push(`No clear response for invalid IC "${invalidIC}"`);
                      break;
                  }
              }
  
              // Only test valid IC if all invalid ICs were properly rejected
              if (validationResults.invalidICsAccepted.length === 0) {
                  console.log(`\n✅ All invalid ICs were rejected. Testing valid IC: "${validIC}"`);
                  await sendMessageToBox(page, validIC);
                  await page.waitForTimeout(5000);
  
                  console.log("🔍 Verifying valid IC acceptance...");
  
                  let accepted = false;
                  let attempts = 0;
                  const maxAttempts = 10;
  
                  while (!accepted && attempts < maxAttempts) {
                      attempts++;
                      await page.waitForTimeout(1000);
  
                      try {
                          const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text, span.selectable-text');
  
                          if (!selectableTexts || !Array.isArray(selectableTexts) || selectableTexts.length === 0) {
                              await page.waitForTimeout(2000);
                              continue;
                          }
  
                          // Get last 3 messages
                          const recentMessages = selectableTexts.slice(-3);
                          let combinedText = '';
  
                          for (let element of recentMessages) {
                              const text = await element.textContent();
                              if (text) {
                                  combinedText += text.toLowerCase() + ' ';
                              }
                          }
  
                          // Check for receipt upload (indicates valid IC accepted)
                          const receiptUploadPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;
                          let isReceiptUploadMessage = false;
  
                          if (Array.isArray(receiptUploadPatterns)) {
                              isReceiptUploadMessage = receiptUploadPatterns.every(pattern => {
                                  if (pattern instanceof RegExp) {
                                      return pattern.test(combinedText);
                                  }
                                  return combinedText.includes(pattern.toLowerCase());
                              });
                          } else {
                              isReceiptUploadMessage = combinedText.includes(receiptUploadPatterns.toLowerCase());
                          }
  
                          if (isReceiptUploadMessage) {
                              console.log(`🎉 Valid IC "${validIC}" ACCEPTED! Receipt upload step reached.`);
                              console.log(`📝 Found in: "${combinedText.substring(0, 200)}"`);
                              accepted = true;
                              await page.screenshot({ path: 'screenshots/valid-ic-accepted.png', fullPage: true });
                              break;
                          }
  
                      } catch (error) {
                          console.log(`⚠️ Error checking acceptance: ${error.message}`);
                          await page.waitForTimeout(2000);
                      }
  
                      if (!accepted) {
                          console.log(`⏳ Receipt upload not found yet... (${attempts}/${maxAttempts})`);
                          await page.waitForTimeout(2000);
                      }
                  }
  
                  if (!accepted) {
                      console.log(`⚠️ Valid IC "${validIC}" was not accepted - receipt upload not found`);
                      validationResults.failures.push(`Valid IC "${validIC}" not accepted - receipt upload instruction not found`);
                      validationResults.passed = false;
                  }
              } else {
                  console.log(`\n🚫 SKIPPING valid IC test - system accepted invalid IC(s): ${validationResults.invalidICsAccepted.join(', ')}`);
              }
  
              await page.screenshot({ path: 'screenshots/ic-validation-complete.png', fullPage: true });
          });
  
          // Final results summary
          if (!validationResults.passed) {
              console.log("\n========== IC VALIDATION TEST RESULTS ==========");
              console.log("❌ IC VALIDATION FAILED");
              console.log("\n⚠️ Issues found:");
              validationResults.failures.forEach(failure => console.log(`  - ${failure}`));
  
              if (validationResults.invalidICsAccepted.length > 0) {
                  console.log(`\n🚨 CRITICAL: Invalid ICs accepted: ${validationResults.invalidICsAccepted.join(', ')}`);
              }
  
              console.log("\n====================================================\n");
  
              test.fail();
              throw new Error(`IC validation failed: ${validationResults.failures.join('; ')}`);
          } else {
              console.log("\n========== IC VALIDATION TEST RESULTS ==========");
              console.log("✅ IC VALIDATION PASSED");
              console.log("✅ All invalid ICs properly rejected");
              console.log("✅ Valid IC properly accepted");
              console.log("====================================================\n");
          }
  
      });
  
  
      //=================================== Test 4 Upload Receipt ===========================================================================
  
      // Test 4: Receipt upload with invalid input validation and blank/blurry validation
      test('Receipt error validation and upload', async () => {
          test.setTimeout(300000); // 5 minutes
  
          const receiptPath = "demo-receipt.jpg"; // Valid receipt
          const blankReceiptPath = "demo-receipt.jpg"; //"blank-receipt.jpg"; // Blank/blurry receipt
  
  
  
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
  
                  // Reuse the SAME config from earlier
                  const instructionPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;
  
                  while (!instructionFound && attempts < maxAttempts) {
                      attempts++;
                      console.log(`Attempt ${attempts}: Checking for instruction message...`);
  
                      try {
                          const selectableTexts = await page.$$('span[data-testid="selectable-text"]');
  
                          for (let element of selectableTexts) {
                              const text = await element.evaluate(el => el.textContent)
  
                              if (text) {
                                  const lowerText = text.toLowerCase();
  
                                  // Check if ANY of the patterns exist (same logic as before)
                                  const isReceiptInstruction = Array.isArray(instructionPatterns)
                                      ? instructionPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                                      : lowerText.includes(instructionPatterns.toLowerCase());
  
                                  if (isReceiptInstruction) {
                                      console.log("✅ Found instruction using selectable-text span!");
                                      console.log(`📝 Matched text: ${text.substring(0, 150)}...`);
                                      instructionFound = true;
                                      break;
                                  }
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
                      console.log("⚠️ Receipt instruction not found after maximum attempts, proceeding with tests...");
                  }
              });
  
              // Step 2: Invalid input validation tests
              await test.step('Invalid input validation tests', async () => {
                  console.log("============= Starting invalid input validation tests =============");
  
                  // Get acceptance patterns from config (messages that should NOT appear)
                  const acceptancePatterns = CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted;
  
                  // Helper function to check if system wrongly accepted input
                  const checkForWrongAcceptance = (messages, inputType) => {
                      for (const message of messages) {
                          const lowerMessage = message.toLowerCase();
  
                          // Check if ANY acceptance pattern exists in the message
                          const wronglyAccepted = Array.isArray(acceptancePatterns)
                              ? acceptancePatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()))
                              : lowerMessage.includes(acceptancePatterns.toLowerCase());
  
                          if (wronglyAccepted) {
                              throw new Error(`Program closed: System accepted ${inputType} when it should reject them.`);
                          }
                      }
                  };
  
                  // Error Test 1: Send numbers (should be rejected)
                  console.log("⚠️ Error Test 1: Sending numbers...");
                  await sendMessageToBox(page, "123456");
                  await page.waitForTimeout(10000);
  
                  const messages1 = await page.$$eval('[data-testid="msg-container"]', msgs =>
                      msgs.slice(-2).map(msg => msg.textContent)
                  );
                  checkForWrongAcceptance(messages1, "numbers");
  
                  // Error Test 2: Send text (should be rejected)
                  console.log("⚠️ Error Test 2: Sending text...");
                  await sendMessageToBox(page, "Hello");
                  await page.waitForTimeout(10000);
  
                  const messages2 = await page.$$eval('[data-testid="msg-container"]', msgs =>
                      msgs.slice(-2).map(msg => msg.textContent)
                  );
                  checkForWrongAcceptance(messages2, "text");
  
                  // Error Test 3: Send emojis (should be rejected)
                  console.log("⚠️ Error Test 3: Sending emojis...");
                  await sendMessageToBox(page, "✅✅✅");
                  await page.waitForTimeout(8000);
  
                  const messages3 = await page.$$eval('[data-testid="msg-container"]', msgs =>
                      msgs.slice(-2).map(msg => msg.textContent)
                  );
                  checkForWrongAcceptance(messages3, "emojis");
  
                  console.log("🎯 All invalid input tests completed successfully!");
                  await page.screenshot({ path: 'screenshots/after-invalid-input-tests.png', fullPage: true });
              });
  
  
              // STEP 3: Upload blank receipt
              // ===========================================
              await test.step('Upload blank receipt and capture rejection message', async () => {
                  console.log("📸 Uploading blank/blurry receipt...");
  
                  try {
                      await uploadReceipt(page, blankReceiptPath);
                      console.log("⏳ Waiting for system response...");
                      await page.waitForTimeout(15000);
  
                      let rejectionFound = false;
                      let acceptanceFound = false;
                      let attempts = 0;
                      const maxAttempts = 10;
  
                      const rejectionPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptRejection;
                      const acceptancePatterns = CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted;
  
                      // Helper to get last N bot messages and normalize text                                   //####
                      async function getLastBotMessages(limit = 2) {
                          const nodes = await page.$$(
                              'div.copyable-text span[data-testid="selectable-text"]'
                          );
  
                          if (!nodes || nodes.length === 0) return [];
  
                          const recentNodes = nodes.slice(-limit);
                          const messages = [];
  
                          for (const node of recentNodes) {
                              const text = await page.evaluate(el => {
                                  const clone = el.cloneNode(true);
                                  clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                                  return (clone.innerText || "")
                                      .replace(/\u200B/g, '')      // zero-width space
                                      .replace(/\s+/g, ' ')        // normalize whitespace
                                      .trim();
                              }, node);
  
                              if (text) messages.push(text);
                          }
  
                          return messages;
                      }
  
                      while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                          attempts++;
                          console.log(`Attempt ${attempts}: Checking recent bot messages...`);
  
                          await page.waitForTimeout(3000);
  
                          try {
                              const recentMessages = await getLastBotMessages(2);
  
                              if (recentMessages.length === 0) {
                                  console.log("❌ No bot messages found yet.");
                                  continue;
                              }
  
                              for (const msg of recentMessages) {
                                  const normalizedText = msg.toLowerCase().trim();
  
                                  // Check for REJECTION (CORRECT behavior)
                                  const isRejectionMessage = Array.isArray(rejectionPatterns)
                                      ? rejectionPatterns.some(pattern => normalizedText.includes(pattern.toLowerCase()))
                                      : normalizedText.includes(rejectionPatterns.toLowerCase());
  
                                  if (isRejectionMessage) {
                                      console.log("✅ Found rejection message!");
                                      console.log(`📝 Full message: ${msg}`);
                                      rejectionFound = true;
                                      await page.screenshot({
                                          path: 'screenshots/blank-receipt-properly-rejected.png',
                                          fullPage: true
                                      });
                                      break;
                                  }
  
                                  // Check for ACCEPTANCE (CRITICAL FAILURE)
                                  const isAcceptanceMessage = Array.isArray(acceptancePatterns)
                                      ? acceptancePatterns.some(pattern => normalizedText.includes(pattern.toLowerCase()))
                                      : normalizedText.includes(acceptancePatterns.toLowerCase());
  
                                  if (isAcceptanceMessage) {
                                      console.log("❌ CRITICAL FAILURE: System ACCEPTED blank/blurry receipt!");
                                      console.log(`📝 Acceptance message: ${msg}`);
                                      acceptanceFound = true;
                                      receiptValidationResults.blurryReceiptAccepted = true;
                                      receiptValidationResults.passed = false;
                                      receiptValidationResults.failures.push("System INCORRECTLY ACCEPTED blank/blurry receipt");
  
                                      await page.screenshot({
                                          path: 'screenshots/FAILED-blank-receipt-incorrectly-accepted.png',
                                          fullPage: true
                                      });
                                      break;
                                  }
                              }
  
                          } catch (innerError) {
                              console.log(`⚠️ Error during message check: ${innerError.message}`);
                          }
  
                          if (rejectionFound || acceptanceFound) break;
  
                          console.log(`❌ Response not found yet. Waiting 3s... (${attempts}/${maxAttempts})`);
                          await page.waitForTimeout(3000);
                      }
  
                      // Handle results
                      if (rejectionFound) {
                          console.log("🎉 Blank receipt validation PASSED - System CORRECTLY REJECTED!");
                      } else if (acceptanceFound) {
                          console.log("❌ Blank receipt validation FAILED - System ACCEPTED invalid receipt!");
                          console.log("🛑 STOPPING receipt validation tests...");
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
                  if
                      (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
                      return;
                  }
  
                  console.log("🔄 Waiting for the latest 'Resubmit New Receipt' button to appear...");
                  await page.waitForTimeout(2000);
  
                  try {
                      const buttons = await page.$$('div._ahei:has-text("Submit New Receipt")');    //####
                      console.log(`Found ${buttons.length} 'Submit New Receipt' buttons`);
  
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
                  if
                      (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
                      return;
                  }
  
                  console.log("============= Waiting for NEW detailed instruction message (STRICT MODE) =============");
  
                  await page.waitForTimeout(10000);
  
                  let instructionFound = false;
                  let fullMessageCaptured = false;
                  let attempts = 0;
                  const maxAttempts = 10;
  
                  // ✅ Use config patterns for detection
                  const receiptUploadPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;
  
                  while ((!instructionFound || !fullMessageCaptured) && attempts < maxAttempts) {
                      attempts++;
                      console.log(`Attempt ${attempts}: Looking for COMPLETE NEW instruction message...`);
  
                      try {
                          const allSpans = await page.$$('span._ao3e.selectable-text.copyable-text, span.x1lliihq, span.selectable-text');
                          console.log(`Found ${allSpans.length} text elements to check`);
  
                          for (let span of allSpans) {
                              const text = await span.textContent();
  
                              if (text) {
                                  const lowerText = text.toLowerCase();
                                  const matchedPatterns = receiptUploadPatterns.filter(pattern =>
                                      lowerText.includes(pattern.toLowerCase())
                                  );
  
                                  if (matchedPatterns.length > 0) {
                                      console.log(`🔍 Found possible receipt upload instruction! Matched: ${JSON.stringify(matchedPatterns)}`);
                                      const messageLength = text.length;
                                      console.log(`📏 Message length: ${messageLength} characters`);
  
                                      if (messageLength > 100) {
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
                                          console.log("⚠️ Message found but seems incomplete (too short)");
                                      }
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
  
  
              // STEP 6: Upload valid receipt
              // ===========================================
              await test.step('Upload valid receipt', async () => {
                  if (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
                      return;
                  }
  
                  console.log("📸 Starting valid receipt upload...");
  
                  try {
                      await uploadReceipt(page, receiptPath);
                      await page.waitForTimeout(15000);
  
                      let rejectionFound = false;
                      let acceptanceFound = false;
                      let attempts = 0;
                      const maxAttempts = 10;
  
                      const acceptancePatterns = CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted;
                      const rejectionPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptRejection;
  
                      // Helper to get last N bot messages and normalize text (WA update safe)
                      async function getLastBotMessages(limit = 2) {
                          const nodes = await page.$$(
                              'div.copyable-text span[data-testid="selectable-text"]'
                          );
  
                          if (!nodes || nodes.length === 0) return [];
  
                          const recentNodes = nodes.slice(-limit);
                          const messages = [];
  
                          for (const node of recentNodes) {
                              const text = await page.evaluate(el => {
                                  const clone = el.cloneNode(true);
                                  clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                                  return (clone.innerText || "")
                                      .replace(/\u200B/g, '')      // zero-width space
                                      .replace(/\s+/g, ' ')        // normalize whitespace
                                      .trim();
                              }, node);
  
                              if (text) messages.push(text);
                          }
  
                          return messages;
                      }
  
                      while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                          attempts++;
                          console.log(`Attempt ${attempts}: Checking valid receipt response in recent bot messages...`);
  
                          await page.waitForTimeout(3000);
  
                          try {
                              const recentMessages = await getLastBotMessages(2);
  
                              if (recentMessages.length === 0) {
                                  console.log("❌ No bot messages found yet.");
                                  continue;
                              }
  
                              for (const recentMessage of recentMessages) {
                                  console.log(`📩 Checking bot message: "${recentMessage.substring(0, 100)}..."`);
                                  const lowerText = recentMessage.toLowerCase();
  
                                  // Check for REJECTION (CRITICAL FAILURE)
                                  const isRejectionMessage = Array.isArray(rejectionPatterns)
                                      ? rejectionPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                                      : lowerText.includes(rejectionPatterns.toLowerCase());
  
                                  if (isRejectionMessage) {
                                      console.log("❌❌❌ CRITICAL FAILURE: System REJECTED valid receipt! ❌❌❌");
                                      console.log(`📝 Rejection message: ${recentMessage}`);
                                      console.log("🛑 This is a critical system error - STOPPING ALL TESTS");
                                      console.log("🚪 Closing browser and terminating test suite...");
  
                                      rejectionFound = true;
                                      receiptValidationResults.validReceiptRejected = true;
                                      receiptValidationResults.passed = false;
                                      receiptValidationResults.criticalFailure = true;
                                      receiptValidationResults.failures.push("CRITICAL: System INCORRECTLY REJECTED valid receipt");
  
                                      await page.screenshot({
                                          path: 'screenshots/CRITICAL-FAILURE-valid-receipt-rejected.png',
                                          fullPage: true
                                      });
  
                                      // Close the browser immediately
                                      await page.close();
                                      await page.context().close();
  
                                      throw new Error("🛑 CRITICAL FAILURE: Valid receipt was rejected - Test suite terminated");
                                  }
  
                                  // Check for ACCEPTANCE (CORRECT)
                                  const isAcceptanceMessage = Array.isArray(acceptancePatterns)
                                      ? acceptancePatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                                      : lowerText.includes(acceptancePatterns.toLowerCase());
  
                                  if (isAcceptanceMessage) {
                                      console.log("✅ Valid receipt CORRECTLY accepted!");
                                      console.log(`📝 Acceptance message: ${recentMessage}`);
                                      acceptanceFound = true;
  
                                      await page.screenshot({
                                          path: 'screenshots/valid-receipt-correctly-accepted.png',
                                          fullPage: true
                                      });
  
                                      break; // stop checking messages
                                  }
                              }
  
                          } catch (innerError) {
                              console.log(`⚠️ Error during message check: ${innerError.message}`);
                          }
  
                          if (rejectionFound || acceptanceFound) break;
  
                          console.log(`⏳ Waiting for response... (${attempts}/${maxAttempts})`);
                          await page.waitForTimeout(3000);
                      }
  
                      if (rejectionFound) {
                          return;
  
                      } else if (acceptanceFound) {
                          console.log("✅ Valid receipt validation PASSED");
                          console.log("➡️ Will continue to next steps");
  
                      } else {
                          console.log("⚠️ No clear acceptance or rejection found for valid receipt");
                          receiptValidationResults.passed = false;
                          receiptValidationResults.failures.push("No clear response detected for valid receipt");
                      }
  
                      await page.screenshot({
                          path: 'screenshots/valid-receipt-upload-complete.png',
                          fullPage: true
                      });
  
                  } catch (error) {
                      console.error("❌ Valid receipt upload failed:", error.message);
  
                      try {
                          await page.screenshot({
                              path: 'screenshots/valid-receipt-upload-failed.png',
                              fullPage: true
                          });
                      } catch (screenshotError) {
                          console.log("⚠️ Could not take screenshot (browser may be closed)");
                      }
  
                      receiptValidationResults.validReceiptRejected = true;
                      receiptValidationResults.passed = false;
                      receiptValidationResults.criticalFailure = true;
  
                      throw error;
                  }
              });
  
              // Step 7: Detect success validation message
              await test.step('Wait for validation success message', async () => {
                  if
                      (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
                      return;
                  }
  
                  console.log("============= Waiting for validation success message =============");
  
                  let successFound = false;
                  let attempts = 0;
                  const maxAttempts = 10;
  
                  // Helper to get last N bot messages and normalize text (WA update safe)
                  async function getLastBotMessages(limit = 2) {
                      const nodes = await page.$$(
                          'div.copyable-text span[data-testid="selectable-text"]'
                      );
  
                      if (!nodes || nodes.length === 0) return [];
  
                      const recentNodes = nodes.slice(-limit);
                      const messages = [];
  
                      for (const node of recentNodes) {
                          const text = await page.evaluate(el => {
                              const clone = el.cloneNode(true);
                              clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                              return (clone.innerText || "")
                                  .replace(/\u200B/g, '')      // zero-width space
                                  .replace(/\s+/g, ' ')        // normalize whitespace
                                  .trim();
                          }, node);
  
                          if (text) messages.push(text);
                      }
  
                      return messages;
                  }
  
                  while (!successFound && attempts < maxAttempts) {
                      attempts++;
                      console.log(`Attempt ${attempts}: Looking for success validation message...`);
  
                      await page.waitForTimeout(3000);
  
                      try {
                          const recentMessages = await getLastBotMessages(2);
  
                          if (recentMessages.length === 0) {
                              console.log("❌ No bot messages found yet.");
                              continue;
                          }
  
                          for (const msg of recentMessages) {
                              console.log(`📩 Checking bot message: "${msg.substring(0, 100)}..."`);
                              const lowerText = msg.toLowerCase();
  
                              const isSuccessMessage = Array.isArray(CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted)
                                  ? CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted
                                      .some(pattern => lowerText.includes(pattern.toLowerCase()))
                                  : lowerText.includes(CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted.toLowerCase());
  
                              if (isSuccessMessage) {
                                  console.log("✅ Found validation success message!");
                                  console.log(`📝 Full message: ${msg}`);
                                  successFound = true;
  
                                  await page.screenshot({
                                      path: 'screenshots/validation-success-detected.png',
                                      fullPage: true
                                  });
  
                                  break;
                              }
                          }
  
                      } catch (error) {
                          console.log(`⚠️ Error during success message check: ${error.message}`);
                      }
  
                      if (successFound) break;
  
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
              console.log("🔄 Looking for 'Submit New Receipt' button after success message...");
              await page.waitForTimeout(3000);
  
              if (receiptValidationResults.blurryReceiptAccepted ||
                  receiptValidationResults.validReceiptRejected ||
                  receiptValidationResults.secondBlurryReceiptAccepted) {
                  console.log("⚠️ Skipping - test already failed");
                  return;
              }
  
              try {
                  // Wait a bit longer for button to be fully ready
                  await page.waitForTimeout(2000);
  
                  // Find all buttons with "Submit New Receipt" text
                  const buttons = await page.$$('div[role="button"]');
                  console.log(`📊 Found ${buttons.length} total buttons on page`);
  
                  let targetButton = null;
  
                  for (const button of buttons) {
                      const text = await button.textContent();
                      if (text && text.includes('Submit New Receipt')) {
                          console.log(`✅ Found "Submit New Receipt" button!`);
                          console.log(`   Full text: "${text}"`);
                          targetButton = button;
                          break;
                      }
                  }
  
                  if (!targetButton) {
                      throw new Error('Submit New Receipt button not found');
                  }
  
                  // Scroll button into view
                  console.log("📜 Scrolling button into view...");
                  await targetButton.scrollIntoViewIfNeeded();
                  await page.waitForTimeout(1000);
  
                  // Try multiple click methods
                  console.log("🖱️ Attempting to click button...");
  
                  let clicked = false;
  
                  // Method 1: Regular click
                  try {
                      await targetButton.click({ timeout: 5000 });
                      console.log("✅ Clicked with regular click()");
                      clicked = true;
                  } catch (e1) {
                      console.log("⚠️ Regular click failed, trying force click...");
  
                      // Method 2: Force click
                       try {
                           await targetButton.click({ force: true, timeout: 5000 });
                           console.log("✅ Clicked with force: true");
                           clicked = true;
                       } catch (e2) {
                           console.log("⚠️ Force click failed, trying JavaScript click...");
   
                           // Method 3: JavaScript click
                           try {
                               await targetButton.evaluate(el => el.click());
                               console.log("✅ Clicked with JavaScript evaluate");
                               clicked = true;
                           } catch (e3) {
                               console.log("⚠️ JavaScript click failed, trying dispatch event...");
   
                               // Method 4: Dispatch click event
                               try {
                                   await targetButton.evaluate(el => {
                                       el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                   });
                                   console.log("✅ Clicked with dispatchEvent");
                                   clicked = true;
                               } catch (e4) {
                                   throw new Error(`All click methods failed. Last error: ${e4.message}`);
                               }
                           }
                       }
                  }
  
                  if (clicked) {
                      console.log("✅ Submit New Receipt button clicked successfully!");
                      await page.waitForTimeout(5000);
                  } else {
                      throw new Error("Failed to click button with all methods");
                  }
  
              } catch (error) {
                  console.error(`❌ Failed to click Submit New Receipt button: ${error.message}`);
                  await page.screenshot({ path: 'screenshots/submit-new-receipt-button-not-found.png', fullPage: true });
                  receiptValidationResults.passed = false;
                  receiptValidationResults.failures.push(`Failed to click Submit New Receipt button: ${error.message}`);
              }
  
  
              // Step 9: Wait for instruction message again (REUSING Step 5 logic)
              await test.step('Capture instruction message after Submit New Receipt', async () => {
                  if
                      (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
                      return;
                  }
  
                  console.log("============= Waiting for instruction message after Submit New Receipt =============");
  
                  await page.waitForTimeout(8000);
  
                  let instructionFound = false;
                  let fullMessageCaptured = false;
                  let attempts = 0;
                  const maxAttempts = 10;
  
                  // ✅ Use config patterns for detection
                  const receiptUploadPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;
  
                  while ((!instructionFound || !fullMessageCaptured) && attempts < maxAttempts) {
                      attempts++;
                      console.log(`Attempt ${attempts}: Looking for COMPLETE NEW instruction message...`);
  
                      try {
                          const allSpans = await page.$$('span._ao3e.selectable-text.copyable-text, span.x1lliihq, span.selectable-text');
                          console.log(`Found ${allSpans.length} text elements to check`);
  
                          for (let span of allSpans) {
                              const text = await span.textContent();
  
                              if (text) {
                                  const lowerText = text.toLowerCase();
                                  const matchedPatterns = receiptUploadPatterns.filter(pattern =>
                                      lowerText.includes(pattern.toLowerCase())
                                  );
  
                                  if (matchedPatterns.length > 0) {
                                      console.log(`🔍 Found possible receipt upload instruction! Matched: ${JSON.stringify(matchedPatterns)}`);
                                      const messageLength = text.length;
                                      console.log(`📏 Message length: ${messageLength} characters`);
  
                                      if (messageLength > 100) {
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
                                          console.log("⚠️ Message found but seems incomplete (too short)");
                                      }
                                  }
                              }
                          }
  
                      } catch (error) {
                          console.log(`⚠️ Error during instruction check: ${error.message}`);
                      }
  
                      if (instructionFound && fullMessageCaptured) {
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
  
  
              // STEP 10: Upload second blank receipt
              // ===========================================
              await test.step('Upload second blank receipt after successful validation', async () => {
                  if (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
                      return;
                  }
  
                  console.log("📸 Uploading second blank/blurry receipt...");
  
                  try {
                      await uploadReceipt(page, blankReceiptPath);
                      console.log("⏳ Waiting for system response...");
                      await page.waitForTimeout(15000);
  
                      let rejectionFound = false;
                      let acceptanceFound = false;
                      let attempts = 0;
                      const maxAttempts = 10;
  
                      const rejectionPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptRejection;
                      const acceptancePatterns = CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted;
  
                      // Helper to get last N bot messages and normalize text                                   //####
                      async function getLastBotMessages(limit = 2) {
                          const nodes = await page.$$(
                              'div.copyable-text span[data-testid="selectable-text"]'
                          );
  
                          if (!nodes || nodes.length === 0) return [];
  
                          const recentNodes = nodes.slice(-limit);
                          const messages = [];
  
                          for (const node of recentNodes) {
                              const text = await page.evaluate(el => {
                                  const clone = el.cloneNode(true);
                                  clone.querySelectorAll('img').forEach(img => img.remove()); // remove emoji
                                  return (clone.innerText || "")
                                      .replace(/\u200B/g, '')      // zero-width space
                                      .replace(/\s+/g, ' ')        // normalize whitespace
                                      .trim();
                              }, node);
  
                              if (text) messages.push(text);
                          }
  
                          return messages;
                      }
  
                      while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                          attempts++;
                          console.log(`Attempt ${attempts}: Checking recent bot messages...`);
  
                          await page.waitForTimeout(3000);
  
                          try {
                              const recentMessages = await getLastBotMessages(2);
  
                              if (recentMessages.length === 0) {
                                  console.log("❌ No bot messages found yet.");
                                  continue;
                              }
  
                              for (const msg of recentMessages) {
                                  const normalizedText = msg.toLowerCase().trim();
  
                                  // Check for REJECTION (CORRECT behavior)
                                  const isRejectionMessage = Array.isArray(rejectionPatterns)
                                      ? rejectionPatterns.some(pattern => normalizedText.includes(pattern.toLowerCase()))
                                      : normalizedText.includes(rejectionPatterns.toLowerCase());
  
                                  if (isRejectionMessage) {
                                      console.log("✅ Found rejection message!");
                                      console.log(`📝 Full message: ${msg}`);
                                      rejectionFound = true;
                                      await page.screenshot({
                                          path: 'screenshots/blank-receipt-properly-rejected.png',
                                          fullPage: true
                                      });
                                      break;
                                  }
  
                                  // Check for ACCEPTANCE (CRITICAL FAILURE)
                                  const isAcceptanceMessage = Array.isArray(acceptancePatterns)
                                      ? acceptancePatterns.some(pattern => normalizedText.includes(pattern.toLowerCase()))
                                      : normalizedText.includes(acceptancePatterns.toLowerCase());
  
                                  if (isAcceptanceMessage) {
                                      console.log("❌ CRITICAL FAILURE: System ACCEPTED blank/blurry receipt!");
                                      console.log(`📝 Acceptance message: ${msg}`);
                                      acceptanceFound = true;
                                      receiptValidationResults.blurryReceiptAccepted = true;
                                      receiptValidationResults.passed = false;
                                      receiptValidationResults.failures.push("System INCORRECTLY ACCEPTED blank/blurry receipt");
  
                                      await page.screenshot({
                                          path: 'screenshots/FAILED-blank-receipt-incorrectly-accepted.png',
                                          fullPage: true
                                      });
                                      break;
                                  }
                              }
  
                          } catch (innerError) {
                              console.log(`⚠️ Error during message check: ${innerError.message}`);
                          }
  
                          if (rejectionFound || acceptanceFound) break;
  
                          console.log(`❌ Response not found. Waiting 3s... (${attempts}/${maxAttempts})`);
                          await page.waitForTimeout(3000);
                      }
  
                      if (rejectionFound) {
                          console.log("✅ System CORRECTLY REJECTED second blank receipt!");
                      } else if (acceptanceFound) {
                          console.log("❌ Second blank receipt validation FAILED!");
                          console.log("🛑 STOPPING receipt validation tests...");
                      } else {
                          const noResponseMessage = "⚠️ No rejection message found for second blank receipt";
                          console.log(noResponseMessage);
                          receiptValidationResults.passed = false;
                          receiptValidationResults.failures.push(noResponseMessage);
                      }
  
                  } catch (error) {
                      console.log(`⚠️ Second blank receipt upload test failed: ${error.message}`);
                      receiptValidationResults.passed = false;
                      receiptValidationResults.failures.push(`Second blank receipt test error: ${error.message}`);
                  }
              });
  
  
  
  
              // Step 11: Click Proceed button
              await test.step('Click Proceed button', async () => {
                  if
                      (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
                      console.log("⚠️ Skipping - test already failed");
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
  
                          if (text && text.trim() === 'Proceed') {                            //####
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
  
                  // UPDATE THIS SECTION - More detailed critical issue reporting
                  if (receiptValidationResults.blurryReceiptAccepted ||
                      receiptValidationResults.validReceiptRejected ||
                      receiptValidationResults.secondBlurryReceiptAccepted) {
  
                      console.log("\n📋 CRITICAL ISSUES DETECTED:");
  
                      if (receiptValidationResults.blurryReceiptAccepted) {
                          console.log("  ❌ First blank/blurry receipt was INCORRECTLY ACCEPTED");
                      }
                      if (receiptValidationResults.validReceiptRejected) {
                          console.log("  ❌ Valid receipt was INCORRECTLY REJECTED");
                      }
                      if (receiptValidationResults.secondBlurryReceiptAccepted) {
                          console.log("  ❌ Second blank/blurry receipt was INCORRECTLY ACCEPTED");
                      }
  
                      console.log("🛑 Remaining receipt validation steps were skipped");
                  }
  
                  console.log("\n❌ RECEIPT VALIDATION TEST FAILED");
                  console.log("🌐 Browser remains open for subsequent tests");
                  console.log("⏭️ Moving to next test: Chat with Agent...");
                  console.log("====================================================\n");
  
                  // UPDATE THIS - More detailed reporting
                  test.info().attachments.push({
                      name: 'receipt-validation-failure-details',
                      contentType: 'text/plain',
                      body: Buffer.from(
                          `Receipt Validation Failures:\n${receiptValidationResults.failures.join('\n')}\n\n` +
                          `First blurry receipt incorrectly accepted: ${receiptValidationResults.blurryReceiptAccepted}\n` +
                          `Valid receipt incorrectly rejected: ${receiptValidationResults.validReceiptRejected}\n` +
                          `Second blurry receipt incorrectly accepted: ${receiptValidationResults.secondBlurryReceiptAccepted}\n` +
                          `Test skipped remaining steps: ${receiptValidationResults.blurryReceiptAccepted || receiptValidationResults.validReceiptRejected || receiptValidationResults.secondBlurryReceiptAccepted}`
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
  
  
  
      /* // Test 5: Chat with Agent functionality
       test('Chat with Agent functionality', async () => {
           test.setTimeout(300000); // 5 minutes
   
           // ✅ 
           if (receiptValidationResults.criticalFailure || receiptValidationResults.validReceiptRejected) {
               console.log("🛑 SKIPPING Chat with Agent test - Previous test had critical failure");
               console.log("❌ Valid receipt was rejected - cannot proceed to Chat with Agent");
               test.skip();
               return;
           }
   
           // Test configuration
           const TEST_CONFIG = {
               agentMessage: "Hi...How to do this...",
               expectedResponse: "Hi there! Got a question? Just type in your enquiry below — our Agent will get back to you soon. We're here to help!",
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
   });*/


    // Test 5: Chat with Agent functionality
    test('Chat with Agent functionality', async () => {
        test.setTimeout(300000); // 5 minutes

        // ✅ 
        /* if (receiptValidationResults.criticalFailure || receiptValidationResults.validReceiptRejected) {
             console.log("🛑 SKIPPING Chat with Agent test - Previous test had critical failure");
             console.log("❌ Valid receipt was rejected - cannot proceed to Chat with Agent");
             test.skip();
             return;
         }
 
         // Test configuration
         const TEST_CONFIG = {
             agentMessage: "Hi...How to do this...",
             expectedResponse: "Thank you for your submission! We’ve received your details and will now verify your receipt.",
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
     });*/



        // ---------------------------------------------------
        // 🆕 Step 2: While keeping current browser open, open operator portal in NEW browser
        // ---------------------------------------------------
        await test.step('Open & Login Operator Portal', async () => {
            console.log("🌐 Opening Operator Portal...");

            const operatorBrowser = await chromium.launch({ headless: false });
            const operatorContext = await operatorBrowser.newContext();
            const operatorPage = await operatorContext.newPage();

            try {
                // Login
                await operatorPage.goto("https://op-sb.d-rive.net", { waitUntil: 'load' });
                await operatorPage.getByRole('textbox', { name: '* Email' }).fill('kuhenraj@thedgroup.com.my');
                await operatorPage.getByRole('textbox', { name: '* Password' }).fill('123123');
                await operatorPage.getByRole('button', { name: 'Login' }).click();
                console.log("✅ Logged in");

                // Select company from config
                const companyDropdown = operatorPage.locator('.ant-select').first();
                await companyDropdown.locator('.ant-select-selector').click();

                await operatorPage.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', {
                    state: 'visible',
                    timeout: 5000
                });

                const companyOption = operatorPage.locator(`.ant-select-item-option:has-text("${CAMPAIGN_CONFIG.operatorPortal.company}")`);

                if (await companyOption.isVisible().catch(() => false)) {
                    await companyOption.click();
                } else {
                    await operatorPage.locator('#rc_select_0').fill(CAMPAIGN_CONFIG.operatorPortal.company);
                    await operatorPage.waitForTimeout(300);
                    await companyOption.click();
                }

                console.log(`🎉 ${CAMPAIGN_CONFIG.operatorPortal.company} selected!`);

            } catch (error) {
                console.error("❌ Operator portal error:", error.message);
                await operatorPage.screenshot({ path: 'error-operator-portal.png', fullPage: true });
                throw error;
            }

            await test.step('Navigate to Receipt Validation', async () => {
                try {
                    console.log("📋 Finding campaign...");

                    // Find and click campaign by name
                    await operatorPage.getByRole('heading', { name: CAMPAIGN_CONFIG.campaignName }).click();
                    console.log(`✅ Clicked campaign: ${CAMPAIGN_CONFIG.campaignName}`);

                    // Click Receipt Validation button
                    await operatorPage.getByRole('button', { name: 'Receipt Validation' }).first().click();
                    await operatorPage.waitForLoadState('networkidle');
                    console.log("✅ Opened Receipt Validation");

                    // Select today's date
                    console.log("📅 Setting date filter...");
                    await operatorPage.getByRole('textbox', { name: 'Start date' }).click();

                    const today = new Date();
                    const dateTitle = `-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                    await operatorPage.getByTitle(dateTitle).locator('div').click();
                    await operatorPage.getByRole('button', { name: 'Filter' }).click();
                    await operatorPage.waitForLoadState('networkidle');
                    console.log(`✅ Filtered by date: ${dateTitle}`);

                    // 🔧 FIX: Find the row containing the user's name, then click edit in THAT row
                    const userName = 'kuhen test';
                    const userRow = operatorPage.getByRole('row', { name: new RegExp(userName, 'i') });

                    // Click the edit button within that specific row
                    await userRow.getByRole('img', { name: 'edit' }).click();
                    console.log(`✅ Clicked edit for user: ${userName}`);

                } catch (error) {
                    console.error("❌ Receipt validation navigation error:", error.message);
                    await operatorPage.screenshot({ path: 'error-receipt-validation.png', fullPage: true });
                    throw error;
                }
            });

            await test.step('Reject Receipt Submission', async () => {
                try {
                    console.log("❌ Rejecting receipt...");

                    // Scroll to rejection section (optional but helpful)
                    await operatorPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await operatorPage.waitForTimeout(500);

                    // Click the reasons dropdown
                    await operatorPage.getByRole('combobox', { name: 'Reasons  question-circle' }).click();
                    console.log("✅ Opened rejection reasons dropdown");

                    // Select rejection reason
                    await operatorPage.getByTitle('Receipt Photo Issue - The receipt photo is too blurry to be read clearly.').locator('div').click();
                    console.log("✅ Selected rejection reason: Receipt photo too blurry");

                    // Click Reject button
                    await operatorPage.getByRole('button', { name: 'stop Reject' }).click();
                    console.log("✅ Clicked Reject button");

                    // Confirm rejection
                    await operatorPage.getByRole('button', { name: 'Yes' }).click();
                    console.log("🎉 Receipt rejected successfully!");

                    // Wait for rejection to process
                    await operatorPage.waitForLoadState('networkidle');

                } catch (error) {
                    console.error("❌ Rejection error:", error.message);
                    await operatorPage.screenshot({ path: 'error-rejection.png', fullPage: true });
                    throw error;
                }
            });

        });

        /*} catch (error) {
            console.error(`❌ Error in agent message workflow: ${error.message}`);
            await page.screenshot({
                path: `test-results/agent-workflow-error-${Date.now()}.png`,
                fullPage: true
            });
            throw error;
        }*/

        // Keep BOTH browsers open for inspection in non-CI environments
        if (!process.env.CI) {
            console.log("🧪 Both browsers will remain open for inspection...");
            await page.waitForTimeout(300000); // 5 minutes
        }
    });
});






