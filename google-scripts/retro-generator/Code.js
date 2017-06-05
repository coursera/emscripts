/*
  This google script automates FLEX team's sprint retrospectives.

  Per each sub team's sprint schedule, this script does the following:
    - Create a new set of forms for each subteam, one day before sprint ends
    - Sends out each form to the respective sub team
    - Script aggreagates all the responses into two spread sheets
      - Master results sheet that has data from all the teams across all the sprints
      - Sprint results sheet that has data from only that sprint from all the teams
    - Both master and sprint sheets will be shared across the flex team

  Notes:
    Main Functions:
      Functions ending with 'Main' are points of entry into a single executable module
      Ideally, that piece of code could be split into separate script files, but
      Google scripts run significantly slower and it's encouraged to keep all the
      code in single file

    Script Properties:
      State across sessions is maintained through Script variables.
      For example, ID of the master results sheet, IDs of the forms etc are stored
      in ScriptProperties. These properties are scoped by script shared across
      all the users.

    Master results sheet:
      This script when run, will try to retrive master sheet based on key stored
      in script properties. If the key is non existent, this script would create
      a new master results spread sheet. After creating the master spreadsheet, a
      sheet would be created for each sub team and in each sheet a first row
      with titles is created and that row is frozen.
*/

var TEAM_RED_PANDAS = {
  name: 'Team Red Pandas',
  sprintLeaders: ['mustafa@coursera.org'],
  email: 'flex-red-pandas-team@coursera.org',
  frequencyInWeeks: 2,
  surveyTitle: 'Team Red Pandas Sprint Retro ',
  surveyEmailBody: 'Hi Pandas! \n\nPlease submit this sprint\'s retrospective before the sprint meeting. \
You will receive summary \
of all responses (from entire flex team) on Monday.\n\nHere is the link: ',
  surveyResultsTitle: 'Sprint Retro Results',
  surveyResultsBody: 'Each team\'s results are organized into a separate sheet.\n\nPlease checkout the results here: ',
  surveySendDay: ScriptApp.WeekDay.THURSDAY,
  surveyFrequencyWeeks: 2,
  surveytriggerFunction: 'sendTeamRedPandas'
};

var TEAM_AUTOBOTS = {
  name: 'Team Autobots',
  sprintLeaders: ['priyank@coursera.org'],
  email: 'flex-autobots@coursera.org',
  frequencyInWeeks: 1,
  surveyTitle: 'Team Autobots Weekly Retro ',
  surveyEmailBody: 'Hi Autobots! \n\nPlease submit this week\'s retrospective before next planning meeting. \
You will receive summary \
of all responses (from entire flex team) on Monday.\n\nHere is the link: ',
  surveyResultsTitle: 'Weekly Retro Results',
  surveyResultsBody: 'Each team\'s results are organized into a separate sheet.\n\nPlease checkout the results here: ',
  surveySendDay: ScriptApp.WeekDay.FRIDAY,
  surveyFrequencyWeeks: 1,
  surveytriggerFunction: 'sendTeamAutobots'
};

var TEAM_PORCUPINES = {
  name: 'Team Porcupines',
  sprintLeaders: ['eleith@coursera.org', 'clee@coursera.org'],
  email: 'flex-partner-experience-team@coursera.org',
  frequencyInWeeks: 2,
  surveyTitle: 'Team Porcupines Sprint Retrospective ',
  surveyEmailBody: 'Hi Porcupines! \n\nPlease submit the survey before tomorrow\'s sprint meeting. \
You will receive summary \
of all responses (from entire flex team) on Monday.\n\nHere is the link: ',
  surveyResultsTitle: 'Sptrint Retro Results',
  surveyResultsBody: 'Each team\'s results are organized into a separate sheet.\n\nPlease checkout the results here: ',
  surveySendDay: ScriptApp.WeekDay.THURSDAY,
  surveyFrequencyWeeks: 2,
  surveytriggerFunction: 'sendTeamPorcupines'
};

var TEAM_CORGIS = {
  name: 'Team Corgis',
  sprintLeaders: ['mustafa@coursera.org'],
  email: 'flex-mobile@coursera.org',
  frequencyInWeeks: 2,
  surveyTitle: 'Team Corgis Sprint Retrospective ',
  surveyEmailBody: 'Hi Corgis! \n\nPlease submit the survey before tomorrow\'s sprint meeting. \
You will receive summary \
of all responses (from entire flex team) on Monday.\n\nHere is the link: ',
  surveyResultsTitle: 'Sptrint Retro Results',
  surveyResultsBody: 'Each team\'s results are organized into a separate sheet.\n\nPlease checkout the results here: ',
  surveySendDay: ScriptApp.WeekDay.THURSDAY,
  surveyFrequencyWeeks: 2,
  surveytriggerFunction: 'sendTeamCorgis'
};

