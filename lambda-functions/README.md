# Lambda Functions
Each lambda function is organized in a seperate folder

## Current Deployed Functions
- jiraOnCreate
  - This function is triggered on creation of Jira Tickets through Jira's outgoing webhook
    - Updates the groups watch based on stakeHolders
    - Updates the due date based on the bug's priority level
- JiraOnInactivity
  - This function will go through all the issues that are older than 30 days and adds the snooze label

# Bundle and Deploy
Each lambda function is deployed by uploading the zip file to the aws lambda console. By uploading
the zip file, nodejs app can depend on any npm package.

## Bundle
- switch to the directory of the lambda function
- run `npm install`
- run `npm run zip`

### Deploy using AWS Console
- visit aws lambda funciton console, select code and upload the zip
- Hit save
- Under the `Actions` dropdown, click `Publish new version`
- Enter optional version name and hit `Publish`

### Deploy using AWS CLI
- Setup AWS CLI: [CLI Setup Instructions](http://docs.aws.amazon.com/cli/latest/userguide/installing.html)
  - Setup Credentials in `~/.aws/credentials`
  - Create config in `~/.aws/config`
    - config helps with setting default values like region
- `aws lambda update-function-code --function-name <FUNCTION_NAME> --zip-file fileb://<PATH>  --publish`

# How to create a Lambda Function with NodeJS
- create a new folder with the lambda function name
- create `index.js`
- create a handler as shown below
  - ```exports.<HANDLER_NAME> = (event, context, callback) => { }```

# Helpful links
[AWS lambda documentation](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html)

[Using packages in nodejs lambda](https://aws.amazon.com/blogs/compute/nodejs-packages-in-lambda/)
