'use strict';

const moment = require('moment');
const JiraConnector = require('jira-connector');
const config = require('./config');
const slackUtils = require('./slack-utils');
const WebClient = require('@slack/client').WebClient;
const web = new WebClient(config.slack.api_token);

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

const slackIssue = (issue, changelog, webhookEvent) => {
  return new Promise((resolve, reject) => { 
    let resolutionChange;

    if (changelog && changelog.items) {
      resolutionChange = changelog.items.find(item => item.field === 'resolution');
    }

    if (resolutionChange && config.rules.resolutionExpression.test(resolutionChange.toString)) {
      const message = {
        channel: config.rules.resolutionChannel,
        text: 'awesome! @' + issue.fields.assignee.name + ' just marked an issue as ' + issue.fields.resolution.name,
        options: {
          reply_broadcast: true,
          attachments: [slackUtils.jiraIssueToAttachment(issue, config.jira.host)],
          username: config.slack.bot_name,
          icon_emoji: `:${config.slack.bot_emoji}:`,
        }
      };

      if (config.mode != 'dryrun') {
        console.log('posting message to slack ', message);
        web.chat.postMessage(message.channel, message.text, message.options, (error, res) => {
          if (error) {
            console.log('failed to post slack message: ', error);
            reject(error);
          } else {
            console.log(`posted slack message to ${message.channel}`);
            resolve();
          }
        });
      } else {
        console.log('dry run enabled. would have posted message to slack ', message);
        resolve();
      }
    } else {
      resolve();
    }
  });
}

const editIssue = (issue, changelog, webhookEvent) => {
  return new Promise((resolve, reject) => { 
    const issueOptions = {
      issueKey: issue.key,
      issue: {
        fields: {}
      }
    };
    const Jira = new JiraConnector(config.jira);

    issueOptions.issue.fields[groups_watch_field] = groupsThatShouldFollowIssue(issue);

    if (!changelog || allowDueDateUpdate(changelog, webhookEvent)) {
      issueOptions.issue.fields['duedate'] = duedate(issue);
    }

    if (config.rules.emptyComponentProjectExpression.test(issue.fields.project.key) && (!issue.fields.components || issue.fields.components.length === 0)) {
      issueOptions.issue.fields.components = [{name: config.rules.emptyComponentName}];
    }

    if (config.mode != 'dryrun') {
      console.log('edited issue with ', issueOptions);
      Jira.issue.editIssue(issueOptions, err => {
        if (err) {
          console.log(`Error while update the issue ${issue.key}`, err);
          reject(err);
        } else {
          console.log(`Successfully updated the issue ${issue.key}:`);
          resolve();
        }
      });
    } else {
      console.log('dry run enabled. would have edited issue with ', issueOptions);
      resolve();
    }
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
  console.log('webhookevent', webhookEvent);

  if (webhookEvent === 'issue_created' || webhookEvent === 'issue_updated' || webhookEvent === 'issue_resolved') {
    editIssue(issue, changelog, webhookEvent).then(slackIssue(issue, changelog, webhookEvent)).then(() => callback(null, { statusCode: 200, body: '' }), (error) => { console.log(error); emptyReturn(callback); });
  } else {
    return emptyReturn(callback);
  }
}

if (require.main === module) {
  const issue = {
    'key': 'project-200', 
    'fields': {
      'project': {key: 'project'}, 
      'priority': {name: 'Major'}, 
      'status': {name: 'Resolved'}, 
      'resolution': {name:'fixed'}, 
      'assignee': {name: 'leith'}
    }
  };

  const changelog = {
    items: [{
      'field': 'resolution',
      'toString': 'fixed',
    }]
  }

  exports.onReceive({body:JSON.stringify({'issue_event_type_name': 'issue_updated', 'issue':issue, 'changelog':changelog})}, {}, console.log);
}
