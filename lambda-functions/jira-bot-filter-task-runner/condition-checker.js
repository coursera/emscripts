const moment = require('moment');
const config = require('./config');

lastHumanActivityDate = issue => {
  const humanHistories = issue.changelog.histories.filter(history => {
    return config.bots.indexOf(history.author.key) === -1;
  });

  const humanComments = issue.fields.comment.comments.filter(comment => {
    return config.bots.indexOf(comment.author.key) === -1;
  });

  const allHumanActivity = humanComments.concat(humanHistories);
  const mostRecentHumanActivityDate = allHumanActivity.reduceRight((recentDate, activity) => {
    const activityDate = moment(activity.created);
    return activityDate > recentDate ? activityDate : recentDate;
  }, moment(issue.fields.created));

  return mostRecentHumanActivityDate;
};

lastBotCommentDate = issue => {
  const botComments = issue.fields.comment.comments.filter(comment => {
    return config.bots.indexOf(comment.author.key) !== -1;
  });
  let mostRecentBotCommentDate = null;
  if (botComments.length > 0) {
    mostRecentBotCommentDate = botComments.reduceRight((recentDate, comment) => {
      const botCommentDate = moment(comment.created);
      return botCommentDate > recentDate ? botCommentDate : recentDate;
    }, moment(issue.fields.created));
  }

  return mostRecentBotCommentDate;
}

checkCondition = (condition, issue) => {
  let conditionStatus = false;
  const allComments = issue.fields.comment.comments;
  const lastComment = allComments[allComments.length - 1];
  switch (condition.type) {
    case 'lastHumanActivity':
      const daysSinceLastHumanActivity = moment().diff(lastHumanActivityDate(issue), 'days');
      conditionStatus = daysSinceLastHumanActivity >= condition.daysSince;
      break;
    case 'recentCommentTag':
      if (allComments.length > 0) {
        conditionStatus = lastComment.body.indexOf(`#${condition.tag}`) != -1;
      }
      break;
    case 'noRecentCommentTags':
      if (allComments.length > 0) {
        conditionStatus = condition.tags.reduce((aggregatedResult, tag) => {
          return aggregatedResult && (lastComment.body.indexOf(`#${tag}`) === -1)
        }, true);
      } else {
        conditionStatus = true;
      }
      break;
    case 'lastBotActivity':
      const mostRecentBotCommentDate = lastBotCommentDate(issue);
      if (mostRecentBotCommentDate) {
        const daysSinceLastBotActivity = moment().diff(mostRecentBotCommentDate, 'days');
        conditionStatus = daysSinceLastBotActivity >= condition.daysSince;
      } else {
        conditionStatus = true;
      }
      break;

    default:
      console.error(`Invalid condition type used: ${condition.type}`);
  }
  return conditionStatus;
};

exports.checkConditions = conditions => {
  return issue => {
    return conditions.reduce((aggregatedResult, condition) => {
      return aggregatedResult && checkCondition(condition, issue);
    }, true);
  };
};