var TEAM_TEST = {
  name: 'Team Test',
  sprintLeaders: [],
  email: 'priyank@coursera.org',
  frequencyInWeeks: 2,
  surveyTitle: 'This is a test retrospective ',
  surveyEmailBody: 'Please submit the survey before tomorrow\'s sprint meeting. \
You will receive summary \
of all responses (from entire flex team) on Monday.\n\nHere is the link: ',
  surveyResultsTitle: 'Sptrint Retro Results',
  surveyResultsBody: 'Each team\'s results are organized into a separate sheet.\n\nPlease checkout the results here: ',
  surveySendDay: ScriptApp.WeekDay.THURSDAY,
  surveyFrequencyWeeks: 2,
  surveytriggerFunction: 'sendTestTeam'
};

var TEAMS = {
  'Team Red Pandas': TEAM_RED_PANDAS,
  'Team Autobots' : TEAM_AUTOBOTS,
  'Team Porcupines' : TEAM_PORCUPINES,
  'Team Corgis' : TEAM_CORGIS
};

var FLEX_TEAM = 'flex-team@coursera.org';

var QUESTIONS = [
  'What went well this sprint?',
  'Do you have anything on your mind to discuss as a team?',
  'Who would you give kudos to this sprint?',
  'What impressed you to give kudos?'
];

var RESULTS_COLUMNS = [
  'Date',
  'Email',
  QUESTIONS[0],
  QUESTIONS[1],
  QUESTIONS[2],
  QUESTIONS[3]
];

var RESULTS_SPREADSHEET_NAME = 'Flex Retro Survey Results (Master Sheet)';
var MASTER_RESULTS_SHEET_ID = 'MASTER_RESULTS_SHEET_ID';

function getGroupUsers(group) {
  var groupUsers = [];
  var userObjects = group.getUsers();
  for (var userIndex = 0; userIndex < userObjects.length; userIndex++) {
    var userObject = userObjects[userIndex];
    groupUsers.push(userObject.getEmail());
  }
  return groupUsers;
}

function createAndSendTeamFormsMain(team) {
  var form = createForm(team);
  sendForm(team, form);
}

function getFormattedDate() {
  var date = new Date();
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getYear();
}

function getTeamFormKey(teamName) {
  var teamKey = teamName.replace(' ', '_');
  teamKey += '_FORM_ID';
  return teamKey;
}

function storeFormId(teamName, form) {
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty(getTeamFormKey(teamName), form.getId());
}

function deleteFormId(teamName) {
  var properties = PropertiesService.getScriptProperties();
  properties.deleteProperty(getTeamFormKey(teamName));
}

function createForm(team) {
  var formTitle = team.surveyTitle + getFormattedDate();
  var form = FormApp.create(formTitle);
  var group = GroupsApp.getGroupByEmail(team.email);

  storeFormId(team.name, form);

  form.setTitle(formTitle);

  form.addParagraphTextItem().setTitle(QUESTIONS[0]);
  form.addParagraphTextItem().setTitle(QUESTIONS[1]);
  form.addListItem().setTitle(QUESTIONS[2]).setChoiceValues(getGroupUsers(group));
  form.addParagraphTextItem().setTitle(QUESTIONS[3]);


  form.setCollectEmail(true);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage('Thanks for submitting. Let\'s discuss this in our planning meeting.');
  form.setLimitOneResponsePerUser(true);
  form.addEditors(team.sprintLeaders)

  return form;
}

function sendForm(team, form) {
  var body = team.surveyEmailBody + form.shortenFormUrl(form.getPublishedUrl());

  GmailApp.sendEmail(team.email, form.getTitle(), body);
}

function sendTeamRedPandas() {
  createAndSendTeamFormsMain(TEAM_RED_PANDAS);
}

function sendTeamAutobots() {
  createAndSendTeamFormsMain(TEAM_AUTOBOTS);
}

function sendTeamPorcupines() {
  createAndSendTeamFormsMain(TEAM_PORCUPINES);
}

function sendTeamCorgis() {
  createAndSendTeamFormsMain(TEAM_CORGIS);
}

// This is a test function to check if form is getting sent as expected
function sendTestTeam() {
  createAndSendTeamFormsMain(TEAM_TEST);
}

