# Contributing

Hi there! We're thrilled that you'd like to contribute to this project. Your ideas are essential for keeping making it better :)

## Contributor License Agreement

Atlassian must have a [Contributor License Agreement (CLA)](https://opensource.atlassian.com/cla) on file from each individual or corporation contributing to our open-source projects. The CLA allows contributors to maintain ownership in the IP of their contributions while granting Atlassian the rights to control and maintain our projects.

Submit an [individual CLA](https://opensource.atlassian.com/individual) or a [corporate CLA](https://opensource.atlassian.com/corporate).

## License & Code of Conduct

Contributions to this project releases to the public under [our open source license](LICENSE).

Please note that this project has a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Getting Started

This app is written in [Typescript](https://www.typescriptlang.org/) and runs on [Node.js](https://nodejs.org/) **v18.x**. 

Please install [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) to easily run the project locally.

## Create your Jira instance

Create a new [free developer instance](https://developer.atlassian.com/platform/marketplace/getting-started/#free-developer-instances-to-build-and-test-your-app) on Jira Cloud.

### Configuring a GitHub App

Create a new [GitHub App](https://github.com/settings/apps), setting the following config:

**Domain** refers to the URL for the local domain obtained after tunneling. If the tunnel is created from `atlas`, then it would be something like `https://__MYDOMAIN__.public.atlastunnel.com`. But if the tunnel is created from `ngrok`, then `https://XXXX-XXX-XXX-XXX-xX.ngrok.io`.

- **GitHub App name**: Anything you want, but it must be unique across GitHub
- **Homepage URL**: `https://github.com/apps/GITHUB_APP_NAME` (The full URL to your GitHub App’s website)
- **Callback URL**: `https://DOMAIN/rest/app/cloud/github-callback`
- **Setup URL**: `https://DOMAIN/github/setup`
- **Webhook URL**: `https://DOMAIN/github/webhooks`
- **Webhook Secret**: `development`

Your new GitHub app will need the following repository permissions & events:

**Repository Permissions**:
+ Actions: Read-only
+ Code scanning alerts: Read-only
+ Contents: Read & Write
+ Dependabot alerts: Read-only
+ Deployments: Read-only
+ Issues: Read & write
+ Metadata: Read-only
+ Pull requests: Read & write
+ Secret scanning alerts: Read-only

**Organization Permissions**:
+ Members: Read-Only

**Subscribe to Events**:
+ Code scanning alert
+ Commit comment
+ Create
+ Delete
+ Dependabot alert
+ Deployment status
+ Issue comment
+ Issues
+ Pull request
+ Pull request review
+ Push
+ Repository
+ Secret scanning alert
+ Workflow run

### Setting up your environment file

The environment files work in a fairly standardized way of having a "global" `.env` that holds information needed across all environments but is not committed. Then we have `NODE_ENV` specific environment files like `.env.development`, `.env.test`, etc, as they are non-sensitive default variables needed for those environments to work.  Since they are committed, please be careful not to add sensitive information to these files - if you need to add sensitive information or you want to overwrite the environment defaults, you can create a `.local` version of that file and that will never be committed. 

Once you've set up your GitHub app and cloned this repo, copy the file `.env.development.local-example` to a new file called `.env.development.local`.  Fill in the blank fields in the file:

+ `APP_ID` and `GITHUB_CLIENT_ID`: Copy these values over from your new GitHub app page.
+ `GITHUB_CLIENT_SECRET`: You'll need to generate a new one on your GitHub app page by hitting the `Generate a new client secret` button. Copy and paste the generated secret.
+ `PRIVATE_KEY_PATH`: You'll also need to generate a new private key on your GitHub app page, download it, move it to the source root of this repo, and set `PRIVATE_KEY_PATH=<your-private-key-name>.pem`
+ `ATLASSIAN_URL`: The URL for the Jira instance you're testing on. If you don't have one now, [please set the value of this variable from the steps mentioned here](#create-your-jira-instance).
+ `APP_KEY`: Your Jira app key - need to be unique for your development app
+ `WEBHOOK_SECRETS`: `["development"]` as previously set up in the GitHub app page.
+ `APP_URL`: The URL for the local domain obtained after tunneling. This should be the same as the `Domain` value set when you [configured your GitHub App](#configuring-a-github-app)
(ex. `https://__MYDOMAIN__.public.atlastunnel.com` or `https://XXXX-XXX-XXX-XXX-xX.ngrok.io`)

Lastly, you need to replace the value of the follow variables in the global `.env` file:

+ `NGROK_AUTHTOKEN`: Your ngrok authtoken.  If you want to use ngrok as a tunnel to test it on your Jira instance, you need an authtoken. Simply [login/signup to ngrok](https://dashboard.ngrok.com/get-started/setup), copy & paste the authtoken into this var.

### Running the app

The first time you run the app, simply run:

```
yarn install # installs node modules
docker-compose up # Spin up docker containers
yarn start #Spin up web server and worker
```

That's it.  Dependant services ran in docker-compose, including redis, postgres and ngrok. And now to run the app (main and worker thread), please run in local `yarn start`.
For tests, run `yarn test`.
If you want to run a different tunneling tool, run `docker-compose up redis postgres localstack cryptor` and `yarn start` instead as it will only bring up the app and its dependencies (redis & postgres).  You can then run you tunnelling tool to point to `http://localhost:8080`.

### Installing the App

Go to your Jira instance that you created earlier and do the following steps:
1. From the header menu, select **Apps** -> **Manage your apps**.
1. Verify the filter is set to `User-installed`, and select **Settings** beneath the User-installed apps table.
1. On the Settings pop-up, add **Enable development mode** and click **Apply**. Refresh the page.
1. On the right side of the header, there should now appear a button **Upload app**. Click it and enter `https://DOMAIN/jira/atlassian-connect.json`
1. Click **Upload**.
1. That's it! You're done. :tada:

### Setting up the App

In your Jira instance, in the `Manage Apps` section, click on your App's button, then click on `Get Started`.  This will bring you to the App's dashboard.  Click the `Add an Organization` button and follow the steps to install the App on GitHub and allow it permission to view your repos.

After this is done, you should see your repos starting to sync in the App's dashboard.

### Accessing Admin Endpoints

There are some admin endpoints that require special permissions (see `viewerPermissionQuery` in [/src/api/backfill.types.ts](/src/routes/api/index.ts)).

To call these endpoints, you must:

* be an admin in a special GitHub org
* create a personal access token in your GitHub settings and pass it in the `Authorization` header as `Bearer <token>`.

## Contributing

Thank you so much for willing to contribute to this project!  

Before you spend time working on something, it might be worth [discussing your changes with other contributors](https://github.com/atlassian/github-for-jira/discussions) before starting for guidance and potentially combining efforts with other members.  Remember to try to keep your changes simple and concise - do not try to fix everything in one Pull Request.  We'd much appreciate multiple smaller PRs over one massive one. We're also here to help, so if you're stuck or blocked, please feel free to reach out.

That being said, here are the steps needed to create a Pull Request for us to review:

1. [Sign the CLA first!](#contributor-license-agreement)
1. Fork the repository.
1. Do your changes either on the main branch or create a new one.
1. Make sure the tests pass on your machine with `yarn test` and the build works with `yarn run precommit`.  If you're adding new functionality, please add tests to reflect this.
1. Commit and Push your changes - verify it passes all checks.
1. Submit your pull request with a detailed message about what's changed.
1. Wait for us to review and answer questions/make changes where requested.
1. Once merged, celebrate with your drink of choice because you've just helped thousands (if not millions) of people get a better experience in both Jira and GitHub! :beers: