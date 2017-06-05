var REPORT_ID_KEY = 'FLEX-ON-CALL-REPORT-ID';
var ON_CALLS = null;

function getOauthToken() {
  var properties = PropertiesService.getScriptProperties();
  return properties.getProperty('token');
}

function getAuthHeader() {
  return {
    headers: {
      Authorization: 'Token token=' + getOauthToken()
    }
  }
}

function fullLastOncallDay() {
  var MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
  var now = new Date();
  var yesterday = new Date(now.getTime() - MILLIS_PER_DAY);;
  return Utilities.formatDate(yesterday, 'PST', 'yyyy-MM-dd');
}

function getOnCalls() {
  if (!ON_CALLS) {
    var url = 'https://api.pagerduty.com/oncalls?since=' + fullLastOncallDay() +
      '&until=' + fullLastOncallDay() + '&escalation_policy_ids\[\]=PSPVUNS&schedule_ids\[\]=POYCKR2&schedule_ids\[\]=P8RM9VI&include\[\]=users';
    var response = UrlFetchApp.fetch(url, getAuthHeader());
    ON_CALLS = JSON.parse(response).oncalls;
    Logger.log(ON_CALLS);
  }
  return ON_CALLS;
}

function getLastOncallDate() {
  var onCalls = getOnCalls();
  if (onCalls.length > 0) {
    var onCall = onCalls[0];
    var endDate = Moment.moment(onCall.end).toDate();
    return Utilities.formatDate(endDate, 'PST', 'YYYY-MM-dd');
  }
}

function getStartOncallDate() {
  var onCalls = getOnCalls();
  if (onCalls.length > 0) {
    var onCall = onCalls[0];
    var startDate = Moment.moment(onCall.start).toDate();
    return Utilities.formatDate(startDate, 'PST', 'YYYY-MM-dd');
  }
}

function getOncallPerson(escalationLevel) {
  var onCalls = getOnCalls();
  for (var i in onCalls) {
    var onCall = onCalls[i];
    if (onCall.escalation_level == escalationLevel)  {
      return onCall.user.summary;
    }
  }
}

function getPrimaryOncallPerson() {
  return getOncallPerson(1);
}

function getSecondaryOncallPerson() {
  return getOncallPerson(2);
}

function generateReportTitle() {
  return "Primary: " + getPrimaryOncallPerson() + " and Secondary: " + getSecondaryOncallPerson() +
    getStartOncallDate() + " to " + getLastOncallDate() + "\n";
}

function addAlertsToDoc() {
  var url = 'https://api.pagerduty.com/incidents?since=' + getStartOncallDate() +
    '&until=' + getLastOncallDate() + '&time_zone=PST&service_ids\[\]=P1DJ0D5&time_zone=UTC&include\[\]=services&include\[\]=teams&include\[\]=limit';
  var response = UrlFetchApp.fetch(url, getAuthHeader());
  addIncidentsToDoc(JSON.parse(response));
  return response;
}

function getOrCreateReport() {
  var doc;
  var properties = PropertiesService.getScriptProperties();
  var existingDocId = properties.getProperty(REPORT_ID_KEY);
  if (existingDocId) {
      Logger.log(existingDocId);
     doc = DocumentApp.openById(existingDocId);
  } else {
    doc = DocumentApp.create('FLEX On-call running report');
    properties.setProperty(REPORT_ID_KEY, doc.getId());
  }
  return doc;
}

function addIncidentsToDoc(response) {
  var doc = getOrCreateReport();
  var body = doc.getBody();
  Logger.log(body);

  body.insertParagraph(0, getStartOncallDate() + " to " + getLastOncallDate())
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.insertParagraph(1, "p: " + getPrimaryOncallPerson() + ", s: " +  getSecondaryOncallPerson() + "\n");

  body.insertParagraph(2, "Alerts Triggered")
      .setHeading(DocumentApp.ParagraphHeading.HEADING3);
  body.insertHorizontalRule(3);

  for (var incidentIndex in response.incidents) {
     var incident = response.incidents[incidentIndex];
     body.insertListItem(3, incident.title);
  }

  doc.saveAndClose();
}
