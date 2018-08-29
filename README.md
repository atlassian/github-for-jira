# GitHub.com + Jira Cloud integration

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

### Installation
TODO: Add screenshots
1. Sign into your Jira Cloud account
7. That's it! You're done. :tada:

### Connecting your GitHub organization to Jira
As part of the installation flow you should be directed to install the Jira app on GitHub to your organization. You can also manage existing connections or add additional organizations any time within the Manage Add-ons section of your Jira settings.
TODO: Add screenshot

#### Selecting GitHub repositories
If you originally gave the app access to "All repositories" and you've created a new repository on GitHub after installing the GitHub integration for Jira, your new repository will automatically work with the integration. If you installed the app on a subset of repositories, the app will need to manually edit your repository selection by:
1. Sign into your Jira Cloud account
2. From the left sidebar in Jira, select Jira Settings -> Add-ons -> Manage Add-ons -> GitHub -> Configure
3. Select Configure next to the relevant organization

### Authorization
By granting the app access, you are providing the following authorizations to your GitHub and Slack accounts:

#### Jira Permission Scopes
TODO: Complete this list

|Permission scope|Why we need it|
|---|---|
| | |

#### GitHub Permission Scopes
TODO: Complete this list

|Permission scope|Why we need it|
|---|---|
|Read access to code| To sync development information to Jira and power Smart Commit actions|

## Using the integration

### Development information in Jira
TODO: Add docs on how this works

### Take action using Smart Commits
TODO: Add docs on how this works

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
