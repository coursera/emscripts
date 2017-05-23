(wip)
# Lambda Functions
Each lambda function is organized in a seperate folder

# Deploy
Each lambda function is deployed by uploading the zip bundle to the aws lambda console. By uploading the zip bundle, nodejs app can depend on any npm package, bundle it in the zip and deploy.

Mac's regular folder compress will not work.

- switch to the directory of the lambda function
- run the command: `zip -r ../lambda-function.zip *`
- visit aws lambda funciton console, select code and upload the zip
- Hit save
- Under the `Actions` dropdown, click `Publish new version`
- Enter optional version name and hit `Publish`

# How to create a Lambda Function with NodeJS

If the nodejs app doesn't depend on any packages other than `aws-sdk`, then lambda function can be created with live updating the code.

- create a new folder with the lambda function name
- create `index.js`
- export a handler as defined while creating the lambda
- if the function depends on a package, run the command
  - `npm install --prefix=<PATH TO LAMBDA FUNCTION DIR>  <PACKAGE NAME>`
  - this will make sure that npm package is installed in the lambda function directory. when zipped as mentioned in the deploy section, it would include all the dependencies in the bundle

# Helpful links
[AWS lambda documentation](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html)

[Using packages in nodejs lambda](https://aws.amazon.com/blogs/compute/nodejs-packages-in-lambda/)
