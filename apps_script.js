// --- Google Apps Script for TV Time Giver ---
// Deploy this as a Web App in your Google Sheet's "Extensions > Apps Script"
// 1. Paste this code.
// 2. Deploy > New Deployment > Type: Web App > Execute as: Me > Who has access: Anyone.
// 3. Copy the "Web App URL" and paste it below into the SCRIPT_URL variable.
// 4. Set up a Trigger: Triggers (clock icon) > Add Trigger > sendApprovalEmail > From spreadsheet > On change.

const PARENT_EMAIL = "venky24aug@gmail.com";
const CC_EMAIL = "Sunshinegalsmiles4u@gmail.com";
const BCC_EMAIL = "lakshveeronline@gmail.com";

// PASTE YOUR DEPLOYED WEB APP URL HERE AFTER FIRST DEPLOYMENT
// Example: const SCRIPT_URL = "https://script.google.com/macros/s/......./exec";
const SCRIPT_URL = "REPLACE_WITH_YOUR_WEB_APP_URL";

function sendApprovalEmail(e) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(lastRow, 1, 1, 5); // Assuming: Date, User, Earned, History, Status
    const values = range.getValues()[0];

    const status = values[4]; // Column 5

    // Only send if Status is "PENDING" and we haven't processed it yet (prevents loops)
    if (status === "PENDING") {
        const date = values[0];
        const earned = values[2];
        const history = values[3];

        // Generate Approval Links
        const approveLink = `${SCRIPT_URL}?action=APPROVE&row=${lastRow}`;
        const rejectLink = `${SCRIPT_URL}?action=REJECT&row=${lastRow}`;

        const subject = `TV Time Approval Request: ${earned} mins`;
        const htmlBody = `
      <h2>TV Time Request</h2>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Earned:</strong> ${earned} minutes</p>
      <p><strong>Activity:</strong><br>${history}</p>
      <br>
      <a href="${approveLink}" style="background-color:green;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">APPROVE (Watch TV)</a>
      &nbsp;&nbsp;
      <a href="${rejectLink}" style="background-color:red;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">REJECT (No TV)</a>
    `;

        MailApp.sendEmail({
            to: PARENT_EMAIL,
            cc: CC_EMAIL,
            bcc: BCC_EMAIL,
            subject: subject,
            htmlBody: htmlBody
        });

        // Mark as EMAILED to prevent double sending if script runs again
        sheet.getRange(lastRow, 5).setValue("EMAILED");
    }
}

function doGet(e) {
    // Safety check for 'e' to check if run manually
    if (!e || !e.parameter) {
        return ContentService.createTextOutput("Error: No parameters found. (Did you run this manually? Use the 'Test Deployment' URL instead.)");
    }

    var action = e.parameter.action;
    var row = e.parameter.row;

    if (!action || !row) return ContentService.createTextOutput("Invalid Request: Missing parameters.");

    var sheetId = e.parameter.sheet_id;
    var sheet;

    // Use specific Sheet ID if provided (Robust Method)
    if (sheetId) {
        sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    } else {
        // Fallback (Only works if container-bound)
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        if (ss) sheet = ss.getActiveSheet();
    }

    if (!sheet) return ContentService.createTextOutput("Error: Could not find Spreadsheet. (Missing sheet_id param or not bound).");
    var newStatus = (action === "APPROVE") ? "APPROVED" : "REJECTED";

    // Update the specific row if valid
    if (row && !isNaN(row)) {
        sheet.getRange(row, 5).setValue(newStatus);
    }

    // Use simple string concatenation to avoid template literal issues
    var color = (action === 'APPROVE') ? 'green' : 'red';
    var html = '<html><body style="font-family:sans-serif; text-align:center; padding-top:50px;">';
    html += '<h1 style="color:' + color + '">' + newStatus + '</h1>';
    html += '<p>The child\'s app has been updated.</p>';
    html += '<button onclick="window.close()" style="padding:10px 20px; font-size:16px;">Close</button>';
    html += '</body></html>';

    return HtmlService.createHtmlOutput(html);
}
