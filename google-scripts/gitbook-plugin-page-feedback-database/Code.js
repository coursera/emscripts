// first, create an empty spreadsheet and set SPREADSHEET_ID to the id of the sheet you want to hold records for all feedback
// next deploy this script as a web-app and copy the URL of the endpoint (it should end in /exec)
// next, add https://github.com/coursera/gitbook-plugin-page-feedback to your gitbook doc plugin registry, and configure it with the above link
// last, grab some peanut butter, tell your team to provide feedback as they use your gitbook and enjoy

var SPREADSHEET_ID = "abc123";

function doGet(e) {
  var getParameters = e.parameters;
  
  var url = String(getParameters.url);
  var title = String(getParameters.title);
  var vote = Number(getParameters.vote);
  var callback = String(getParameters.callback);
  
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  spreadsheet.appendRow([url, title, new Date(), vote]);

  return ContentService.createTextOutput(callback + '(' + JSON.stringify({}) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
