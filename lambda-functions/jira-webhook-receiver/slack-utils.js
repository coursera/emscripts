const moment = require('moment');

const SlackUtils = {

  jiraIssueToAttachment: (issue, host, brief) => {
    var attachment = {
      "title": issue.fields.summary ? issue.key + ': ' + issue.fields.summary : issue.key,
      "title_link": 'https://' + host + '/browse/' + issue.key,
      "fallback": (issue.fields.summary || '') + 'https://' + host + '/browse/' + issue.key,
      //"thumb_url": issue.fields.project.avatar,
      //"pretext": "",
    };

    if (issue.fields.status && issue.fields.priority) {
      attachment.color = /Done|Resolved|Closed/.test(issue.fields.status.name) ? 'good' : 
        /Critical|Major/.test(issue.fields.priority.name) ? 'danger' : 'warning'
    }

    if (!issue.fields.resolution && moment(moment.now()).isAfter(issue.fields.duedate)) {
      attachment.color = 'danger';
    }

    if (!brief) {
      attachment.text = issue.fields.description || '';
      attachment.fields = [
        {
          "title": "Assignee",
          "value": issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
          "short": true 
        },
        {
          "title": "Status",
          "value": issue.fields.status ? issue.fields.status.name : 'Open',
          "short": true 
        }
      ]
    };

    return attachment;
  }
};

module.exports = SlackUtils;
