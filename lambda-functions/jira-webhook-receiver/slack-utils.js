const moment = require('moment');

const SlackUtils = {

  jiraIssueToAttachment: (issue, host, description, fields) => {
    const attachment = {
      title: issue.fields.summary ? issue.fields.summary : issue.key,
      title_link: `https://${host}/browse/${issue.key}`,
      fallback: `${(issue.fields.summary || '')} https://${host}/browse/${issue.key}`,
      // "thumb_url": issue.fields.project.avatar,
      // "pretext": "",
    };

    if (issue.fields.status && issue.fields.priority) {
      if (/Done|Resolved|Closed/.test(issue.fields.status.name)) {
        attachment.color = 'good';
      } else if (/Critical|Major|Blocker/.test(issue.fields.priority.name)) {
        attachment.color = 'danger';
      } else {
        attachment.color = 'warning';
      }
    }

    if (!issue.fields.resolution && moment(moment.now()).isAfter(issue.fields.duedate)) {
      attachment.color = 'danger';
    }

    if (description) {
      attachment.text = issue.fields.description || '';
    }

    if (fields) {
      attachment.fields = [
        {
          title: 'Assignee',
          value: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
          short: true,
        },
        {
          title: 'Status',
          value: issue.fields.status ? issue.fields.status.name : 'Open',
          short: true,
        },
      ];
    }

    return attachment;
  },

};

module.exports = SlackUtils;