/*
  All the methods below would be used to scrape feedback from forms and put them in to a spreadsheet
*/
function getMasterResultsSpreadSheet() {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty(MASTER_RESULTS_SHEET_ID);
  var spreadSheet = null;
  if (id) {
    Logger.log('Retrieving existing sheet with id: ' + id);
    spreadSheet = SpreadsheetApp.openById(id);
  } else {
    spreadSheet = createNewSpreadSheet(RESULTS_SPREADSHEET_NAME);
    properties.setProperty(MASTER_RESULTS_SHEET_ID, spreadSheet.getId());
  }
  return spreadSheet;
}

function createNewSpreadSheet(name) {
  var spreadSheet = SpreadsheetApp.create(name);
  var sheets = spreadSheet.getSheets();
  var defaultSheet = sheets[0];

  // Delete any existing sheets other than the default sheet.
  for (var i = 1; i < sheets.length; i++) {
    spreadSheet.deleteSheet(sheets[i]);
  }

  // Insert one sheet per team
  for (var teamName in TEAMS) {
    var sheet = spreadSheet.insertSheet(teamName);
    sheet.appendRow(RESULTS_COLUMNS);
    sheet.setFrozenRows(1);
    var range = sheet.getRange(1, 1, 1, RESULTS_COLUMNS.length);
    range.setFontWeight('bold');
  }

  // Delete the default sheet
  spreadSheet.deleteSheet(defaultSheet);

  return spreadSheet;
}

function copyFeedbackToSpreadsheet(teamName, form, resultsSpreadSheet) {
  var sheet = resultsSpreadSheet.getSheetByName(teamName);

  var responses = form.getResponses();
  for (var i =0; i < responses.length; i++) {
    var itemResponses = responses[i].getItemResponses();
    var sheetColumns = [];
    sheetColumns[0] = getFormattedDate();
    sheetColumns[1] = responses[i].getRespondentEmail();
    for (var j=0; j < itemResponses.length; j++) {
      var currentQuestion = itemResponses[j].getItem().getTitle();
      var columnPosition = RESULTS_COLUMNS.indexOf(currentQuestion);
      sheetColumns[columnPosition] = itemResponses[j].getResponse();
    }
    sheet.appendRow(sheetColumns);
  }
}

function shareMasterResultsSheet(team, currentResults, masterResults) {
  var body = team.surveyResultsBody + currentResults.getUrl() + '\n\nYou can find all previous retrospective results here: ' +
    masterResults.getUrl();
  GmailApp.sendEmail(team.email, team.surveyResultsTitle, body);
}


/*****************************************************************
 ****************** ALL MAIN FUNCTIONS BELOW *********************
 * All the below functions can be triggered and run on their own *
 *****************************************************************/

/*
  Triggers
    - one trigger to send the sprint retro survey per team's schedule
    - another trigger to collect feedback on monday morning and email the team
*/
function scheduleTriggersMain() {
  for (var teamName in TEAMS) {
    var team = TEAMS[teamName];
    ScriptApp.newTrigger(team.surveytriggerFunction)
      .timeBased()
      .onWeekDay(team.surveySendDay)
      .everyWeeks(team.surveyFrequencyWeeks)
      .atHour(14)
      .create();
  }

  ScriptApp.newTrigger('scrapeAndShareFeedbackFromAllFormsMain')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .everyWeeks(1)
    .atHour(14)
    .create();
}

// CAUTION: This function would send surveys to all the teams right NOW
function sendAllFormsNowMain() {
  for (var teamName in TEAMS) {
    createAndSendTeamFormsMain(TEAMS[teamName])
  }
}

/*
This function would scrape results from all the recently sent forms
and share those results with that specific team.
*/
function scrapeAndShareFeedbackFromAllFormsMain() {
  var properties = PropertiesService.getScriptProperties();
  var masterResultsSpreadSheet = getMasterResultsSpreadSheet();
  var currentSurveyResultsSpreadSheet = createNewSpreadSheet('Retrospective Results ' + getFormattedDate());

  for (var teamName in TEAMS) {
    var keyName = getTeamFormKey(teamName);
    var formId = properties.getProperty(keyName);
    if (formId) {
      var form = FormApp.openById(formId);
      copyFeedbackToSpreadsheet(teamName, form, masterResultsSpreadSheet);
      copyFeedbackToSpreadsheet(teamName, form, currentSurveyResultsSpreadSheet);
      shareMasterResultsSheet(TEAMS[teamName], currentSurveyResultsSpreadSheet, masterResultsSpreadSheet);
      deleteFormId(teamName);
    }
  }
}
