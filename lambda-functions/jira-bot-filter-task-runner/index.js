/* eslint no-console: 0 */

const JiraConnector = require('jira-connector');
const config = require('./config');
const moment = require('moment');
const ConditionChecker = require('./condition-checker');
const IssueActions = require('./issue-actions');
const SlackActions = require('./slack-actions');
const IssueTransitions = require('./issue-transitions');

const done = (callback) => {
  if (config.mode !== 'dryrun') {
    callback(null, { statusCode: 200, body: '' });
  }
};

runTask = (Jira, startAt = 0) => {
  return task => {
    Jira.search.search(
      {
        jql: task.filter,
        fields: task.fields || ['id', 'key', 'comment', 'priority', 'created'],
        expand: task.expand || ['changelog'],
        maxResults: 100, // max is 100
        startAt: startAt
      },
      (err, results) => {
        if (err) {
          console.error('filter failed: %s\n', task.filter, err);
        } else if (results && results.issues && results.issues.length) {
          console.log(`${results.issues.length} issues returned for [ ${task.filter} ]`);
          const filteredIssues = results.issues.filter(
            ConditionChecker.checkConditions(task.conditions || [])
          );

          filteredIssues.forEach(IssueActions.updateIssue(Jira, task));
          filteredIssues.forEach(IssueTransitions.transitionIssue(Jira, task.transition));

          SlackActions.run(Jira, task, filteredIssues);

          if (results.issues && results.total > results.issues.length + startAt) {
            console.log('running filter again to get more results');
            runTask(Jira, results.issues.length + startAt)(task);
          }
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
  done(callback);
};

if (require.main === module) {
  exports.onRun({}, {}, console.log);
}
