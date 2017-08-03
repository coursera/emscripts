/* eslint no-console: 0 */

const JiraConnector = require('jira-connector');
const config = require('./config');
const moment = require('moment');
const ConditionChecker = require('./condition-checker');
const IssueActions = require('./issue-actions');
const IssueTransitions = require('./issue-transitions');

const done = (callback) => {
  if (config.mode !== 'dryrun') {
    callback(null, { statusCode: 200, body: '' });
  }
};

runTask = Jira => {
  return task => {
    Jira.search.search(
      {
        jql: task.filter,
        fields: ['id', 'key', 'comment', 'priority', 'created'],
        expand: ['changelog'],
        maxResults: 10000,
        startAt: 0
      },
      (err, results) => {
        if (err) {
          console.error('filter failed: %s\n', task.filter, err);
        } else if (results && results.issues && results.issues.length) {
          console.log(`Number of issues returned for ${task.filter} = ${results.issues.length}`);
          const filteredIssues = results.issues.filter(
            ConditionChecker.checkConditions(task.conditions || [])
          );
          filteredIssues.forEach(IssueActions.updateIssue(Jira, task));
          filteredIssues.forEach(IssueTransitions.transitionIssue(Jira, task.transition));
        } else {
          console.log(`No issues were returned for ${task.filter}`);
        }
      }
    );
  };
};

exports.onRun = (event, context, callback) => {
  const Jira = new JiraConnector(config.jira);
  const tasks = config.tasks;

  tasks.forEach(runTask(Jira));
  if (require.main === module) {
    exports.onRun({}, {}, console.log);
  }
  done(callback);
};
