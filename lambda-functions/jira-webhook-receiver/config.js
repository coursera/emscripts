module.exports = {
  jira: {
    host: process.env.host,
    basic_auth: {
      username: process.env.username,
      password: process.env.password,
    }
  }
};
