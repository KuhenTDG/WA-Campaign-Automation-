

const CAMPAIGN_CONFIG = {
    // Contact details
    contactName: "+60 16-410 5382",   //+60 16-410 5382 (to test blurry receipt) || Whatsapp Automation
    
    // Campaign trigger Message 
    triggerMessage: "Hi, I want to join Haleon SG Oral Month Campaign.", //Hi, I want to join Haleon SG Oral Month Campaign.
    
    // Campaign identification
    exactCampaignName: "Haleon SG Oral Month Campaign!​",  // //Haleon SG Oral Month Campaign!
    
    
    // Timeout settings (optional - can be overridden per campaign)
    timeouts: {
        messageWait: 8000,      // Wait time after sending messages
        buttonClick: 5000,      // Wait time after clicking buttons
        receiptUpload: 15000    // Wait time after uploading receipt
    }


    
};

// Export the configuration
module.exports = CAMPAIGN_CONFIG;




// Optional: Add more campaign-specific settings here
    // expectedMessages: {
    //     nameRequest: "please reply with your name",
    //     receiptRequest: "please submit your receipt",
    //     phoneRequest: "please provide your phone number"
    // },
    