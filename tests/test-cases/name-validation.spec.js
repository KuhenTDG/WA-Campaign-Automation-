

//=================================== Test 3 Name Validation ===========================================================================

const { sendMessage, sendMessageToBox, uploadReceipt, chatWithAgent, getMostRecentBotMessage, CONFIG } = require('../helpers/WA_helpers');


// Test 3: Name validation with error sequence

async function testNameValidation(page, CAMPAIGN_CONFIG) {
    const userName = "Kuhen test";
    let validationResults = {
        passed: true,
        failures: [],
        invalidNamesAccepted: []
    };

    // FIRST: Verify name request message is present before starting validation
    console.log("========== TEST 3 Starting - Checking for name request message ===========");

    try {
        await page.waitForTimeout(5000);
        const pageContent = await page.textContent('body');

        // Get the expected instruction from config
        const expectedInstruction = CAMPAIGN_CONFIG.expectedInstructions.nameRequest;

        let instructionFound = false;

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

        // Log actual content for debugging
        const actualContent = await page.textContent('body').catch(() => 'Could not get page content');
        console.log("📝 Actual page content preview:", actualContent?.substring(0, 500) + "...");
        console.log(`🎯 Expected instruction parts: ${JSON.stringify(CAMPAIGN_CONFIG.expectedInstructions.nameRequest)}`);

        console.log("🚫 Closing browser - name request message not found at start of Test 3");
        await page.close();
        throw new Error("Test 3 failed: Name request message not detected - cannot proceed with validation");
    }

    // Send user name with error sequence and validation
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

                // ✅ NEW: GET LAST 2-3 MESSAGES AND COMBINE THEM
                const recentMessages = selectableTexts.slice(-3);
                let combinedText = '';

                for (let element of recentMessages) {
                    const text = await element.textContent();
                    if (text) {
                        combinedText += text.toLowerCase() + ' ';
                    }
                }

                // Check receipt upload patterns in combined text
                const receiptUploadPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;
                let isReceiptUploadMessage = false;

                if (Array.isArray(receiptUploadPatterns)) {
                    isReceiptUploadMessage = receiptUploadPatterns.every(pattern =>
                        combinedText.includes(pattern.toLowerCase())
                    );
                } else {
                    isReceiptUploadMessage = combinedText.includes(receiptUploadPatterns.toLowerCase());
                }

                // CRITICAL: Check if system ACCEPTED invalid name and moved to receipt upload
                if (isReceiptUploadMessage) {
                    console.log(`❌ CRITICAL: System ACCEPTED invalid name "${invalidName}" and proceeded to receipt upload!`);
                    console.log(`📝 Receipt upload message detected in combined text`);
                    console.log(`🎯 Matched patterns: ${JSON.stringify(receiptUploadPatterns)}`);
                    proceeded = true;
                    break;
                }

                // Check for REJECTION patterns in combined text
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
            console.log(`⏳ Waiting 5 seconds for system to complete error message sequence...`);
            // WAIT 8 seconds after rejection
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

        throw new Error(`Name validation failed: ${validationResults.failures.join('; ')}`);
    } else {
        console.log("\n========== NAME VALIDATION TEST RESULTS ==========");
        console.log("🎉 Name validation workflow completed successfully!");
        console.log("✅ All invalid names were properly rejected");
        console.log("✅ Valid name was properly accepted");
        console.log("====================================================\n");
    }
}

module.exports = { testNameValidation };