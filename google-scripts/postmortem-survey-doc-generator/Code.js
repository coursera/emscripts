var POSTMORTEM_FOLDER_ID = "???";
var RESPONSE_SPREADSHEET_ID = "???";
var CC_EMAIL = "???";

function myFunction(e) {

  var form = {
    startDate: new Date(e.namedValues["Start"][0].replace(/(.*\d\d?:\d\d)(:.*)/, function(a, b, c) { return b; })),
    endDate: new Date(e.namedValues["End"][0].replace(/(.*\d\d?:\d\d)(:.*)/, function(a, b, c) { return b; })),
    userType: e.namedValues["User Type"][0],
    userCount: e.namedValues["User Count"][0],
    discovery: e.namedValues["Discovery"][0],
    nextSteps: e.namedValues["Next Steps"][0].split(","),
    title: e.namedValues["Title"][0],
    overview: e.namedValues["Overview"][0],
    debug: e.namedValues["Debug"][0],
    email: e.namedValues["Email Address"][0]
  };
  
  form.startDateString = form.startDate.getFullYear() + "-" + (form.startDate.getMonth() + 1) + "-" + form.startDate.getDate();
  form.startTimeHour = (form.startDate.getHours() < 10) ? '0' + form.startDate.getHours() : form.startDate.getHours();
  form.startTimeMinutes = (form.startDate.getMinutes() < 10) ? '0' + form.startDate.getMinutes() : form.startDate.getMinutes();
  form.startTimeString = form.startTimeHour + ":" + form.startTimeMinutes;

  form.endDateString = form.endDate.getFullYear() + "-" + (form.endDate.getMonth() + 1) + "-" + form.endDate.getDate();
  form.endTimeHour = (form.endDate.getHours() < 10) ? '0' + form.endDate.getHours() : form.endDate.getHours();
  form.endTimeMinutes = (form.endDate.getMinutes() < 10) ? '0' + form.endDate.getMinutes() : form.endDate.getMinutes();
  form.endTimeString = form.endTimeHour + ":" + form.endTimeMinutes;


  form.durationHours = Math.round((form.endDate - form.startDate) / (1000*60*60), 10);
  form.durationMinutes = ((form.endDate - form.startDate) / (1000*60)) % 60;
  
  var userEmail = form.email;
  
  // Create and open a document.
  var doc = DocumentApp.create("Postmortem: " + form.title);
  var docFile = DriveApp.getFileById(doc.getId());
  var docFolder = DriveApp.getFolderById(POSTMORTEM_FOLDER_ID);
  var docUrl = docFile.getUrl();
  var responseFile = DriveApp.getFileById(RESPONSE_SPREADSHEET_ID);
  var responseUrl = responseFile.getUrl(); 
  
  // add new file into post mortem folder
  docFolder.addFile(docFile);
  doc.addEditor(userEmail);
  
  var body = doc.getBody();
  
  // title
  var title = body.appendParagraph("Postmortem: " + form.title);
  title.setHeading(DocumentApp.ParagraphHeading.TITLE);

  // overview Section
  var overviewTitle = body.appendParagraph("Overview");
  overviewTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  var overviewBody = body.appendParagraph(form.overview);
  overviewBody.setHeading(DocumentApp.ParagraphHeading.NORMAL);

  // Timeline Section
  var timelineTitle = body.appendParagraph("Timeline");
  timelineTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  
  // Timeline start
  var timelineList = body.appendListItem(form.startDateString + " at " + form.startTimeString +  " - outage began");
  timelineList.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  timelineList.setGlyphType(DocumentApp.GlyphType.BULLET);
  
  // Timeine middle
  var aOrAn = /[aeiou]/i.test(form.discovery[0]) ? "an" : "a";
  var timelineItem1 = body.appendListItem("outage discovered by " + aOrAn + " " + form.discovery);
  timelineItem1.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  timelineItem1.setListId(timelineList);
  
  // Timeline end
  var timelineItem2 = body.appendListItem(form.endDateString + " at " + form.endTimeString + ' -  outage ended');
  timelineItem2.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  timelineItem2.setListId(timelineList);
  
  // Impact Section
  var impactTitle = body.appendParagraph("Impact");
  impactTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  
  var impactString = form.userCount + " " + form.userType.toLowerCase() + " were affected by the outage for " + form.durationHours + " hours and " + form.durationMinutes + " minutes";
  var impactBody = body.appendParagraph(impactString);
  impactBody.setHeading(DocumentApp.ParagraphHeading.NORMAL);

  // Debugging Section
  var debuggingTitle = body.appendParagraph("Debugging");
  debuggingTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  
  var debuggingBody = body.appendParagraph(form.debug);
  debuggingBody.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  
  // Prevention
  var preventionTitle = body.appendParagraph("Prevention");
  preventionTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  var preventionTable = body.appendTable();
  var preventionTableRow = preventionTable.appendTableRow();
  preventionTableRow.appendTableCell("Description");
  preventionTableRow.appendTableCell("ISSUE / TICKETS");
  preventionTableRow.appendTableCell("Owner");

  // loop through checked answers and create cells there
  for (var i = 0; i < form.nextSteps.length; i++) {
    var anotherRow = preventionTable.appendTableRow();
    anotherRow.appendTableCell(form.nextSteps[i].trim());
    anotherRow.appendTableCell("");
    anotherRow.appendTableCell(userEmail);
  }
  
  var preventionTableHeaderStyle = {};
  preventionTableHeaderStyle[DocumentApp.Attribute.BOLD] = true;
  preventionTableRow.setAttributes(preventionTableHeaderStyle);

  var resultSheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  resultSheet.getRange(resultSheet.getLastRow(), resultSheet.getLastColumn()).setValue('=HYPERLINK("' + docUrl + '","Post Mortem Doc")');

  var mailTitle = "Your post mortem has been auto-generated";
  var mailMessage = "please continue editing your <a href=" + docUrl + ">post mortem</a> and share it with your team when you are ready.";
  
  MailApp.sendEmail({
    to: userEmail,
    cc: CC_EMAIL, 
    subject: mailTitle, 
    htmlBody: mailMessage
  });
}
