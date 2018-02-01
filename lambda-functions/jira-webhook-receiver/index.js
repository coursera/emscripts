const JiraConnector = require('jira-connector');
const config = require('./config');
const slackUtils = require('./slack-utils');
const { WebClient } = require('@slack/client');

const web = new WebClient(config.slack.api_token);

const getValueOrNameFromArray = (array) => {
  let values = [];

  if (Array.isArray(array)) {
    values = array.map(element => element.value || element.name);
  }

  return values;
};

const testMatch = (valueTest, value, original) => {
  let test = true;

  if (valueTest !== null) {
    if (valueTest instanceof RegExp) {
      test = valueTest.test(Array.isArray(value) ? value.join(',') : value);
    } else if (valueTest instanceof Function) {
      test = valueTest(original || value);
    } else {
      test = Array.isArray(value) ? value.some(v => v === valueTest) : valueTest === value;
    }
  }

  return test;
};

const slackIssue = (slack, issue) => new Promise((resolve, reject) => {
  const message = {
    channel: (slack.channel instanceof Function) ? slack.channel(issue) : slack.channel,
    text: (slack.message instanceof Function) ? slack.message(issue) : slack.message,
    options: {
      reply_broadcast: true,
      attachments: [slackUtils.jiraIssueToAttachment(issue, config.jira.host)],
      username: slack.bot_name || config.slack.bot_name,
      icon_emoji: slack.bot_emoji ? `:${slack.bot_emoji}:` : `:${config.slack.bot_emoji}:`,
    },
  };

  if (config.mode !== 'dryrun') {
    console.log('posting message to slack ', message); // eslint-disable-line no-console
    web.chat.postMessage(message.channel, message.text, message.options, (error) => {
      if (error) {
        console.log('failed to post slack message: ', error); // eslint-disable-line no-console
        reject(error);
      } else {
        console.log(`posted slack message to ${message.channel}`); // eslint-disable-line no-console
        resolve();
      }
    });
  } else {
    console.log('dry run enabled. would have posted message to slack ', message, '\n'); // eslint-disable-line no-console
    resolve();
  }
});

const editIssue = (edits, issue, changelog, webhookEvent) => new Promise((resolve, reject) => {
  const issueOptions = {
    issueKey: issue.key,
    issue: {
      fields: {},
    },
  };

  Object.keys(edits).forEach((edit) => {
    if (edits[edit] instanceof Function) {
      issueOptions.issue.fields[edit] = edits[edit](issue, changelog, webhookEvent);
    } else {
      issueOptions.issue.fields[edit] = edits[edit];
    }
  });

  if (config.mode !== 'dryrun') {
    console.log('edited issue with ', issueOptions); // eslint-disable-line no-console
    const Jira = new JiraConnector(config.jira);
    Jira.issue.editIssue(issueOptions, (err) => {
      if (err) {
        console.log(`Error while update the issue ${issue.key}`, err); // eslint-disable-line no-console
        reject(err);
      } else {
        console.log(`Successfully updated the issue ${issue.key}:`); // eslint-disable-line no-console
        resolve();
      }
    });
  } else {
    console.log('dry run enabled. would have edited issue with %j\n', issueOptions); // eslint-disable-line no-console
    resolve();
  }
});

const testIssue = (issueTest, issue) => {
  let test = true;

  if (issueTest) {
    Object.keys(issueTest).forEach((field) => {
      const value = issue.fields[field];
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          const flat = getValueOrNameFromArray(issue.fields[field]);
          test = test && testMatch(issueTest[field], flat, issue);
        } else if (value.key !== null || value.name !== null) {
          test = test &&
            (testMatch(issueTest[field], issue.fields[field].name, issue) ||
              testMatch(issueTest[field], issue.fields[field].key, issue));
          // console.log(`testing key or name for ${field} with ${issueTest[field]}
          // and ${issue.fields[field].name} or ${issue.fields[field].key} and ${test} is results`);
        } else {
          // if value is an object we didn't expect, don't flag a match
          test = false;
        }
      } else {
        test = false;
      }
    });
  }

  return test;
};

const testChangelog = (changelogMatch, changelogValue, issue) => {
  let test = true;

  if (changelogValue && changelogValue.items) {
    changelogValue.items.forEach((change) => {
      if (changelogMatch[change.field] !== null) {
        test = test && testMatch(changelogMatch[change.field], change.toString, issue);
      }
    });
  }

  return test;
};

exports.onReceive = (event, context, callback) => {
  const jiraData = JSON.parse(event.body);
  const { changelog, issue, issue_event_type_name: webhookEvent } = jiraData;
  const followup = { edit: [], slack: [] };

  let promiseChain = Promise.resolve();

  if (!issue) {
    callback(null, { statusCode: 200, body: 'no issue found' });
    return;
  }

  console.log('Issue: %j\n', issue); // eslint-disable-line no-console
  console.log('webhookevent', webhookEvent, '\n'); // eslint-disable-line no-console

  if (changelog) {
    console.log('ChangeLog', changelog, '\n'); // eslint-disable-line no-console
  }

  (config.rules || []).forEach((rule) => {
    let test = true;

    if (rule.if !== null && rule.if.constructor === Object) {
      if (test && rule.if.event) {
        test = test && testMatch(rule.if.event, webhookEvent);
      }

      if (test && rule.if.issue) {
        if (webhookEvent === 'issue_created' || webhookEvent === 'issue_moved') {
          test = testIssue(rule.if.issue, issue);
        } else if (webhookEvent === 'issue_updated') {
          test = testChangelog(rule.if.issue, changelog, issue);
        }
      }
    }

    if (test) {
      if (rule.then.edit) {
        followup.edit.push(rule.then.edit);
      }

      if (rule.then.slack) {
        followup.slack.push(rule.then.slack);
      }
    }

    if (test) {
      console.log(`rule passed for "${rule.description}"\n`); // eslint-disable-line no-console
    } else if (config.mode === 'dryrun') {
      console.log(`rule failed for "${rule.description}"\n`); // eslint-disable-line no-console
    }
  });

  if (followup.edit.length > 0) {
    const edits = followup.edit.reduce((x, y) => Object.assign(x, y));
    promiseChain = promiseChain.then(editIssue(edits, issue, changelog, webhookEvent));
  }

  if (followup.slack.length > 0) {
    followup.slack.forEach((slack) => {
      promiseChain = promiseChain.then(slackIssue(slack, issue));
    });
  }

  promiseChain.then(() => callback(null, { statusCode: 200, body: 'webhook ran without error' }), (error) => {
    console.error(error); // eslint-disable-line no-console
    callback(null, { statusCode: 200, body: 'webhook had an error' });
  });
};

if (require.main === module) {
  const jiraHooks = [
    {
      issue: {
        fields: {
          project: { key: 'PARTNER', name: 'team tickets' },
          priority: { name: 'Major (P3)' },
          // status: { name: 'Resolved' },
          // resolution: { name: 'fixed' },
          assignee: { name: 'clee', key: 'clee' },
          // duedate: '2018-11-20',
          issuetype: { name: 'Bug' },
          components: [],
        },
      },
      /*
      changelog: {
        items: [{
          field: 'priority',
          toString: 'Critical',
        }],
      },
      */
      type: 'issue_created',
    },
  ];

  jiraHooks.forEach((jiraHook) => {
    const json = JSON.stringify({
      issue_event_type_name: jiraHook.type,
      issue: jiraHook.issue,
      changelog: jiraHook.changelog,
    });
    exports.onReceive({ body: json }, {}, () => {});
  });
}
