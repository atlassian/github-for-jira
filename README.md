# GitHub.com + Jira Software integration

## About
Connect your code with your project management in Jira. A separate Jira subscription is required. With two of your most important tools connected, you'll spend less time managing projects and more time working on them. This integration is an open source project, built and maintained by GitHub.

## Table of Contents
- [Installation and setup](#installation-and-setup)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Connecting your GitHub Organization](#connecting-your-github-organization-to-jira)
  - [Authorization](#authorization)
- [Using the integration](#using-the-integration)
  - [Development information in Jira](#development-information-in-jira)
  - [Take action using Smart Commits](#take-action-using-smart-commits)
- [Migrating from the DVCS connector](#migrating-from-the-dvcs-connector)
- [Need help?](#questions-need-help)
- [Contributing](#contributing)
- [License](#license)

--------

## Installation and setup

### Requirements
This app officially supports GitHub.com and Jira Cloud. Support for GitHub Enterprise and/or Jira server may be considered in the future.

### Installation from Atlassian
TODO: Change staging to production and add in images.

1. Sign into your Jira Cloud account
2. Open the left sidebar by clicking on **Personal Settings**, if the left side bar is not already open. From the left sidebar in Jira, select **Jira Settings** -> **Add-ons** -> **Manage add-ons**. (If you're using an older version of Jira, you won't have a left sidebar. Instead, click the **Gear Icon** in the top-right corner and select **Settings**. From there, select **Manage add-ons** from the left sidebar.)
3. Scroll down to beneath the User-installed add-ons table and select **Settings**.
4. On the Settings pop-up, add **Enable development mode** and click **Apply**.
5. From the right header, select **Upload add-on** and enter `https://jira-integration-production.herokuapp.com/jira/atlassian-connect.json`.
6. Click **Upload**.
7. Click the **Get Started** button to connect your GitHub account.

Next you will need to connext up your GitHub organization to Jira, see the following steps.

### Installation from 
1. Go to https://github.com/marketplace/jira-github
2. ... TODO.

### Connecting your GitHub organization to Jira
As part of the installation flow you should be directed to install the Jira app on GitHub to your organization. You can also manage existing connections or add additional organizations any time within the Manage Add-ons section of your Jira settings.

#### Selecting GitHub repositories
If you originally gave the app access to "All repositories" and you've created a new repository on GitHub after installing the GitHub integration for Jira, your new repository will automatically work with the integration. If you installed the app on a subset of repositories, the app will need to manually edit your repository selection by:
1. Sign into your Jira Cloud account
2. From the left sidebar in Jira, select **Jira Settings** -> **Add-ons** -> **Manage Add-ons** -> **GitHub** -> **Configure**
3. Select Configure next to the relevant organization

### Authorization
By granting the app access, you are providing the following authorizations to your GitHub and Jira accounts:

#### Jira Permission Scopes
Currently the app requires no permission on Jira.

#### GitHub Permission Scopes

|Permission scope|Why we need it|
|---|---|
|**Read** access to metadata| To sync development information to Jira|
|**Read** and **write** access to issues and pull requests| To power Smart Commit actions and unfurl Jira URLs|

## Using the integration

### Development information in Jira
To access the development information in Jira...

### Take action using Smart Commits
Smart commits are documented on the [Atlassian site](https://confluence.atlassian.com/fisheye/using-smart-commits-298976812.html) and allow to you comment on issues on the commit messages. For example: `[JRA-123] fix typo` will be sent through to Jira.

## Migrating from the DVCS connector
Existing users of Jira's built-in DVCS connector that meet the [requirements](#requirements) should migrate to this integration. If you've not yet been prompted to do so, you can manually kick off the migration by:
1. Sign into your Jira Cloud account
2. From the left sidebar in Jira, select Jira Settings -> Applications -> DVCS accounts.
3. Follow the prompt to upgrade your GitHub connection

## Questions? Need help?
Please fill out GitHub's [Support form](https://github.com/contact?form%5Bsubject%5D=Re:+GitHub%2BJira+Integration) and your request will be routed to the right team at GitHub.

## Contributing
Want to help improve the integration between GitHub and Jira? Check out the [contributing docs](CONTRIBUTING.md) to get involved.

## License
The project is available as open source under the terms of the [MIT License](LICENSE).

When using the GitHub logos, be sure to follow the [GitHub logo guidelines](https://github.com/logos).
