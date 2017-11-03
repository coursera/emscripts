'use strict';

const moment = require('moment');
const JiraConnector = require('jira-connector');
const config = require('./config');
const slackUtils = require('./slack-utils');

const stakeholders_field = 'customfield_10700';
const groups_watch_field = 'customfield_11000';
const business_verticals_field = 'customfield_12200';

const getStakeHolders = (issue) => {
  const stakeHolderObjs = issue.fields[stakeholders_field] || [];
  const stakeHolders = stakeHolderObjs.map(function(obj) {
    return obj.value;
  }) || [];
  return stakeHolders;
}

const getBusinessVerticals = (issue) => {
  const businessVerticalObjs = issue.fields[business_verticals_field] || [];
  const businessVerticals = businessVerticalObjs.map(function(obj) {
    return obj.value;
  }) || [];
  return businessVerticals;
}

const groupsThatShouldFollowIssue = (issue) => {
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

const duedate = (issue) => {
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

const emptyReturn = (callback) => {
  console.log('Returning without any OP');
  callback(null, { statusCode: 200, body: 'Nothing to process' });
}

const allowDueDateUpdate = (changelog, webhookEvent) => {
  let allowUpdate = false;
  const latestChange = changelog.items.pop();
  if (latestChange.field == 'priority' || webhookEvent == 'issue_created') {
    console.log('Allow duedate update');
    allowUpdate = true;
  }
  return allowUpdate;
}

const slackIssue = (issue) => {
  return new Promise((resolve, reject) => { 
    if (config.rules.resolutionExpression.test(issue.fields.resolution.name)) {
      const message = {
        channel: config.rules.resolutionChannel,
        text: task.slack.message,
        options: {
          reply_broadcast: true,
          attachments: [slackUtils.jiraIssueToAttachment(issue, config.jira.host)],
          username: config.slack.bot_name,
          icon_emoji: `:${config.slack.bot_emoji}:`,
        }
      };

      web.chat.postMessage(message.channel, message.text, message.options, (error, res) => {
        if (error) {
          console.log('failed to post slack message: ', error);
          reject(error);
        } else {
          console.log(`posted slack message to ${message.channel}`);
          resolve();
        }
      });
      //callback(null, { statusCode: 200, body: '' });
    } else {
      resolve();
    }
  });
}

const editIssue = (issue) => {
  return new Promise((resolve, reject) => { 
    const issueOptions = {
      issueKey: issue.key,
      issue: {
        fields: {}
      }
    };
    const issuePriority = issue.fields.priority && issue.fields.priority.name;
    const Jira = new JiraConnector(config.jira);

    issueOptions.issue.fields[groups_watch_field] = groupsThatShouldFollowIssue(issue);

    if (!changelog || allowDueDateUpdate(changelog, webhookEvent)) {
      issueOptions.issue.fields['duedate'] = duedate(issue);
    }

    if (config.rules.emptyComponentProjectExpression.test(issue.project.key) && (!issue.fields.components || issue.fields.components.length === 0)) {
      issueOptions.issue.fields.components = [{name: config.rules.emptyComponentName}];
    }

    Jira.issue.editIssue(issueOptions, err => {
      if (err) {
        console.log(`Error while update the issue ${issue.key}`, err);
        reject(err);
      } else {
        console.log(`Successfully updated the issue ${issue.key}:`);
        resolve();
      }
      //callback(null, { statusCode: 200, body: '' });
    });
  });
}

exports.onReceive = (event, context, callback) => {
  console.log('Lambda triggered');
  const jiraData = JSON.parse(event.body);
  const webhookEvent = jiraData['issue_event_type_name'];
  const issue = jiraData && jiraData.issue;
  const changelog = jiraData.changelog;

  if (!issue) {
    return emptyReturn(callback);
  }

  console.log('Issue: ', issue);
  console.log('ChangeLog', changelog);

  if (webhookEvent === 'issue_created' || webhookEvent === 'issue_updated') {
    editIssue(issue).then(slackIssue(issue));
  } else {
    return emptyReturn(callback);
  }
}
