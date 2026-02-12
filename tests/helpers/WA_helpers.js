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


async function uploadReceipt(page, receiptPath) {
  console.log("📸 Manual receipt upload mode...");

  try {
    // MANUAL UPLOAD MODE
    console.log("⏸️ ========================================");
    console.log("⏸️ PAUSING FOR MANUAL RECEIPT UPLOAD");
    console.log("⏸️ ========================================");
    console.log(`📁 Please manually upload: ${receiptPath}`);
    console.log("⏸️ You have 40 seconds to:");
    console.log("   1. Click the attach (+) button");
    console.log("   2. Select 'Photos & Videos'");
    console.log("   3. Choose the receipt image");
    console.log("   4. Click Send");
    console.log("⏸️ ========================================");
    
    // Wait 30 seconds for manual upload
    for (let i = 40; i > 0; i--) {
      console.log(`⏳ Time remaining: ${i} seconds...`);
      await page.waitForTimeout(1000);
    }
    
    console.log("✅ Manual upload time completed!");
    console.log("🔄 Resuming automated detection...");
    
    // Give extra time for the message to process
    await page.waitForTimeout(3000);
    console.log("📸 Receipt upload step completed!");

    return true;

  } catch (error) {
    console.error("❌ Receipt upload failed:", error.message);
    
    await page.screenshot({
      path: 'screenshots/debug-upload-failure.png',
      fullPage: true
    });
    
    throw error;
  }
}



// Chat with agent function - CLEANED VERSION
async function chatWithAgent(page, agentMessage, expectedResponse) {
  console.log("🤖 Starting Chat with Agent workflow...");

  try {
    // STEP 1: Initial wait to let the message load after Proceed button
    console.log("⏳ Waiting for confirmation message to load...");
    await page.waitForTimeout(10000);
    console.log("✅ Starting message detection...");

    /*// STEP 2: Check for the submission confirmation message
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
          const hasValidation = fullText.includes("will now verify your receipt.");
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
    }*/



    // STEP 2: Detect submission confirmation message (NEW STABLE VERSION - WA UPDATE SAFE)
let messageFound = false;
let attempts = 0;
const maxAttempts = 12; // little longer, WA is slow

while (!messageFound && attempts < maxAttempts) {
  attempts++;

  try {
    // Collect recent bot messages (WA update safe - old + new containers)
    const messageElements = await page.$$(
      'div[data-pre-plain-text], div.message-in, span.selectable-text, span.copyable-text'
    );

    let combinedText = "";

    // Take more recent messages because WA loads dynamically
    for (let el of messageElements.slice(-10)) {
      const text = await el.textContent();
      if (text) combinedText += text + " ";
    }

    const lowerText = combinedText.toLowerCase();

    // 🔑 KEYWORD BASED DETECTION (robust & unchanged logic)
    const hasThankYou = lowerText.includes("thank you for your submission");
    const hasReceived = lowerText.includes("received your details");
    const hasValidate =
      lowerText.includes("proceed with validation") ||
      lowerText.includes("will proceed") ||
      lowerText.includes("verify your receipt");
    const hasVoucher = lowerText.includes("grab voucher");

    if (hasThankYou && hasReceived && hasValidate) {
      console.log("✅ Submission confirmation detected!");
      console.log("📝 Detected message text:", combinedText.trim());

      messageFound = true;

      await page.screenshot({
        path: 'screenshots/submission-message-found.png',
        fullPage: true
      });

      break;
    }

  } catch (error) {
    console.log(`⚠️ Error during message check: ${error.message}`);
  }

  if (!messageFound) {
    console.log(`Attempt ${attempts}/${maxAttempts}: Confirmation not found yet...`);
    await page.waitForTimeout(3000);
  }
}

if (!messageFound) {
  console.error("❌ Submission confirmation message did not appear!");
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

    //console.log(`📊 Found ${buttons.length} Chat with Agent button(s)`);
    console.log(`📊 Found ${buttons.length} Chat dengan Agen button(s)`);

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



//Get recent message of upload receipt

async function getMostRecentBotMessage(page) {
  try {
    // Get all message containers (adjust selector based on your WhatsApp structure)
    const messageContainers = await page.$$('div[data-id]');

    // Start from the end (most recent messages)
    for (let i = messageContainers.length - 1; i >= 0; i--) {
      const container = messageContainers[i];

      // Check if it's an incoming message (bot message, not user's own message)
      const isIncoming = await container.evaluate(el => {
        // Adjust this based on WhatsApp's structure - incoming messages usually have specific classes
        return el.querySelector('span[dir="ltr"]') !== null &&
          !el.classList.contains('message-out');
      });

      if (isIncoming) {
        const textElements = await container.$$('span._ao3e.selectable-text.copyable-text');
        if (textElements.length > 0) {
          const texts = await Promise.all(
            textElements.map(el => el.textContent())
          );
          return texts.join(' ').trim();
        }
      }
    }
    return null;
  } catch (error) {
    console.log(`Error getting recent message: ${error.message}`);
    return null;
  }
}


// Export only what we need
module.exports = {
  sendMessage,
  sendMessageToBox,
  uploadReceipt,
  chatWithAgent,
  getMostRecentBotMessage,
  CONFIG
};