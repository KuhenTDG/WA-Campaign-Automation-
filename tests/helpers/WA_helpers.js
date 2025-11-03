// helpers/whatsapp-helpers-new.js

// Configuration
const CONFIG = {
  contactName: "Whatsapp Automation",
  contactNumber: "+60 11-2635 2582",
  timeouts: {
    messageDelay: 8000,
    loginTimeout: 120000
  }
};

// Send message function
async function sendMessage(page, message, messageType = "message") {
  console.log(`💬 Sending ${messageType}: ${message}`);

  const messageBox = page.locator('div[contenteditable="true"][data-tab="10"]');
  await messageBox.waitFor({ state: 'visible', timeout: 10000 });
  await messageBox.click();
  await messageBox.fill(''); // Clear existing text
  await messageBox.type(message, { delay: 100 });
  await messageBox.press('Enter');

  console.log(`✅ ${messageType} sent successfully!`);
  await page.screenshot({ path: `screenshots/${messageType.toLowerCase().replace(' ', '-')}-sent.png`, fullPage: true });
};


// Send message to box function (for name validation)
async function sendMessageToBox(page, message) {
  const nameMessageBox = page.locator('div[contenteditable="true"][data-tab="10"]');
  await nameMessageBox.waitFor({ state: 'visible', timeout: 15000 });
  await nameMessageBox.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await nameMessageBox.type(message, { delay: 150 });
  await nameMessageBox.press('Enter');
}

// Receipt upload function
// TODO: MAJOR REFACTOR NEEDED - This function has several critical issues:
// 1. Brittle XPath selectors that will break easily
// 2. Manual intervention fallback that defeats automation purpose
// 3. Missing modal state validation
// 4. Poor error handling and recovery
// 5. No retry mechanisms for flaky UI interactions
async function uploadReceipt(page, receiptPath) {
  console.log("📸 Uploading receipt image...");

  try {
    // TODO: IMPROVEMENT - Add retry logic for attach button click
    // Click the Attach button
    await page.getByRole('button', { name: /attach/i }).click();
    await page.waitForTimeout(1000);

    // TODO: IMPROVEMENT - Add fallback selectors for file input
    // Find the file input
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (!fileInput) {
      throw new Error("File input not found!");
    }

    // Upload the file
    const path = require('path');
    const absolutePath = path.resolve(__dirname, '..', receiptPath);
    await fileInput.setInputFiles(absolutePath);

    // TODO: CRITICAL - Replace this brittle XPath selector!
    // ISSUE: This XPath is extremely fragile and will break when WhatsApp updates their DOM
    // RECOMMENDED: Use multiple fallback selectors like '[role="dialog"]', '[data-testid="media-viewer"]'
    // Wait for image preview dialog to appear
    await page.waitForSelector('xpath=//*[@id="app"]/div[1]/div/div[3]/div/div[2]/div[2]/div/span/div/div/div/div[2]/div/div[2]/div[2]/div/div', { timeout: 30000 });

    // TODO: CRITICAL - Add retry logic and better selector fallbacks
    // ISSUE: Single selector approach is fragile
    // Wait for the send button to be enabled
    const sendButton = page.locator('div[role="button"][aria-label="Send"]:not([aria-disabled="true"])');
    await sendButton.waitFor({ state: 'visible', timeout: 60000 });


    // Click Send button
    try {
      await sendButton.click({ force: true });
      console.log("📸 Receipt image sent automatically success!");
    } catch (autoClickErr) {
      // TODO: URGENT - REMOVE MANUAL INTERVENTION!
      // ISSUE: This breaks automation and makes tests unreliable
      // REQUIRED: Implement proper retry logic with multiple selectors instead
      // ===== TEMPORARY MANUAL STEP - MUST BE REMOVED =====
      console.log("⚠️ Automatic send button click failed. Please click the Send button manually in the browser.");
      // Wait up to 30 seconds for you to click manually
      await page.waitForTimeout(30000);
      // ===== REMOVE THIS BLOCK WHEN AUTO CLICK WORKS =====
    }

    return true;
  } catch (error) {
    // TODO: CRITICAL - Improve error handling with modal-specific context
    // MISSING: Screenshot capture for modal-related errors
    // MISSING: Specific error types for different failure modes
    // MISSING: Modal state cleanup on errors
    console.error("❌ Receipt upload failed:", error.message);
    throw error;
  }
}

// Chat with agent function - CLEANED VERSION
async function chatWithAgent(page, agentMessage, expectedResponse) {
  console.log("🤖 Starting Chat with Agent workflow...");

  try {
    // STEP 1: Initial wait to let the message load after Proceed button
    console.log("⏳ Waiting 20 seconds for confirmation message to load...");
    await page.waitForTimeout(20000);
    console.log("✅ Starting message detection...");

    // STEP 2: Check for the submission confirmation message
    let messageFound = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!messageFound && attempts < maxAttempts) {
      attempts++;

      try {
        const messageBubbles = await page.$$('div._akbu, div.copyable-text');

        for (let bubble of messageBubbles) {
          const fullText = await bubble.evaluate(el => {
            return el.innerText || el.textContent;
          });

          // Check for key phrases
          const hasThankYou = fullText.includes("Thank you for your submission");
          const hasValidation = fullText.includes("proceed with validation");
          const hasGrabVoucher = fullText.includes("received your details");

          if (hasThankYou && hasValidation && hasGrabVoucher) {
            console.log("✅ Submission message detected!");
            messageFound = true;
            await page.screenshot({
              path: 'screenshots/submission-message-found.png',
              fullPage: true
            });
            break;
          }
        }
      } catch (error) {
        console.log(`⚠️ Error during message check: ${error.message}`);
      }

      if (!messageFound) {
        console.log(`Attempt ${attempts}/${maxAttempts}: Message not found, waiting...`);
        await page.waitForTimeout(3000);
      }
    }

    if (!messageFound) {
      console.error("❌ Submission message did not appear!");
      await page.screenshot({
        path: 'screenshots/submission-message-not-found.png',
        fullPage: true
      });
      throw new Error("Submission confirmation message not found");
    }

    console.log("✅ Message confirmed - proceeding to click Chat with Agent button");
    await page.waitForTimeout(2000);

    // STEP 3: Find and click the Chat with Agent button
    let buttons = await page.$$('div._ahef[role="button"]:has-text("Chat with Agent")');

    if (buttons.length === 0) {
      buttons = await page.$$('div[role="button"]:has-text("Chat with Agent")');
    }

    if (buttons.length === 0) {
      console.error("❌ No Chat with Agent button found!");
      await page.screenshot({
        path: 'screenshots/chat-agent-button-not-found.png',
        fullPage: true
      });
      throw new Error("No Chat with Agent button found");
    }

    console.log(`📊 Found ${buttons.length} Chat with Agent button(s)`);
    
    // Click the most recent button
    const lastButton = buttons[buttons.length - 1];
    await lastButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await lastButton.click();

    console.log("✅ Chat with Agent button clicked!");
    await page.waitForTimeout(3000);

    // Send the agent message
    await sendMessage(page, agentMessage, "Agent enquiry");
    console.log("✅ Agent enquiry sent successfully!");

    await page.screenshot({
      path: 'screenshots/chat-agent-complete.png',
      fullPage: true
    });

    return true;

  } catch (error) {
    console.error("❌ Error with Chat with Agent:", error.message);
    await page.screenshot({ path: 'screenshots/chat-agent-error.png', fullPage: true });
    throw error;
  }
}


// Export only what we need
module.exports = {
  sendMessage,
  sendMessageToBox,
  uploadReceipt,
  chatWithAgent,
  CONFIG
};