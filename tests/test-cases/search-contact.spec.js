
//=================================== Test 1 Search and Open Contact =========================================

async function testSearchContact(page, CAMPAIGN_CONFIG) {
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

    console.log("🎉 Contact search and open completed successfully!");
}



module.exports = { testSearchContact };