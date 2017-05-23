'use strict';

const request = require('request');
const moment = require('moment');

const BASE_URL = 'https://coursera.atlassian.net/rest/api/2/';

const stakeholders_field = 'customfield_10700';
const groups_watch_field = 'customfield_11000';
const business_verticals_field = 'customfield_12200';

function jiraRequest(method, path, jsonBody, callback) {
  const options = {
    method: method,
    url: BASE_URL + path,
    auth: {
      user: process.env.username,
      pass: process.env.password
    },
    'content-type': 'application/json',
    json: jsonBody
  };

  console.log('Username: ', process.env.username);

  request(options, function(error, response, body) {
    if (error) {
      console.log(`error occurred for ${method} ${options.url}: `, error);
    } else {
      console.log(`Response for ${method} ${options.url}:`, response && response.statusCode);
    }
    callback(null, { statusCode: response && response.statusCode, body: body });
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

  return groups;
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

exports.onCreate = (event, context, callback) => {
  console.log('Lambda triggered');

  const jiraData = JSON.parse(event.body);
  const issue = jiraData && jiraData.issue;
  if (!issue) {
    return emptyReturn(callback);
  }

  console.log('Issue: ', issue);
  const jiraIssueUpdate = { fields: {} };
  if (jiraData['issue_event_type_name'] === 'issue_created') {
    jiraIssueUpdate.fields[groups_watch_field] = groupsThatShouldFollowIssue(issue);
    jiraIssueUpdate.fields['duedate'] = duedate(issue);
    jiraRequest('PUT', `issue/${issue.key}`, jiraIssueUpdate, callback);
  } else {
    return emptyReturn(callback);
  }
};
