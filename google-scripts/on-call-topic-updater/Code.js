var ALERTS_FORUM_CHANNEL_ID = 'C70F5CPJS';

var ALL_SLACK_USERS = null;
var ON_CALLS = {};

var TEST = {
  primaryScheduleId: 'POYCKR2',
  secondaryScheduleId: 'P8RM9VI',
  firstFullOncallDayIndex: 4, // Thursday
  slackAlertsChannelId: 'G99LD1C7Q',
  oncallSwitcherMethodName: 'switchFlexOncallMain',
  switchesAtHour: 17,
  switchesOnDay: ScriptApp.WeekDay.WEDNESDAY
};

var TEAM_FLEX = {
  primaryScheduleId: 'POYCKR2',
  secondaryScheduleId: 'P8RM9VI',
  // Thursday; Week starts with Monday with value 1
  // On-call starts on wednesday evening. So full on-call day for FLEX is Thursday
  firstFullOncallDayIndex: 4, // Thursday
  slackAlertsChannelId: 'C11U9GLLT',
  oncallSwitcherMethodName: 'switchFlexOncallMain',
  switchesAtHour: 17,
  switchesOnDay: ScriptApp.WeekDay.WEDNESDAY
};

var TEAM_GORILLAS = {
  // Admin team
  primaryScheduleId: 'POYCKR2',
  secondaryScheduleId: 'P8RM9VI',
  // Thursday; Week starts with Monday with value 1
  // On-call starts on wednesday evening. So full on-call day for FLEX is Thursday
  firstFullOncallDayIndex: 1, // Monday
  slackAlertsChannelId: 'G80URPL8Y',
  oncallSwitcherMethodName: 'switchGorillasOncallMain',
  switchesAtHour: 10,
  switchesOnDay: ScriptApp.WeekDay.MONDAY
};

var TEAM_FRONTEND_INFRA = {
  primaryScheduleId: 'P1RDRIV',
  secondaryScheduleId: 'PIKM31Y',
  // Thursday; Week starts with Monday with value 1
  firstFullOncallDayIndex: 1, // Monday
  slackAlertsChannelId: 'C26FKQDPS',
  oncallSwitcherMethodName: 'switchFrontendInfraOncallMain',
  switchesAtHour: 11,
  switchesOnDay: ScriptApp.WeekDay.MONDAY
};

var TEAM_DRAGONS = {
  primaryScheduleId: 'P3QFKME',
  secondaryScheduleId: 'PMN1L9L',
  firstFullOncallDayIndex: 4, // Thursday
  slackAlertsChannelId: 'C027TBEQ9',
  oncallSwitcherMethodName: 'switchDragonsOncallMain',
  switchesAtHour: 17,
  switchesOnDay: ScriptApp.WeekDay.WEDNESDAY
};

var TEAM_GROWTH = {
  primaryScheduleId: 'PBWP7IS',
  secondaryScheduleId: 'PIO89A6',
  firstFullOncallDayIndex: 2, // Tuesday
  slackAlertsChannelId: 'C03NWK116',
  oncallSwitcherMethodName: 'switchGrowthOncallMain',
  switchesAtHour: 12,
  switchesOnDay: ScriptApp.WeekDay.MONDAY
};

var TEAMS = [TEAM_FLEX, TEAM_DRAGONS, TEAM_GROWTH, TEAM_FRONTEND_INFRA];

function getPagerdutyHeader() {
  return {
    headers: {
      Authorization: 'Token token=' + getOauthToken('pagerduty-token'),
      Accept: 'application/vnd.pagerduty+json;version=2'
    }
  };
}

function fetchPagerDutyUserData(userUrl) {
  var response = UrlFetchApp.fetch(userUrl, getPagerdutyHeader());
  return JSON.parse(response).user;
}

function getOncallPerson(team, escalationLevel) {
  var onCalls = getOnCalls(team);
  for (var i in onCalls) {
    var onCall = onCalls[i];
    if (onCall.escalation_level == escalationLevel) {
      return fetchPagerDutyUserData(onCall.user.self);
    }
  }
}

function hyphenatedDate(date) {
  return Utilities.formatDate(date, 'PST', 'yyyy-MM-dd');
}

function getOnCalls(team) {
  if (!ON_CALLS[team.name]) {
    var fullOncallDate = getFirstFullOncallDayDate(team.firstFullOncallDayIndex);
    var url =
      'https://api.pagerduty.com/oncalls?schedule_ids\[\]=' +
      team.primaryScheduleId +
      '&schedule_ids\[\]=' +
      team.secondaryScheduleId +
      '&include\[\]=users';
    var response = UrlFetchApp.fetch(url, getPagerdutyHeader());
    ON_CALLS[team.name] = JSON.parse(response).oncalls;
  }
  return ON_CALLS[team.name];
}

function readableDate(date) {
  var formattedLastDate = date.getMonth() + 1 + '/' + date.getDate();
  Logger.log('Last date %s', formattedLastDate);
  return formattedLastDate;
}

function lastOncallDate(firstFullOncallDate) {
  return new Date(firstFullOncallDate.setDate(firstFullOncallDate.getDate() + 6));
}

function getFirstFullOncallDayDate(firstFullOncallDayIndex) {
  var today = new Date();
  var daysAwayFromNextFullOnCallDay = firstFullOncallDayIndex - today.getDay();
  return new Date(today.setDate(today.getDate() + daysAwayFromNextFullOnCallDay));
}

function sendSlackMessage(userId, message) {
  Logger.log(message);
  var directIMChannelId = createDirectIMChannel(userId);
  var url =
    'https://slack.com/api/chat.postMessage?channel=' +
    directIMChannelId +
    '&text=' +
    message +
    '&token=' +
    getOauthToken('slack-token');
  var response = UrlFetchApp.fetch(url);
  Logger.log(response);
}

