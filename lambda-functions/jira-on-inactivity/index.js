'use strict';

exports.onCreate = (event, context, callback) => {
  console.log('jiraOnInactivity was triggered');
  callback(null, { statusCode: 200, body: 'Processing done' });
}
