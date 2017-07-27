applyActions = (task, options) => {
  console.dir(task);
  if (task.action.comment) {
    let body = task.action.comment;
    if (task.action.commentTag) {
      body += `\n\n#${task.action.commentTag}`;
    }
    options.issue.update.comment = [{ add: { body } }];
  }

  if (task.action.priority && issue.fields.priority.name !== task.action.priority) {
    options.issue.update.priority = [{ set: { name: task.action.priority } }];
  }

  if (task.action.labels && task.action.labels.length) {
    options.issue.update.labels = [];
    task.action.labels.forEach(label => {
      options.issue.update.labels.push({ add: label });
    });
  }

  if (task.action.duedate) {
    options.issue.update.duedate = [{ set: task.action.duedate }];
  }
  return options;
};

exports.updateIssue = (Jira, task) => {
  return issue => {
    if (!task.action) {
      return;
    }
    const options = {
      issueKey: issue.key,
      issue: {
        update: {}
      }
    };

    const editOptions = applyActions(task, options);

    Jira.issue.editIssue(editOptions, editErr => {
      if (editErr) {
        console.error('edit failed: ', editOptions, editErr);
      } else {
        console.log(editOptions.issueKey, editOptions.issue);
      }
    });
  };
};