var REPLACE_STRINGS = [/On Call/ig, /flex/ig, /Context/ig, /on-call/ig, /primary/ig, /secondary/ig, /[^a-zA-z\s]/g];
var ALL_USERS = null;

var TEAM_FLEX = {
  primaryOncallCalendarId: 'qri5ovmhjg77iogsflue1s57vjlghbt5@import.calendar.google.com',
  secondaryOncallCalendarId: 'j4bbsbpk4aku5fn6ofr3cp409sfvc3s4@import.calendar.google.com',
  // Thursday; Week starts with Monday with value 1
  // On-call starts on wednesday evening. So full on-call day for FLEX is Thursday
  firstFullOncallDayIndex: 4,
  slackAlertsChannelId: 'C11U9GLLT',
  oncallSwitcherMethodName: 'switchFlexOncallMain',
  switchesAtHour: 17,
  switchesOnDay: ScriptApp.WeekDay.WEDNESDAY
}

var TEAM_CONTEXT = {
  primaryOncallCalendarId: 'uakha0i23cqedc3q8o62s131ist653od@import.calendar.google.com',
  secondaryOncallCalendarId: '0en7rmqitg595sskc3802klcqc7ddnnk@import.calendar.google.com',
  firstFullOncallDayIndex: 2, // Monday
  slackAlertsChannelId: 'C362H438T',
  oncallSwitcherMethodName: 'switchContextOncallMain',
  switchesAtHour: 10,
  switchesOnDay: ScriptApp.WeekDay.MONDAY
}

var TEAMS = [TEAM_FLEX, TEAM_CONTEXT];

function personOnCall(calendarId, firstFullOncallDate) {
  var calendar = CalendarApp.getCalendarById(calendarId);
  var events = calendar.getEventsForDay(firstFullOncallDate);
  var title = events[0].getTitle();
  var name = extractNameFromEventTitle(title);
  Logger.log('On-call person name: %s', name);
  return name;
}

function lastOncallDate(firstFullOncallDate) {
  var lastDay = new Date(firstFullOncallDate.setDate(firstFullOncallDate.getDate() + 6));
  var formattedLastDate = (lastDay.getMonth() + 1) + '/' + lastDay.getDate();
  Logger.log('Last date %s', formattedLastDate);
  return formattedLastDate;
}

function extractNameFromEventTitle(title) {
  REPLACE_STRINGS.forEach(function(replaceString) {
    title = title.replace(replaceString, '');
  });
  return title.trim();
}

function getFirstFullOncallDayDate(firstFullOncallDayIndex) {
  var today = new Date();
  var daysAwayFromNextFullOnCallDay = firstFullOncallDayIndex - today.getDay();
  return new Date(today.setDate(today.getDate() + daysAwayFromNextFullOnCallDay));
}

function sendSlackMessage(userId, message) {
  Logger.log(message);
  var directIMChannelId = createDirectIMChannel(userId);
  var url = 'https://slack.com/api/chat.postMessage?channel=' + directIMChannelId + '&text=' + message + '&token=' + getOauthToken();
  var response = UrlFetchApp.fetch(url);
  Logger.log(response);
}

function createDirectIMChannel(userId) {
  var url = 'https://slack.com/api/im.open?user=' + userId + '&token=' + getOauthToken();
  var response = UrlFetchApp.fetch(url);
  var json = response.getContentText();
  var data = JSON.parse(json);
  Logger.log(data);
  var channelId = data.channel.id;
  Logger.log(channelId);
  return channelId;
}

function addUserToChannel(channelId, userId) {
  var url = 'https://slack.com/api/channels.invite?channel=' + channelId + '&user=' + userId + '&token=' + getOauthToken();
  var response = UrlFetchApp.fetch(url);
  Logger.log(response);
}

function getUserId(name) {
  if (!ALL_USERS)  {
    ALL_USERS = getAllUsers();
  }
  for(var i = 0; i < ALL_USERS.length; i++){
    var user = ALL_USERS[i];
    if( user['real_name'] == name ){
      Logger.log(user.id);
      return user.id;
    }
  }
}

function getAllUsers() {
  Logger.log('Getting all users');
  var url = 'https://slack.com/api/users.list?token='+ getOauthToken();
  var response = UrlFetchApp.fetch(url);
  var json = response.getContentText();
  var data = JSON.parse(json);
  return data.members;
}

function setChannelTopic(channelId, topic) {
  var url = 'https://slack.com/api/channels.setTopic?channel=' + channelId + '&topic=' + topic + '&token='+ getOauthToken();
  var response = UrlFetchApp.fetch(url);
  Logger.log(response);
}

function getOauthToken() {
  var properties = PropertiesService.getScriptProperties();
  return properties.getProperty('token');
}

function switchOncallRoutine(team) {
  var fullOncallDate = getFirstFullOncallDayDate(team.firstFullOncallDayIndex);
  var primary = personOnCall(team.primaryOncallCalendarId, fullOncallDate);
  var secondary = personOnCall(team.secondaryOncallCalendarId, fullOncallDate);
  var oncallTill = lastOncallDate(fullOncallDate);
  var channelTopic = 'people oncall: ' + primary + ', ' + secondary + ' till ' + oncallTill;
  setChannelTopic(team.slackAlertsChannelId, channelTopic);

  var primaryId = getUserId(primary);
  Logger.log("Primary User id: " + primaryId);

  var secondaryId = getUserId(secondary);
  Logger.log("Secondary User id: " + secondaryId);

  primaryId && addUserToChannel(team.slackAlertsChannelId, primaryId);
  secondaryId && addUserToChannel(team.slackAlertsChannelId, secondaryId);

  var primaryMessage = encodeURIComponent(
    'hey, you are going to be *primary on-call* till *' + oncallTill + '*. you have been added to <#' + team.slackAlertsChannelId + '|flex-alerts>.' +
    ' secondary on-call is going to be ' + (secondaryId ? '<@' + secondaryId + '>.' : secondary)
  );

  var secondaryMessage = encodeURIComponent(
    'hey, you are going to be *secondary on-call* till *' + oncallTill + '*. you have been added to <#' + team.slackAlertsChannelId + '|flex-alerts>.' +
    ' primary on-call is going to be ' + (primaryId ? '<@' + primaryId + '>.' : primary)
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
