/* eslint no-console: 0 */

const config = require('./config');
const WebClient = require('@slack/client').WebClient;
const web = new WebClient(config.slack.api_token);

const done = (callback, responseBody) => {
  callback(null, { statusCode: 200, body: responseBody });
};

exports.onRun = (event, context, callback) => {
  const requestBody = JSON.parse(event.body) || {};

  // If it's a challenge from Slack, send challenge code back as response
  if (requestBody.challenge) {
    return done(callback, requestBody.challenge);
  }

  if (!requestBody.event) {
    return done(callback, 'Done!');
  }

  // Don't post any messages from the bot as it would create inifinite loop
  if (requestBody.event.subtype === 'bot_message') {
    return done(callback, 'Done!');
  }

  if (requestBody.event.type === "app_mention" || requestBody.event.type === "message") {
    // Don't post any messages from the bot as it would create inifinite loop
    if (requestBody.event.bot_id === "BG3Q98K41") {
      return done(callback, 'Done!');
    }

    web.chat.postMessage({ channel: config.slack.channel, text: requestBody.event.text})
    .then((res) => {
      done(callback, 'Posted to slack!');
    })
    .catch(console.error);
  }

  return done(callback);
};
