# Intro
emscripts is a bucket to organize all tools that would help EMs with their day to day jobs by either automating or enhancing the workflows. These tools could be one-off jobs that could respond to external webhooks or scheduled jobs.

# Tools
Depending on  the needs and requirements, a tool can be of three types. Lambdas hosted on AWS, Slack bots and Google scripts. Each type of a tool is organized under those subfolders

## Lambda Functions
All lambda functions hosted on aws are created under `lambda-functions`. A lambda function can be a one-time function that responds to a webhook or a scheduled job. More details about how a lambda-function can be created and deployed can be found in `lambda-functions/README.md`

## Slack Bots
Slack bots are small nodejs apps that respond to slack's commands or webhooks. Each bot is organized in it's own folder in `slack-bots`

## Google Scripts
These are scheduled scripts that need tighter integration with Google apps like Calendar, Gmail etc. Each script is a file under `google-scripts`

# Guidelines
- Each tool is hosted and deployed independently of others
- No code should be shared across each tool
