/* eslint no-console: 0 */

const JiraConnector = require('jira-connector');
const config = require('./config');


exports.onRun = (event, context, callback) => {
  const Jira = new JiraConnector(config.jira);
  const completed = { failed: 0, success: 0 };
  const tasks = config.tasks;

  const done = () => {
    if (completed.failed + completed.success === tasks.length) {
      callback(null, { statusCode: 200, body: JSON.stringify(completed) });
    }
  };

  const failed = () => {
    completed.failed += 1;
    done();
  };

  const succeeded = () => {
    completed.success += 1;
    done();
  };

  tasks.forEach((task) => {
    Jira.search.search({ jql: task.filter }, (err, results) => {
      if (err) {
        console.error('filter failed: %s\n', task.filter, err);
        failed();
      } else if (results && results.issues && results.issues.length) {
        console.log(task.filter, results.issues.length);
        results.issues.forEach((issue) => {
          const options = {
            issueKey: issue.key,
            issue: {
              update: {},
            },
          };

          if (task.action.comment) {
            options.issue.update.comment = [{ add: { body: task.action.comment } }];
          }

          if (task.action.priority && issue.fields.priority.name !== task.action.priority) {
            options.issue.update.priority = [{ set: { name: task.action.priority } }];
          }

          if (task.action.labels && task.action.labels.length) {
            options.issue.update.labels = [];
            task.action.labels.forEach((label) => {
              options.issue.update.labels.push({ add: label });
            });
          }

          if (task.action.duedate) {
            options.issue.update.duedate = [{ set: task.action.duedate }];
          }

          const confirmed = { failed: 0, succeeded: 0 };

          Jira.issue.editIssue(options, (editErr) => {
            if (editErr) {
              console.error('edit failed: ', options, editErr);
              confirmed.failed += 1;
            } else {
              console.log(options.issueKey, options.issue);
              confirmed.succeeded += 1;
            }

            if (confirmed.failed + confirmed.succeeded === results.total) {
              succeeded();
            }
          });
        });
      } else {
        succeeded();
      }
    });
  });
};

if (require.main === module) {
  exports.onRun({}, {}, console.log);
}
