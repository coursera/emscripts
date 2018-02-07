var RESPONSE_SPREADSHEET_ID = "";
var JIRA_HOST = "";
var JIRA_PROJECT = "";
var JIRA_ISSUE_TYPE = "";
var JIRA_USER_PASS_BASE64 = "";

function myFunction(e) {
 
  var form = {
    reporterName: e.values[1],
    reporterEmail: e.values[2],
    summary: e.values[3],
    url: e.values[4],
    browser: e.values[5],
    description: e.values[6],
    resolution: e.values[7],
    label: e.values[8],
    priority: e.values[9]
  };
  
  Logger.log(form);

  createIssue(form);
}

// This script takes the user inputs from the Google Form, and will create a JIRA issue when the form is submitted via the REST API
// Takes user input info, and passes it into an event parameter "e"
function createIssue(form){
  
  // Assign variable to your instance JIRA API URL
  var url = "https://" + JIRA_HOST + ".atlassian.net/rest/api/latest/issue";
  
  // The POST data for the JIRA API call
  var data = {
    "fields": {
       "project":{ 
          "key": getProject(form)
       },
       "priority": {
          "name": getPriority(form)
       },
      "summary": getSummary(form),
      "description": getDescription(form),
      "labels": getLabels(form),
      "issuetype":{
          "name": getIssueType(form)
       }    
    }
  };
  
  // A final few options to complete the JSON string
  var options = 
      { 
        "content-type": "application/json",
        "method": "POST",
        "headers": {
          "content-type": "application/json",
          "Accept": "application/json",
          "authorization": "Basic " + JIRA_USER_PASS_BASE64          
        },
        "payload": JSON.stringify(data)
      };  

  // Make the HTTP call to the JIRA API
  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());

  // Parse the JSON response to use the Issue Key returned by the API in the email
  var dataAll = JSON.parse(response.getContentText());
  
  Logger.log(dataAll)

  sendEmailNotice(dataAll.key, form);
}

function sendEmailNotice(issueKey, form) {
  // Assign variables for the email reposnse
  var emailSubject = issueKey + ": " + form.summary;
  var emailBody = "Thank you for helping us identify an issue" + "\n\n" +
    "Your issue will be now tracked as " + issueKey;

  // Send an email to the requestor
  MailApp.sendEmail(form.reporterEmail, emailSubject, emailBody)
}

function getProject(form) {
  return JIRA_PROJECT;
}

function getIssueType(form) {
  return JIRA_ISSUE_TYPE;
}

function getSummary(form) {
  return form.summary.replace(/\n/g, '');
}

function getDescription(form) {  
  return form.description;
}

function getPriority(form) {
  return form.priority;
}

function getLabels(form) {
  return [form.label];
}