function createDirectIMChannel(userId) {
  var url =
    'https://slack.com/api/im.open?user=' + userId + '&token=' + getOauthToken('slack-token');
  var response = UrlFetchApp.fetch(url);
  var json = response.getContentText();
  var data = JSON.parse(json);
  Logger.log(data);
  var channelId = data.channel.id;
  Logger.log(channelId);
  return channelId;
}

function addUserToChannel(channelId, userId) {
  var url =
    'https://slack.com/api/channels.invite?channel=' +
    channelId +
    '&user=' +
    userId +
    '&token=' +
    getOauthToken('slack-token');
  var response = UrlFetchApp.fetch(url);
  Logger.log('Adding the user to channel');
  Logger.log(response);
}

function getSlackUserId(email) {
  if (!ALL_SLACK_USERS) {
    ALL_SLACK_USERS = getAllSlackUsers();
  }

  for (var i = 0; i < ALL_SLACK_USERS.length; i++) {
    var user = ALL_SLACK_USERS[i];
    if (user.profile && user.profile.email == email) {
      Logger.log(user.id);
      return user.id;
    }
  }
}

function getAllSlackUsers() {
  Logger.log('Getting all users');
  var url = 'https://slack.com/api/users.list?token=' + getOauthToken('slack-token');
  var response = UrlFetchApp.fetch(url);
  var json = response.getContentText();
  var data = JSON.parse(json);
  return data.members;
}

function setChannelTopic(channelId, topic) {
  var url =
    'https://slack.com/api/channels.setTopic?channel=' +
    channelId +
    '&topic=' +
    topic +
    '&token=' +
    getOauthToken('slack-token');
  var response = UrlFetchApp.fetch(url);
  if (JSON.parse(response).ok == false) {
    setConversationTopic(channelId, topic);
  } else {
    Logger.log(response);
  }
}

function setConversationTopic(channelId, topic) {
  var url =
    'https://slack.com/api/conversations.setTopic?channel=' +
    channelId +
    '&topic=' +
    topic +
    '&token=' +
    getOauthToken('slack-token');
  var response = UrlFetchApp.fetch(url);
  Logger.log(response);
}

function getOauthToken(tokenName) {
  var properties = PropertiesService.getScriptProperties();
  return properties.getProperty(tokenName);
}

function switchOncallRoutine(team) {
  var fullOncallDate = getFirstFullOncallDayDate(team.firstFullOncallDayIndex);
  Logger.log(fullOncallDate);
  var primaryUserProfile = getOncallPerson(team, 1);
  var secondaryUserProfile = getOncallPerson(team, 2);
  var oncallTill = readableDate(lastOncallDate(fullOncallDate));
  var channelTopic = 'people oncall: ' + primaryUserProfile.name + ', ' + secondaryUserProfile.name + ' till ' + oncallTill;
  Logger.log(channelTopic);
  setChannelTopic(team.slackAlertsChannelId, channelTopic);

   var primaryId = getSlackUserId(primaryUserProfile.email);
   // var primaryId = getSlackUserId('priyank@coursera.org');
  Logger.log('Primary User id: ' + primaryId);

   var secondaryId = getSlackUserId(secondaryUserProfile.email);
  // var secondaryId = getSlackUserId('priyank@coursera.org');
  Logger.log('Secondary User id: ' + secondaryId);

  primaryId &&
    addUserToChannel(team.slackAlertsChannelId, primaryId) &&
    addUserToChannel(ALERTS_FORUM_CHANNEL_ID, primaryId);
  secondaryId &&
    addUserToChannel(team.slackAlertsChannelId, secondaryId) &&
    addUserToChannel(ALERTS_FORUM_CHANNEL_ID, secondaryId);

  var primaryMessage = encodeURIComponent(
    'hey, you are going to be *primary on-call* till *' +
      oncallTill +
      '*. you have been added to <#' +
      team.slackAlertsChannelId +
      '> and <#C70F5CPJS>. ' +
      ' secondary on-call is going to be ' +
      (secondaryId ? '<@' + secondaryId + '>.' : secondary)
  );

  var secondaryMessage = encodeURIComponent(
    'hey, you are going to be *secondary on-call* till *' +
      oncallTill +
      '*. you have been added to <#' +
      team.slackAlertsChannelId +
      '> and <#C70F5CPJS>. ' +
      ' primary on-call is going to be ' +
      (primaryId ? '<@' + primaryId + '>.' : primary)
  );
  Logger.log(primaryMessage);
  Logger.log(secondaryMessage);
  primaryId && sendSlackMessage(primaryId, primaryMessage);
  secondaryId && sendSlackMessage(secondaryId, secondaryMessage);
}

function switchFlexOncallMain() {
  switchOncallRoutine(TEAM_FLEX);
}

function switchContextOncallMain() {
  switchOncallRoutine(TEAM_CONTEXT);
}

function switchDragonsOncallMain() {
  switchOncallRoutine(TEAM_DRAGONS);
}

function switchGrowthOncallMain() {
  switchOncallRoutine(TEAM_GROWTH);
}

function switchDataInfraOncallMain() {
  switchOncallRoutine(TEAM_DATA_INFRA);
}

function switchFrontendInfraOncallMain() {
  switchOncallRoutine(TEAM_FRONTEND_INFRA);
}

function scheduleOncallUpdaterMain() {
  for (var teamName in TEAMS) {
    var team = TEAMS[teamName];
    ScriptApp.newTrigger(team.oncallSwitcherMethodName)
      .timeBased()
      .onWeekDay(team.switchesOnDay)
      .everyWeeks(1)
      .atHour(team.switchesAtHour)
      .create();
  }
}

function test() {
  switchOncallRoutine(TEST);
}
