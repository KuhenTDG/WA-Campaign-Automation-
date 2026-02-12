//=================================== Test 4 Upload Receipt ===========================================================================

const { sendMessage, sendMessageToBox, uploadReceipt, chatWithAgent, getMostRecentBotMessage, CONFIG } = require('../helpers/WA_helpers');


// Test 4: Receipt upload with invalid input validation and blank/blurry validation
async function testReceiptValidation(page, CAMPAIGN_CONFIG) {

let receiptValidationResults = {
    passed: true,
    failures: [],
    blurryReceiptAccepted: false,
    validReceiptRejected: false,
    secondBlurryReceiptAccepted: false,
    criticalFailure: false
};
   

    const receiptPath = "./demo-receipt.jpg"; // Valid receipt
    const blankReceiptPath = "./blank-receipt.jpg"; // Blank/blurry receipt



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

        console.log("============= TEST 4 - Waiting for receipt instruction message =============");

        let instructionFoundStep1 = false;
        let attemptsStep1 = 0;
        const maxAttemptsStep1 = 10;

        // Reuse the SAME config from earlier
        const instructionPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;

        while (!instructionFoundStep1 && attemptsStep1 < maxAttemptsStep1) {
            attemptsStep1++;
            console.log(`Attempt ${attemptsStep1}: Checking for instruction message...`);

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
                            instructionFoundStep1 = true;
                            break;
                        }
                    }
                }

                if (instructionFoundStep1) {
                    console.log("✅ Receipt instruction message detected!");
                    await page.waitForTimeout(5000);
                    break;
                }

                console.log(`❌ Instruction not found yet. Waiting 3 seconds... (${attemptsStep1}/${maxAttemptsStep1})`);
                await page.waitForTimeout(3000);

            } catch (error) {
                console.log(`⚠️ Error checking for instruction: ${error.message}`);
                await page.waitForTimeout(3000);
            }
        }

        if (!instructionFoundStep1) {
            console.log("⚠️ Receipt instruction not found after maximum attempts, proceeding with tests...");
        }


        // Step 2: Invalid input validation tests

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



        // STEP 3: Upload blank receipt
        // ===========================================

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

            while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                attempts++;
                console.log(`Attempt ${attempts}: Checking MOST RECENT message...`);

                await page.waitForTimeout(3000);

                try {
                    // Get only the most recent bot message
                    const recentMessage = await getMostRecentBotMessage(page);

                    if (recentMessage) {
                        console.log(`📩 Most recent bot message: "${recentMessage.substring(0, 100)}..."`);
                        const lowerText = recentMessage.toLowerCase();

                        // Check for REJECTION (CORRECT behavior)
                        const isRejectionMessage = Array.isArray(rejectionPatterns)
                            ? rejectionPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                            : lowerText.includes(rejectionPatterns.toLowerCase());

                        if (isRejectionMessage) {
                            console.log("✅ Found rejection message in MOST RECENT bot message!");
                            console.log(`📝 Full message: ${recentMessage}`);
                            rejectionFound = true;
                            await page.screenshot({
                                path: 'screenshots/blank-receipt-properly-rejected.png',
                                fullPage: true
                            });
                            break;
                        }

                        // Check for ACCEPTANCE (CRITICAL FAILURE)
                        const isAcceptanceMessage = Array.isArray(acceptancePatterns)
                            ? acceptancePatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                            : lowerText.includes(acceptancePatterns.toLowerCase());

                        if (isAcceptanceMessage) {
                            console.log("❌ CRITICAL FAILURE: System ACCEPTED blank/blurry receipt!");
                            console.log(`📝 Acceptance message: ${recentMessage}`);
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

                console.log(`❌ Response not found in most recent message. Waiting 3s... (${attempts}/${maxAttempts})`);
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


        // Step 4: Click Resubmit button

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


        // Step 5: Wait for NEW instruction message

        if
            (receiptValidationResults.blurryReceiptAccepted ||
            receiptValidationResults.validReceiptRejected ||
            receiptValidationResults.secondBlurryReceiptAccepted) {
            console.log("⚠️ Skipping - test already failed");
            return;
        }

        console.log("============= Waiting for NEW detailed instruction message (STRICT MODE) =============");

        await page.waitForTimeout(10000);

        let instructionFoundStep5 = false;
        let fullMessageCapturedStep5 = false;
        let attemptsStep5 = 0;
        const maxAttemptsStep5 = 10;

        // ✅ Use config patterns for detection
        const receiptUploadPatternsStep5 = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;

        while ((!instructionFoundStep5 || !fullMessageCapturedStep5) && attemptsStep5 < maxAttemptsStep5) {
            attempts++;
            console.log(`Attempt ${attempts}: Looking for COMPLETE NEW instruction message...`);

            try {
                const allSpans = await page.$$('span._ao3e.selectable-text.copyable-text, span.x1lliihq, span.selectable-text');
                console.log(`Found ${allSpans.length} text elements to check`);

                for (let span of allSpans) {
                    const text = await span.textContent();

                    if (text) {
                        const lowerText = text.toLowerCase();
                        const matchedPatterns = receiptUploadPatternsStep5.filter(pattern =>
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



        // STEP 6: Upload valid receipt
        // ===========================================

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

            while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                attempts++;
                console.log(`Attempt ${attempts}: Checking valid receipt response in MOST RECENT message...`);

                await page.waitForTimeout(5000);
                try {
                    const recentMessage = await getMostRecentBotMessage(page);

                    if (recentMessage) {
                        console.log(`📩 Most recent bot message: "${recentMessage.substring(0, 100)}..."`);
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
                            receiptValidationResults.criticalFailure = true; // NEW FLAG
                            receiptValidationResults.failures.push("CRITICAL: System INCORRECTLY REJECTED valid receipt");

                            await page.screenshot({
                                path: 'screenshots/CRITICAL-FAILURE-valid-receipt-rejected.png',
                                fullPage: true
                            });

                            // Close the browser immediately
                            await page.close();
                            await page.context().close();

                            // Throw error to fail the test
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
                            break;
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
                // Already handled above - browser closed, error thrown
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

            // Only take screenshot if page is still open
            try {
                await page.screenshot({
                    path: 'screenshots/valid-receipt-upload-failed.png',
                    fullPage: true
                });
            } catch (screenshotError) {
                console.log("⚠️ Could not take screenshot (browser may be closed)");
            }

            // Mark as critical failure
            receiptValidationResults.validReceiptRejected = true;
            receiptValidationResults.passed = false;
            receiptValidationResults.criticalFailure = true;

            // Re-throw to stop test
            throw error;
        }



        // Step 7: Detect success validation message

        if
            (receiptValidationResults.blurryReceiptAccepted ||
            receiptValidationResults.validReceiptRejected ||
            receiptValidationResults.secondBlurryReceiptAccepted) {
            console.log("⚠️ Skipping - test already failed");
            return;
        }

        console.log("============= Waiting for validation success message =============");

        let successFound = false;
        let attemptsStep7 = 0;
        const maxAttemptsStep7 = 10;

        while (!successFound && attemptsStep7 < maxAttemptsStep7) {
            attempts++;
            console.log(`Attempt ${attempts}: Looking for success validation message...`);


            await page.waitForTimeout(15000);

            try {
                const selectableTexts = await page.$$('span._ao3e.selectable-text.copyable-text');
                console.log(`Found ${selectableTexts.length} selectable text elements`);



                for (let element of selectableTexts) {
                    const text = await element.textContent();

                    if (text && CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted.some(msg => text.includes(msg))) {
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



        // Step 8: Click Submit New Receipt button

        if
            (receiptValidationResults.blurryReceiptAccepted ||
            receiptValidationResults.validReceiptRejected ||
            receiptValidationResults.secondBlurryReceiptAccepted) {
            console.log("⚠️ Skipping - test already failed");
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


        // Step 9: Wait for instruction message again (REUSING Step 5 logic)

        if
            (receiptValidationResults.blurryReceiptAccepted ||
            receiptValidationResults.validReceiptRejected ||
            receiptValidationResults.secondBlurryReceiptAccepted) {
            console.log("⚠️ Skipping - test already failed");
            return;
        }

        console.log("============= Waiting for instruction message after Submit New Receipt =============");

        await page.waitForTimeout(8000);

        let instructionFoundStep9 = false;
        let fullMessageCaptured = false;
        let attemptsStep9 = 0;
        const maxAttemptsStep9 = 10;

        // ✅ Use config patterns for detection
        const receiptUploadPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptUploadRequest;

        while ((!instructionFoundStep9 || !fullMessageCaptured) && attemptsStep9 < maxAttemptsStep9) {
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



        // STEP 10: Upload second blank receipt
        // ===========================================

        if (receiptValidationResults.blurryReceiptAccepted ||
            receiptValidationResults.validReceiptRejected ||
            receiptValidationResults.secondBlurryReceiptAccepted) {
            console.log("⚠️ Skipping - test already failed");
            return;
        }

        console.log("📸 Uploading second blank/blurry receipt...");

        try {
            await uploadReceipt(page, blankReceiptPath);
            await page.waitForTimeout(15000);

            let rejectionFound = false;
            let acceptanceFound = false;
            let attempts = 0;
            const maxAttempts = 10;

            const rejectionPatterns = CAMPAIGN_CONFIG.expectedInstructions.receiptRejection;
            const acceptancePatterns = CAMPAIGN_CONFIG.expectedInstructions.submissionAccepted;

            while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
                attempts++;
                console.log(`Attempt ${attempts}: Checking for rejection/acceptance in MOST RECENT message...`);

                await page.waitForTimeout(3000);

                try {
                    const recentMessage = await getMostRecentBotMessage(page);

                    if (recentMessage) {
                        console.log(`📩 Most recent bot message: "${recentMessage.substring(0, 100)}..."`);
                        const lowerText = recentMessage.toLowerCase();

                        // Check for REJECTION (CORRECT behavior)
                        const matchedRejectionPatterns = rejectionPatterns.filter(pattern =>
                            lowerText.includes(pattern.toLowerCase())
                        );

                        if (matchedRejectionPatterns.length > 0) {
                            console.log(`✅ Second blank receipt CORRECTLY rejected! Matched: ${JSON.stringify(matchedRejectionPatterns)}`);
                            console.log(`📝 Full message: ${recentMessage}`);
                            rejectionFound = true;
                            await page.screenshot({
                                path: 'screenshots/second-blank-receipt-rejected.png',
                                fullPage: true
                            });
                            break;
                        }

                        // Check for ACCEPTANCE (CRITICAL FAILURE)
                        const matchedAcceptancePatterns = acceptancePatterns.filter(pattern =>
                            lowerText.includes(pattern.toLowerCase())
                        );

                        if (matchedAcceptancePatterns.length > 0) {
                            console.log(`❌ CRITICAL FAILURE: System ACCEPTED second blank receipt!`);
                            console.log(`📝 Acceptance message: ${recentMessage}`);
                            acceptanceFound = true;
                            receiptValidationResults.secondBlurryReceiptAccepted = true;
                            receiptValidationResults.passed = false;
                            receiptValidationResults.failures.push("System INCORRECTLY ACCEPTED second blank/blurry receipt");

                            await page.screenshot({
                                path: 'screenshots/FAILED-second-blank-receipt-incorrectly-accepted.png',
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



        // Step 11: Click Proceed button

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

        
        throw error;
    }
}

module.exports = { testReceiptValidation };