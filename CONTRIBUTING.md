# Contributing

Hi there! We're thrilled that you'd like to contribute to this project. Your ideas are essential for keeping making it better :)

## Contributor License Agreement

Atlassian must have a [Contributor License Agreement (CLA)](https://opensource.atlassian.com/cla) on file from each individual or corporation contributing to our open-source projects. The CLA allows contributors to maintain ownership in the IP of their contributions while granting Atlassian the rights to control and maintain our projects.

Submit an [individual CLA](https://opensource.atlassian.com/individual) or a [corporate CLA](https://opensource.atlassian.com/corporate).

## License & Code of Conduct

Contributions to this project releases to the public under [our open source license](LICENSE).

Please note that this project has a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Getting Started

This app is written in [Typescript](https://www.typescriptlang.org/) and runs on [Node.js](https://nodejs.org/) **v14.x**. 

Please install [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) to easily run the project locally.

## Create your Jira instance

Create a new [free developer instance](https://developer.atlassian.com/platform/marketplace/getting-started/#free-developer-instances-to-build-and-test-your-app) on Jira Cloud.

### Configuring a GitHub App

Create a new [GitHub App](https://github.com/settings/apps), setting the following config:

- **GitHub App name**: Anything you want, but it must be unique across GitHub.
- **Homepage URL**: `https://DOMAIN`
- **Callback URL**: `https://DOMAIN/github/callback`
- **Setup URL**: `https://DOMAIN/github/setup`
- **Webhook URL**: `https://DOMAIN/github/events`
- **Webhook Secret**: `development`

Your new GitHub app will need the following repository permissions & events:

**Repository Permissions**:
+ Actions: Read & write
+ Contents: Read & write
+ Deployments: Read & write
+ Issues: Read & write
+ Metadata: Read-only
+ Pull requests: Read & write

**Organization Permissions**:
+ Members: Read-Only

**Subscribe to Events**:
+ Commit comment
+ Create
+ Delete
+ Deployment status
+ Issue comment
+ Issues
+ Pull request
+ Pull request review
+ Push
+ Workflow run

### Setting up your `.env` file

Once you've set up your GitHub app and cloned this repo, copy the content from `.env.example` and paste it to a new file called `.env`, with the following configuration:

+ `APP_ID` and `GITHUB_CLIENT_ID`: Copy these values over from your new GitHub app page.
+ `APP_URL`: `https://DOMAIN`
+ `GITHUB_CLIENT_SECRET`: You'll need to generate a new one on your GitHub app page by hitting the `Generate a new client secret` button. Copy and paste the generated secret.
+ `TUNNEL_SUBDOMAIN`: the subdomain you want to use to allow access from the internet to your local machine
+ `PRIVATE_KEY_PATH`: You'll also need to generate a new private key on your GitHub app page, download it, move it to the source root of this repo, and set `PRIVATE_KEY_PATH=<your-private-key-name>.pem`
+ `ATLASSIAN_URL`: The URL for the Jira instance you're testing it. If you don't have one now, please set the value of this variable after going through the step 1 of "Configuring the Jira instance" section of this document.
+ `STORAGE_SECRET`: It needs to be set to a 32 char secret (anything else fails). You can generate one by running `openssl rand -hex 32` in your terminal and paste directly to your .env file.
+ `INSTANCE_NAME`: Your Jira app name - will show as "Github (instance-name)"
+ `WEBHOOK_PROXY_URL`: `https://DOMAIN/github/events`

### Running the app

The first time you run the app, simply run:

```
npm install # installs node modules
docker-compose up # Spin up docker containers
npm run db # Creates DBs and initializes tables
```

That's it.  Everything is ran in docker-compose, including redis, postgres, ngrok and the app (main and worker thread).
If you want to debug, you can connect to the remote port of 9229 for the main thread and 9230 for the worker thread in docker.  Any changes to the code will restart the node server automatically.
For tests, run `npm test`.
If you want to run a different tunneling tool, run `docker-compose up app` instead as it will only bring up the app and its dependencies (redis & postgres).  You can then run you tunnelling tool to point to `http://app:8080`.

### Installing the App

Go to your Jira instance that you created earlier and do the following steps:
1. From the header menu, select **Apps** -> **Manage your apps**.
1. Verify the filter is set to `User-installed`, and select **Settings** beneath the User-installed apps table.
1. On the Settings pop-up, add **Enable development mode** and click **Apply**. Refresh the page.
1. On the right side of the header, there should now appear a button **Upload app**. Click it and enter `https://DOMAIN/jira/atlassian-connect.json`
1. Click **Upload**.
1. That's it! You're done. :tada:

### Setting up the App

In your Jira instance, in the `Manage Apps` section, click on your App's button, then click on `Get Started`.  This will bring you to the App's dashboard.  Click the `Add an Organization` button and follow the steps to install the App on Github and allow it permission to view your repos.

After this is done, you should see your repos starting to sync in the App's dashboard.

### Accessing Admin Endpoints

There are some admin endpoints that require special permissions (see `viewerPermissionQuery` in [/src/api/index.ts](/src/api/index.ts)).

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
1. Make sure the tests pass on your machine with `npm test` and the build works with `npm run build`.  If you're adding new functionality, please add tests to reflect this.
1. Commit and Push your changes - verify it passes all checks.
1. Submit your pull request with a detailed message about what's changed.
1. Wait for us to review and answer questions/make changes where requested.
1. Once merged, celebrate with your drink of choice because you've just helped thousands (if not millions) of people get a better experience in both Jira and Github! :beers:
