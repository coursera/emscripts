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

  console.log(`Most recent human activity date for ${issue.key} is ${mostRecentHumanActivityDate}`);

  return mostRecentHumanActivityDate;
};

checkCondition = (condition, issue) => {
  let conditionStatus = false;
  switch (condition.type) {
    case 'lastHumanActivity':
      const daysSinceLastHumanActivity = moment().diff(lastHumanActivityDate(issue), 'days');
      conditionStatus = daysSinceLastHumanActivity >= condition.daysSince;
      break;
    case 'recentCommentTag':
      const allComments = (issue.fields.comment && issue.fields.comment.comments) || [];
      if (allComments.length > 0) {
        conditionStatus = allComments[allComments.length - 1].body.indexOf(condition.tag) != -1;
      }
      break;
    case 'resolution':
      const daysSinceResolution = moment().diff(issue.fields.resolutionDate, 'days');
      conditionStatus = daysSinceResolution >= condition.daysSince;
      break;
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
