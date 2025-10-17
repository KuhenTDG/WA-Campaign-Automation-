

const CAMPAIGN_CONFIG = {
    // Contact details
    contactName: "Whatsapp Automation",   //+60 16-410 5382 (to test blurry receipt) || Whatsapp Automation

    // Campaign trigger Message 
    triggerMessage: "kuhentest", // Hi, I want to join Haleon SG Oral Month Campaign. || kuhentest

    // Campaign identification
    exactCampaignName: "Fluimucil Buy and Redeem Campaign!!​",  // Haleon SG Oral Month Campaign! || Fluimucil Buy and Redeem Campaign!!

    expectedInstructions: {
        nameRequest: [
            "Great! Let's move to the next step.",
            "Please reply with your Name."
        ],

        // Receipt upload message (this should ONLY appear after valid name)
        receiptUploadRequest: [
            "Please submit your receipt as a proof of purchase",
            "The receipt must contain the following information",

            "a. Store Name​",
            "b. Receipt Date",
            "c. Product Name​",
            "d. Product amount​",
            "e. Total receipt amount​",
            "f. Receipt number​",

            "A clear and readable receipt image is very helpful for the validation process"

        ],

        // ===== INVALID NAME FLOW =====
        // Invalid name rejection message (appears when name is INVALID)
        nameRejection: [
            "Please enter your FULL NAME ONLY as per your NRIC",
            "without any numbers, symbols or images",
            "Great! Let's move to the next step.",
            "Please reply with your Name.​"
        ],


        // Submission acceptance message (should NOT appear for invalid inputs)
        submissionAccepted: [
            "Thank you for your submission",
            "​We’ve received your details and will proceed with validation.",
            "You’ll receive your $5 Grab Voucher within 5 working days once the verification is complete.​"
            //"Reminder: Please keep your receipt and do not discard it until the verification process is fully completed."
        ],

        // Receipt rejection message (appears when receipt is invalid/blurry) - CORRECT behavior
        receiptRejection: [
            "Sorry, but we were unable to verify your receipt",
            "If you believe this is an error and would like to proceed with a manual review,",
            "please tap the Proceed button to submit your receipt again."
        ],

        // 💬 Chat with Agent configuration
        /*chatWithAgent: {
            agentMessage: "Hi...How to do this...",
            expectedResponse: "Got a question? Just type in your enquiry below — our Agent will get back to you within 3 working days. We're here to help!",
            timeouts: {
                responseWait: 15000
            }
        }*/


    },


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
