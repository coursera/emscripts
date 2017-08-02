const config = require('./config');

applyTransition = (issue, transition) => {
  const transitionId = config.transitionIds[transition.type];
  if (!transitionId) {
    console.error('Unsupported transition type: ', transition.type);
  }

  const options = {
    issueKey: issue.key,
    transition: {
      transition: `${transitionId}`,
      update: {}
    }
  };

  if (transition.type == 'resolve') {
    options.transition.fields = {
      resolution: {
        name: "Won't Fix"
      }
    };
  }

  if (transition.comment) {
    let body = transition.comment;
    if (transition.commentTag) {
      body += `\n\n#${transition.commentTag}`;
    }
    options.transition.update.comment = [{ add: { body } }];
  }

  if (transition.labels) {
    options.transition.labels = [];
    transition.labels.forEach(label => {
      options.transition.labels.push({ add: label });
    });
  }
  return options;
};

exports.transitionIssue = (Jira, transition) => {
  return issue => {
    if (!transition) {
      return;
    }
    const options = applyTransition(issue, transition);
    if (config.mode === 'dryrun') {
      console.log('Dry run enabled. Options issue will be transitioned with: ', options);
    }  else {
      Jira.issue.transitionIssue(options, transitionErr => {
        if (transitionErr) {
          console.error('transition failed: ', options, transitionErr);
        } else {
          console.log(options.issueKey, options.transition);
        }
      });
    }
  };
};
