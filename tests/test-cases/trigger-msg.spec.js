//=================================== Test 2 Send trigger message ===========================================================================

const { sendMessage, sendMessageToBox, uploadReceipt, chatWithAgent, getMostRecentBotMessage, CONFIG } = require('../helpers/WA_helpers');


// Test 2: Send trigger message, detect campaign name, and handle proceed button

async function testTriggerMessage(page, CAMPAIGN_CONFIG) {
    console.log("============ TEST 2 - Send trigger message =============");
    
    try {
        // Send trigger message
        console.log(`📤 Using trigger message: "${CAMPAIGN_CONFIG.triggerMessage}"`);
        await sendMessage(page, CAMPAIGN_CONFIG.triggerMessage, "Trigger message");
        await page.waitForTimeout(CAMPAIGN_CONFIG.timeouts.messageWait);
        await page.screenshot({ path: 'screenshots/after-trigger-message.png', fullPage: true });

        // Look for exact campaign name
        console.log(`🔍 Looking for campaign: "${CAMPAIGN_CONFIG.exactCampaignName}"`);

        const maxWaitTime = 30000; // 30 seconds max waiting time
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

        // Click Proceed button (only if campaign name was found)
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

        // Verify name request message appears
        console.log("🔍 Looking for name request message...");

        try {
            // Wait for the response after clicking proceed
            await page.waitForTimeout(5000);

            // Get page content
            const pageContent = await page.textContent('body');

            // Get the expected instruction from config
            const expectedInstruction = CAMPAIGN_CONFIG.expectedInstructions.nameRequest;

            let instructionFound = false;

            // Check if the instruction exists in the page content (case-insensitive)
            if (pageContent) {
                const lowerPageContent = pageContent.toLowerCase();

                if (Array.isArray(expectedInstruction)) {
                    // Check if ALL parts of the instruction exist
                    instructionFound = expectedInstruction.every(instr =>
                        lowerPageContent.includes(instr.toLowerCase())
                    );
                } else {
                    // Single string fallback
                    instructionFound = lowerPageContent.includes(expectedInstruction.toLowerCase());
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

            // Log actual content for debugging
            const actualContent = await page.textContent('body').catch(() => 'Could not get page content');
            console.log("📝 Actual page content preview:", actualContent?.substring(0, 500) + "...");
            console.log(`🎯 Expected instruction: "${CAMPAIGN_CONFIG.expectedInstructions.nameRequest}"`);

            // Close browser and fail the test
            console.log("🚫 Closing browser due to name request message not found");
            await page.close();
            throw new Error(`Test failed: Expected instruction not detected. Expected: "${CAMPAIGN_CONFIG.expectedInstructions.nameRequest}"`);
        }

        console.log("🎉 Trigger message workflow completed successfully!");

    } catch (error) {
        console.error(`❌ Error in trigger message workflow: ${error.message}`);
        await page.screenshot({
            path: `test-results/trigger-error-${Date.now()}.png`,
            fullPage: true
        });

        throw error;
    }
}

module.exports = { testTriggerMessage };