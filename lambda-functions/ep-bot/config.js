const moment = require('moment');

module.exports = {
  slack: {
    api_token: process.env.slack_bot_token,
    channel: process.env.slack_channel
  }
};
