/**
 * Verifies that a specific instruction message appears in recent bot messages
 * @param {Page} page - Playwright page object
 * @param {string|string[]} expectedInstruction - Expected instruction text or array of parts
 * @param {number} limit - Number of recent messages to check (default: 2)
 * @returns {Promise<{found: boolean, matchedMessage: string|null, allMessages: string[]}>}
 */

async function verifyNameInstructionMessage(page, expectedInstruction, limit = 2) {
    // Helper to get latest bot messages
    async function getLastBotMessages(limit) {
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

    const recentMessages = await getLastBotMessages(limit);
    let instructionFound = false;
    let matchedMessage = null;

    if (recentMessages.length === 0) {
        return { found: false, matchedMessage: null, allMessages: [] };
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
                matchedMessage = msg;
                break;
            }
        } else {
            // Single string check
            if (normalizedText.includes(expectedInstruction.toLowerCase())) {
                instructionFound = true;
                matchedMessage = msg;
                break;
            }
        }
    }

    return {
        found: instructionFound,
        matchedMessage: matchedMessage,
        allMessages: recentMessages
    };
}

/**
 * Verifies that an IC request instruction message appears in recent bot messages
 * Supports RegExp patterns for IC format validation
 * @param {Page} page - Playwright page object
 * @param {string|string[]|RegExp|Array<string|RegExp>} expectedInstruction - Expected instruction text, array of parts, or regex patterns
 * @param {number} limit - Number of recent messages to check (default: 3)
 * @returns {Promise<{found: boolean, matchedMessage: string|null, allMessages: string[]}>}
 */
async function verifyICInstructionMessage(page, expectedInstruction, limit = 3) {
    // Helper to get latest bot messages
    async function getLastBotMessages(limit) {
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

    const recentMessages = await getLastBotMessages(limit);
    let instructionFound = false;
    let matchedMessage = null;

    if (recentMessages.length === 0) {
        return { found: false, matchedMessage: null, allMessages: [] };
    }

    // Combine recent messages for checking (useful for multi-part instructions)
    const combinedText = recentMessages.join(' ').toLowerCase();

    for (const msg of recentMessages) {
        const normalizedText = msg.toLowerCase().trim();

        if (Array.isArray(expectedInstruction)) {
            // Check if ALL parts exist (can be string or RegExp)
            const allPartsFound = expectedInstruction.every(instr => {
                if (instr instanceof RegExp) {
                    return instr.test(combinedText);
                }
                return combinedText.includes(instr.toLowerCase());
            });

            if (allPartsFound) {
                instructionFound = true;
                matchedMessage = msg;
                break;
            }
        } else if (expectedInstruction instanceof RegExp) {
            // Single RegExp check
            if (expectedInstruction.test(normalizedText)) {
                instructionFound = true;
                matchedMessage = msg;
                break;
            }
        } else {
            // Single string check
            if (normalizedText.includes(expectedInstruction.toLowerCase())) {
                instructionFound = true;
                matchedMessage = msg;
                break;
            }
        }
    }

    return {
        found: instructionFound,
        matchedMessage: matchedMessage,
        allMessages: recentMessages
    };
}

/**
 * Verifies that a receipt upload instruction message appears in recent bot messages
 * Simple pattern matching without length requirements or stability checks
 * @param {Page} page - Playwright page object
 * @param {string|string[]} expectedPatterns - Expected instruction patterns from config
 * @param {number} maxAttempts - Maximum number of attempts (default: 10)
 * @param {number} waitBetweenAttempts - Wait time between attempts in ms (default: 3000)
 * @returns {Promise<{found: boolean, matchedText: string|null}>}
 */
async function verifyReceiptInstructionMessage(page, expectedPatterns, maxAttempts = 10, waitBetweenAttempts = 3000) {
    let instructionFound = false;
    let matchedText = null;
    let attempts = 0;

    while (!instructionFound && attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts}: Checking for instruction message...`);

        try {
            const selectableTexts = await page.$$('span[data-testid="selectable-text"]');

            for (let element of selectableTexts) {
                const text = await element.evaluate(el => el.textContent);

                if (text) {
                    const lowerText = text.toLowerCase();

                    // Check if ANY of the patterns exist (same logic as your working version)
                    const isReceiptInstruction = Array.isArray(expectedPatterns)
                        ? expectedPatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                        : lowerText.includes(expectedPatterns.toLowerCase());

                    if (isReceiptInstruction) {
                        console.log("✅ Found instruction using selectable-text span!");
                        console.log(`📝 Matched text: ${text.substring(0, 150)}...`);
                        instructionFound = true;
                        matchedText = text;
                        break;
                    }
                }
            }

            if (instructionFound) {
                break;
            }

            console.log(`❌ Instruction not found yet. Waiting ${waitBetweenAttempts / 1000} seconds... (${attempts}/${maxAttempts})`);
            await page.waitForTimeout(waitBetweenAttempts);

        } catch (error) {
            console.log(`⚠️ Error checking for instruction: ${error.message}`);
            await page.waitForTimeout(waitBetweenAttempts);
        }
    }

    return {
        found: instructionFound,
        matchedText: matchedText
    };
}


/**
 * Verifies receipt upload response (acceptance or rejection)
 * Checks recent bot messages for acceptance or rejection patterns
 * @param {Page} page - Playwright page object
 * @param {string|string[]} acceptancePatterns - Patterns indicating receipt acceptance
 * @param {string|string[]} rejectionPatterns - Patterns indicating receipt rejection
 * @param {number} maxAttempts - Maximum number of attempts (default: 10)
 * @param {number} waitBetweenAttempts - Wait time between attempts in ms (default: 3000)
 * @returns {Promise<{accepted: boolean, rejected: boolean, message: string|null}>}
 */
async function verifyReceiptUploadResponse(page, acceptancePatterns, rejectionPatterns, maxAttempts = 10, waitBetweenAttempts = 3000) {
    
    // Helper to get latest bot messages
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

    let rejectionFound = false;
    let acceptanceFound = false;
    let responseMessage = null;
    let attempts = 0;

    while (!rejectionFound && !acceptanceFound && attempts < maxAttempts) {
        attempts++;
        console.log(`Attempt ${attempts}: Checking valid receipt response in recent bot messages...`);

        await page.waitForTimeout(waitBetweenAttempts);

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
                    rejectionFound = true;
                    responseMessage = recentMessage;
                    break;
                }

                // Check for ACCEPTANCE (CORRECT)
                const isAcceptanceMessage = Array.isArray(acceptancePatterns)
                    ? acceptancePatterns.some(pattern => lowerText.includes(pattern.toLowerCase()))
                    : lowerText.includes(acceptancePatterns.toLowerCase());

                if (isAcceptanceMessage) {
                    console.log("✅ Valid receipt CORRECTLY accepted!");
                    console.log(`📝 Acceptance message: ${recentMessage}`);
                    acceptanceFound = true;
                    responseMessage = recentMessage;
                    break;
                }
            }

        } catch (innerError) {
            console.log(`⚠️ Error during message check: ${innerError.message}`);
        }

        if (rejectionFound || acceptanceFound) break;

        console.log(`⏳ Waiting for response... (${attempts}/${maxAttempts})`);
    }

    return {
        accepted: acceptanceFound,
        rejected: rejectionFound,
        message: responseMessage
    };
}

module.exports = {
    // ... your other existing helpers
    verifyNameInstructionMessage,
    verifyICInstructionMessage,
    verifyReceiptInstructionMessage,
    verifyReceiptUploadResponse
};