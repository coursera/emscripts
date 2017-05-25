'use strict';

const request = require('request');
const moment = require('moment');
const JiraConnector = require('jira-connector');
const config = require('./config');

exports.onInactivity = (event, context, callback) => {
  const Jira = new JiraConnector(config.jira);

  Jira.search.search({'jql': config.inactive.filter}, (err, results) => {
    if(err) {
      console.error('inactive filter failed', err);
    } else {
      for(let issue of results.issues) {

        const options = {
          issueKey: issue.key,
          issue: {
            fields: {
              labels: (issue.fields.labels || []).concat(config.inactive.label)
            },
            update: {
              comment: [{
                add: {
                  body: config.inactive.comment
                }
              }]
            }
          }
        }

        const confirmed = {failed:0, succeeded:0};

        Jira.issue.editIssue(options, (err) => {
          if (err) {
            confirmed.failed++;
          } else {
            confirmed.succeeded++;
          }

          if (confirmed.failed + confirmed.succeeded === results.total) {
            callback(null, {statusCode: 200, body: JSON.stringify(confirmed)});
          }
        });
      }
    }
  });
};

if (require.main === module) { 
  exports.onInactivity({}, {}, console.log);
}
