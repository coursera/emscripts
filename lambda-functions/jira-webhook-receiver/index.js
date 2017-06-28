'use strict';

const AWS = require("aws-sdk");
const moment = require('moment');
const JiraConnector = require('jira-connector');
const config = require('./config');

const stakeholders_field = 'customfield_10700';
const groups_watch_field = 'customfield_11000';
const business_verticals_field = 'customfield_12200';

function sendFlexWakeupCall(issueKey) {
  var sns = new AWS.SNS();
  sns.publish({
    TopicArn: process.env.flexwakeup,
    Message: `Wake up call from lambda. Jira issue ${issueKey} needs immediate attention`
  }, function(err, data) {
    if(err) {
        console.error('error publishing to SNS');
    } else {
        console.info('message published to SNS');
    }
  });
}

function getStakeHolders(issue) {
  const stakeHolderObjs = issue.fields[stakeholders_field] || [];
  const stakeHolders = stakeHolderObjs.map(function(obj) {
    return obj.value;
  }) || [];
  return stakeHolders;
}

function getBusinessVerticals(issue) {
  const businessVerticalObjs = issue.fields[business_verticals_field] || [];
  const businessVerticals = businessVerticalObjs.map(function(obj) {
    return obj.value;
  }) || [];
  return businessVerticals;
}

function groupsThatShouldFollowIssue(issue) {
  if (!issue) {
    return [];
  }

  const stakeHolders = getStakeHolders(issue);
  const businessVerticals = getBusinessVerticals(issue);

  const groups = [];

  if (stakeHolders.length > 0) {
    if (stakeHolders.includes('Learner')) {
      groups.push({ name: 'LearnerServices' });
    }
    if (stakeHolders.includes('Enterprise Admins')) {
      groups.push({ name: 'LearnerOps' });
    }
    if (stakeHolders.includes('Lite Agents (outsourced support)')) {
      groups.push({ name: 'LearnerOps' });
    }
    if (stakeHolders.includes('Partner')) {
      groups.push({ name: 'PartnerOps' });
    }
  }

  if (businessVerticals.length > 0) {
    if (businessVerticals.includes('Enterprise')) {
      groups.push({ name: 'enterprise' });
    }
    if (businessVerticals.includes('Degrees')) {
      groups.push({ name: 'DegreeOps' });
    }
  }

  return groups.concat(issue.fields[groups_watch_field] || []);
}
function duedate(issue) {
  const priority = issue.fields.priority && issue.fields.priority.name;
  let numDaysDue = null;
  switch (priority) {
    case 'Minor (P3)':
      numDaysDue = null;
      break;
    case 'Major (P2)':
      numDaysDue = 30;
      break;
    case 'Critical (P1)':
      numDaysDue = 7;
      break;
    case 'Blocker (P0)':
      numDaysDue = 1;
      break;
  }
  let duedate = null;
  if (numDaysDue) {
    duedate = moment().add(numDaysDue, 'days').format('YYYY-MM-DD');
  }
  console.log('Duedate: ', duedate);
  return duedate;
}

function emptyReturn(callback) {
  console.log('Returning without any OP');
  callback(null, { statusCode: 200, body: 'Nothing to process' });
}

exports.onReceive = (event, context, callback) => {
  console.log('Lambda triggered');
  const Jira = new JiraConnector(config.jira);


  const jiraData = JSON.parse(event.body);
  const issue = jiraData && jiraData.issue;
  if (!issue) {
    return emptyReturn(callback);
  }

  const issueOptions = {
    issueKey: issue.key,
    issue: {
      fields: {}
    }
  }
  console.log('Issue: ', issue);

  if (jiraData['issue_event_type_name'] === 'issue_created' ||
      jiraData['issue_event_type_name'] === 'issue_updated') {

    const issuePriority = issue.fields.priority && issue.fields.priority.name;

    if (issue.fields.issuetype.name == 'Bug' && issuePriority == 'Blocker (P0)') {
      sendFlexWakeupCall(issue.key);
    }

    issueOptions.issue.fields[groups_watch_field] = groupsThatShouldFollowIssue(issue);
    issueOptions.issue.fields['duedate'] = duedate(issue);
    Jira.issue.editIssue(issueOptions, (err) => {
      if (err) {
        console.log(`Error while update the issue ${issue.key}`, err);
      } else {
        console.log(`Successfully updated the issue ${issue.key}:`);
      }
      callback(null, {statusCode: 200, body: '' });
    })
  } else {
    return emptyReturn(callback);
  }
};
