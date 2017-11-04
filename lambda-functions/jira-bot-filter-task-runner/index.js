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

    const jiraOptions = {
        jql: task.filter,
        fields: task.fields || ['id', 'key', 'comment', 'priority', 'created'],
        maxResults: 100, // max is 100
        startAt: startAt
    };

    if (task.expand) {
      jiraOptions.expand = task.expand;
    }

    Jira.search.search(jiraOptions, (err, results) => {
        if (err) {
          console.error('filter failed: %s\n', task.filter, err);
        } else if (results && results.issues && results.issues.length) {
          console.log(`${results.issues.length} issues starting at ${startAt} returned for [ ${task.filter} ]`);
          const filteredIssues = results.issues.filter(
            ConditionChecker.checkConditions(task.conditions || [])
          );

          filteredIssues.forEach(IssueActions.updateIssue(Jira, task));
          filteredIssues.forEach(IssueTransitions.transitionIssue(Jira, task.transition));

          // don't run slack actions if not needed
          if (task.slack && filteredIssues && filteredIssues.length) {
            SlackActions.run(Jira, task, filteredIssues);
          }

          if (results.issues && results.total > results.issues.length + startAt) {
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
