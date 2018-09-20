## Contributing

[code-of-conduct]: CODE_OF_CONDUCT.md
[fork]: /fork
[license]: LICENSE
[pr]: /compare

[configure-github-app]: https://probot.github.io/docs/development/#configuring-a-github-app
[jira-developer-instance]: https://developer.atlassian.com/platform/marketplace/getting-started/#free-developer-instances-to-build-and-test-your-app
[style]: https://standardjs.com/
[releases]: https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

## Notices
Contributions to this product are [released][releases] to the public under the [project's open source license][license].

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Getting Started
This app is written in [ES6 JavaScript](https://nodejs.org/en/docs/es6/) and runs on [Node.js](https://nodejs.org/). After cloning the repository, install the dependencies by running:

```
$ script/bootstrap
```

This will install `node` and `postgres`, which are required to run the app. You will need to start up the postgres instance, and then run:

```
$ script/db_create
```

This set up the databases and keep their schemas up to date. You can verify that your code is setup correctly by running:

```
$ npm test
```

The next step for running the app locally is to configure a GitHub App. For that you will likely need to use a tool like [ngrok](https://ngrok.com) to expose a URL publicly (referred to as `DOMAIN` in these docs) which will tunnel traffic back to your computer.

#### Configuring a GitHub App

Follow the [Probot docs for configuring up a GitHub App][configure-github-app] skipping the addition of `WEBHOOK_PROXY_URL` to your `.env` file, the only other difference being these values for the GitHub App settings:

- **User authorization callback URL**: `https://DOMAIN/github/callback`
- **Setup URL**: `https://DOMAIN/github/configuration`
- **Webhook URL**: `https://DOMAIN/github/events`

Your new GitHub app will need the following permissions:

+ Repository contents: Read & write
+ Issues: Read & write
+ Repository metadata: Read-only
+ Pull requests: Read & write

It will also need the following event subscriptions:

+ Commit comment
+ Create
+ Delete
+ Issue comment
+ Issues
+ Push
+ Pull request
+ Pull request review

Once you've setup your app, add your `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from your GitHub app page to the `.env` file. You will also need add a `STORAGE_SECRET` to your `.env` file (running `openssl rand -hex 32` should provide a suitable secret).

Finally, set the `APP_URL` env variable to `https://DOMAIN`.

#### Running the application

When you are developing you will prefer to run the app and automatically restart it when you do changes to the source code. In that case you should use:

```
$ npm run dev
```

For production you should just use `npm run start`.


#### Configuring the Jira instance

1. Create a new [free developer instance][jira-developer-instance] on Jira Cloud.
2. From the left sidebar in Jira, select **Settings** -> **Add-ons** -> **Manage add-ons**. (If you're using an older version of Jira, you won't have a left sidebar. Instead, click the **Gear Icon** in the top-right corner and select **Settings**. From there, select **Manage add-ons** from the left sidebar.)
3. Scroll down to beneath the User-installed add-ons table and select **Settings**.
4. On the Settings pop-up, add **Enable development mode** and click **Apply**.
5. From the right header, select **Upload add-on** and enter `https://DOMAIN/jira/atlassian-connect.json`.
6. Click **Upload**.
7. That's it! You're done. :tada:

## Submitting a pull request

1. [Fork][fork] and clone the repository
1. Configure and install the dependencies: `npm install`
1. Make sure the tests pass on your machine: `npm test`, note: these tests also apply the linter, so no need to lint seperately
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change, add tests, and make sure the tests still pass
1. Push to your fork and [submit a pull request][pr]
1. Pat your self on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Follow the [style guide][style] which is using standard. Any linting errors should be shown when running `npm test`
- Write and update tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Work in Progress pull request are also welcome to get feedback early on, or if there is something blocked you.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
