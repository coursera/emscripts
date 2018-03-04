var JIRA_HOST = "";
var JIRA_USER_PASS_BASE64 = "";
var SYNC_ID = (new Date()).getTime();

var COLUMN_ID = 1;
var COLUMN_LINK = 2;
var COLUMN_PRIORITY = 3;
var COLUMN_STATUS = 4;
var COLUMN_SUMMARY = 5;
var COLUMN_ASSIGNEE = 6;
var COLUMN_DUE = 7;
var COLUMN_CREATED = 8;
var COLUMN_SYNC_ID = 9;

function onOpen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var editors = ss.getEditors(); 
  
  for (var i = 0; i < editors.length; i++) {
    if (Session.getActiveUser().getEmail() === editors[i].getEmail()) {
      ss.addMenu("Run", [
        {name: "Sync JQL", functionName: "promptForJQL"}]);
    }
  }
}

function promptForJQL() {
    var ui = SpreadsheetApp.getUi();

  var result = ui.prompt(
      'Sync JIRA with Google Sheets',
      'Please type in a JQL query that you want to export:',
      ui.ButtonSet.OK_CANCEL);
  
  var button = result.getSelectedButton();
  var jql = result.getResponseText();
  
  if (button == ui.Button.OK) {
    // User clicked "OK".
    sync(jql);
  }
}

function sync(jql) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  downloadIssues(sheet, lastRow > 0 ? sheet.getRange(lastRow === 1 ? 1 : 2, 1, lastRow, 1).getValues() : [[]], jql, 0);
  archiveIssues(sheet);
}

function archiveIssues(sheet) {
  var lastRow = sheet.getLastRow();
  var syncIds = lastRow > 0 ? sheet.getRange(lastRow < 2 ? 1 : 2, COLUMN_SYNC_ID, lastRow < 2 ? 1 : sheet.getLastRow() - 1, 1).getValues() : [[]];
  
  for (var i = 0; i < syncIds.length; i++) {
    if (syncIds[i][0] !== SYNC_ID) {
      sheet.getRange(i + 2, COLUMN_STATUS).setValue('DELETED');
      sheet.getRange(i + 2, COLUMN_SYNC_ID).setValue(SYNC_ID);
    }
  }
}

function downloadIssues(sheet, existingIds, jql, startAt){
  var dataAll = getIssues(jql, startAt);
  
  if (dataAll.issues.length) {
    for (var i = 0; i < dataAll.issues.length; i++) {
      var issue = dataAll.issues[i];
      var row = sheet.getLastRow() + 1;
      var id = getId(issue);
      
      for (var j = 0; j < existingIds.length; j++) {
        if (existingIds[j][0] === id) {
          row = j + 2;
        }
      }

      // modify the below to customize what columns you want from JIRA
      
      sheet.getRange(row, COLUMN_ID).setValue(id);
      sheet.getRange(row, COLUMN_LINK).setValue( '=HYPERLINK("' + getLink(issue) + '", "' + getId(issue) + '")');
      sheet.getRange(row, COLUMN_PRIORITY).setValue(getPriority(issue));
      sheet.getRange(row, COLUMN_STATUS).setValue(getStatus(issue));
      sheet.getRange(row, COLUMN_SUMMARY).setValue(getSummary(issue));
      sheet.getRange(row, COLUMN_ASSIGNEE).setValue(getAssignee(issue));
      sheet.getRange(row, COLUMN_DUE).setValue(getDueDate(issue));
      sheet.getRange(row, COLUMN_CREATED).setValue(getCreatedDate(issue));
      sheet.getRange(row, COLUMN_SYNC_ID).setValue(SYNC_ID);
     
      // add full description as a note on description column for easier viewing
      sheet.getRange(row, COLUMN_SUMMARY).setNote(getDescription(issue));
    }
  }
  
  if (dataAll.issues && dataAll.issues.length) {
    if (dataAll.total > dataAll.startAt + dataAll.issues.length) {
      downloadIssues(sheet, existingIds, jql, dataAll.startAt + dataAll.issues.length);
    }
  }
}

function getIssues(jql, startAt) {
  // Assign variable to your instance JIRA API URL
  var url = "https://" + JIRA_HOST + ".atlassian.net/rest/api/2/search";
  
  // The POST data for the JIRA API call
  var data = {
    "jql": jql,
    "maxResults": 100,
    "startAt": startAt
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
  
  return JSON.parse(response.getContentText());
}

function getLink(issue) {
  return "https://" + JIRA_HOST + ".atlassian.net/browse/" + issue.key; 
}

function getId(issue) {
  return issue.key;
}

function getSummary(issue) {
  return issue.fields.summary || '';
}

function getDescription(issue) {
  return issue.fields.description || '';
}

function getPriority(issue) {
  issue.fields.priority.name;
}

function dateToString(jiraDate) {
  var date = jiraDate ? new Date(jiraDate) : new Date();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var year = date.getYear();
  return year + "-" + month + "-" + day;
}

function getCreatedDate(issue) {
  var jiraDate = issue.fields.created;
  return jiraDate ? dateToString(jiraDate) : "";
}

function getDueDate(issue) {
  if (/P0|P1/.test(getPriority(issue))) {
    var jiraDate = issue.fields.duedate;
    return jiraDate ? dateToString(jiraDate) : "";
  } else {
    return "";
  }
}

function getAssignee(issue) {
  return issue.fields.assignee.name;
}

function getStatus(issue) {
  if (issue.fields.resolution) {
    return issue.fields.resolution.name;
  } else {
    return issue.fields.status.name;
  }
}

function capitalizeFirstLetter(string) {
  var stringSplit = string.split('');
  stringSplit[0] = stringSplit[0].toUpperCase();
  return stringSplit.join('');
}
