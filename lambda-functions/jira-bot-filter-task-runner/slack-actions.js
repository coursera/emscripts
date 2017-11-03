const config = require('./config');
const WebClient = require('@slack/client').WebClient;
const web = new WebClient(config.slack.api_token);
const slackUtils = require('./slack-utils');

const findSlackUserName = (email, users) => {
  for (let user of users) {
    if (user.profile.email === email) {
      return user.profile.display_name;
    }
  }
}

const applySlackActions = (issue, task, users) => {
  for(let channel of task.slack.channel) {
    if (channel[0] === '$') {
      let username;

      if (channel === '$jira.assignee') {
        if (issue.fields.assignee) {
          username = findSlackUserName(issue.fields.assignee.emailAddress, users);
        } else {
          username = findSlackUserName(issue.fields.reporter.emailAddress, users);
        }
      } else if (channel === '$jira.reporter') {
        username = issue.fields.reporter.emailAddress;
      }

      if (username) {
        channel = '@' + username;
      } else {
        break;
      }

    } else if (!(channel[0] === '#' || channel[0] === '@')) {
      break;
    }

    const message = {
      channel: channel,
      text: task.slack.message,
      options: {
        reply_broadcast: true,
        //thread_ts: '',
        attachments: [slackUtils.jiraIssueToAttachment(issue, config.jira.host)],
        username: config.slack.bot_name,
        icon_emoji: `:${config.slack.bot_emoji}:`,
      }
    };

    if (config.mode === 'dryrun') {
      console.log(`would post slack message to ${channel}`)
    } else {
      web.chat.postMessage(message.channel, message.text, message.options, (error, res) => {
        if (error) {
          console.log('failed to post slack message: ', error);
        } else {
          console.log(`posted slack message to ${message.channel}`);
        }
      });
    }
  }
};

const getAllSlackUsers = () => {
  return new Promise((resolve, reject) => { 
    web.users.list({presence: false}, (error, res) => {
      if (error) {
        console.log('error', res);
        reject(error);
      } else {
        resolve(res.members);
      }
    });
  });
}

const postToSlack = (task, users) => {
  return issue => {
    if (!task.slack) {
      return;
    }

    applySlackActions(issue, task, users);
  };
};

 
exports.run = (Jira, task, issues) => {
  getAllSlackUsers().then(users => issues.forEach(postToSlack(task, users)), console.log);
}
