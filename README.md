# GitHub For Jira

## About

Connect your GitHub code with your project management in Jira. A separate Jira subscription is required. With two of 
your most important tools connected, you'll spend less time managing projects and more time working on them. This 
integration is an open-source project, built and maintained by [Atlassian](https://atlassian.com).

## Support

For general support inquiries, [please contact the Atlassian Support team](https://support.atlassian.com/contact/#/?inquiry_category=technical_issues&is_cloud=true&product_key=jira-software).  For technical issues, [please create a new issue](https://github.com/atlassian/github-for-jira/issues/new).

## Table of Contents
- [Install app](#install-app)
  - [Requirements](#requirements)
  - [Install from Jira Cloud site](#install-from-jira-cloud-site)
  - [Install from Atlassian Marketplace](#install-from-atlassian-marketplace)
  - [Install from GitHub Marketplace](#install-from-github-marketplace)
- [Configure app](#configure-app)
  - [Connect your GitHub organization to Jira](#connect-your-github-organization-to-jira)
  - [Connect new GitHub repositories](#connect-new-github-repositories)
- [Manage app](#manage-app)
  - [Authorize](#authorize)
    - [Jira permission scopes](#jira-permission-scopes)
    - [GitHub permission scopes](#github-permission-scopes)
  - [Manage Jira subscriptions](#manage-jira-subscriptions)
- [Send data and use the integration](#send-data-and-use-the-integration)
  - [See GitHub development information in Jira](#see-github-development-information-in-jira)
  - [See Jira issues in GitHub](#see-jira-issues-in-github)
  - [See GitHub CI/CD data in Jira](#see-github-cicd-data-in-jira)
  - [How the integration works](#how-the-integration-works)
- [Migrate from the DVCS connector](#migrate-from-the-dvcs-connector)
- [Need help?](#need-help)
- [Contribute](#contribute)
- [License](#license)

## Install app

### Requirements
This app officially supports GitHub.com (all editions including Enterprise) and Jira Cloud. Support for GitHub Enterprise Server
and/or Jira server may be considered in the future.

### Install from Jira Cloud site

This is the recommended approach to install the app into your Jira site and GitHub org.

1. Sign in to your Jira Cloud account.
2. From the top navigation bar in Jira, select **Apps > Find new Apps**. You can also click the **Gear icon** in 
   the top-right corner and select **Apps**. 
3. Search for **GitHub for Jira** and select **Get app**
4. When the app is installed, a flag will pop up in the top-right corner. Click **Get Started** to connect your GitHub 
   account. If you missed this flag, click **Configure integration** from the Apps menu.

Next, you will need to [configure the app](#configure-app).

## Install from Atlassian Marketplace

1. Go to [Atlassian Marketplace](https://marketplace.atlassian.com/apps/1219592/github-for-jira?hosting=cloud&tab=overview).
2. Sign in to your Atlassian account and click **Get it now**.
3. Select your site to install this app, click **Install app**.
4. You will be taken to the app listing on your Jira site, click **Get app**.
5. When the app is installed, a flag will pop up in the top-right corner. Click **Get Started** to connect your GitHub 
   account. If you missed this flag, click **Configure integration** from the Apps menu.

Next, you will need to [configure the app](#configure-app).

### Install from GitHub Marketplace
1. Go to https://github.com/marketplace/jira-software-github.
2. Complete the (free) order for your GitHub Organization.
3. Choose which repositories you want to use with the Jira Integration on the installation settings screen, and click 
   **Install**.
4. You will be directed to a setup page to select your Jira site.
5. Once installation completes you will be redirected to [Atlassian Marketplace](https://marketplace.atlassian.com/apps/1219592/github-for-jira?hosting=cloud&tab=overview) to install the GitHub for Jira app.
6. From there, follow the instructions above to [install from Atlassian Marketplace](#install-from-atlassian-marketplace).

## Configure app

### Connect your GitHub organization to Jira
As part of the installation flow, you should be directed to a **GitHub configuration** screen to configure your GitHub 
organizations in the Jira app.

> :warning: If you are not directed, navigate to the Apps page of your Jira instance and click **Configure integration** under the ”GitHub” heading. If you do not see this, click on **Manage apps** and **Get started** under GitHub for Jira. This will bring you to the app's configuration screen.

Click **Connect GitHub organization** and select the organization and repositories that you would like to connect.

> :warning: If you don’t see your organization click **Install Jira on a new organization** and follow the steps to [install the app on GitHub](#install-app) and allow it permission to view your repositories. You can also manage existing connections or add additional organizations at any time on this same screen.

### Connect new GitHub repositories
If you originally gave the GitHub for Jira app access to "All repositories", and you've created a new repository on GitHub after configuration, your new repository will automatically work with the integration. However, if you installed the app on a subset of repositories, you will need to manually edit your repository selection by:

1. Sign in to your Jira Cloud account
2. From the top navigation bar in Jira, select **Apps > Manage your apps - GitHub for Jira > Get started**.
3. Select **Configure** next to the relevant GitHub organization and add the new repository you want the app to integrate with.

## Manage app

### Authorize
By granting the app access, you are providing the following authorizations to your GitHub and Jira accounts:

#### Jira permission scopes
Read, Write, and Admin for Development Information (branches, commits, and pull requests)

#### GitHub permission scopes

|**Permission scope**|**Why we need it**|
|---|---|
|**Read** access to code & metadata | To sync development information to Jira|
|**Read** and **write** access to issues and pull requests| To power Smart Commit actions and unfurl Jira URLs|
|**Read** and **write** access to actions and deployments| To sync CI/CD (GitHub Actions) information to Jira|

### Manage Jira subscriptions
Additionally, admins of an installation can view and delete GitHub subscriptions to other Jira instances, without having to log in to the Jira instance itself. This is useful if your installation is set up to send Development information to a Jira instance you no longer have access to, or to audit instances that other admins in your org may have previously configured.

To navigate to your Jira subscriptions

1. Click **Connect GitHub organization**.
2. Click the **edit icon** next to the organization.

> :information_source: This only gives you permission to delete the connection to Jira instances. To view development information in that Jira instance, you’ll need to be granted access in Jira.

## Send data and use the integration
### See GitHub development information in Jira
To start seeing your development information from GitHub in Jira, simply add a Jira issue key to your commit message, branch name, or PR title.

For example: the text `[DEV-2095]` will be sent through to Jira and appear in the Development Information section of the Jira issue with the key `DEV-2095`. Any branch, commit, pull request, build and deployment linked to this commit will now appear in Jira. You can find more information on how to reference issues in your development work [here](https://support.atlassian.com/jira-software-cloud/docs/reference-issues-in-your-development-work/).

![Use issue keys to link your development work to Jira](./docs/images/jira-issue.png)

![See development insights in Jira issues and quickly jump into action.](./docs/images/devinfo.png)

### See Jira issues in GitHub
If an issue body contains a valid Jira issue key on your instance, the integration will automatically expand it into a reference link when surrounded in brackets `[]`. For example: [DEV-2095] will be turned into a link to `https://<your-instance>.atlassian.net/browse/DEV-2095`.

This makes it so Jira issues can be linked inside a comment without it interrupting the flow of the comment as a whole.

### See GitHub CI/CD data in Jira
GitHub Actions is a feature from GitHub for automation such as CI/CD. If you’re setting this up for the first time, follow [GitHub Actions Documentation - GitHub Docs](https://docs.github.com/en/actions). If you already have GitHub Actions and want to see CI/CD data from Github in Jira, include the Jira issue key in your commit message, branch name, or PR.

### How the integration works
When a workflow (e.g. GitHub Action) or development event (e.g. pull request, commit, branch) runs, our app receives a webhook from GitHub. We then extract the issue key from the respective branch/commit/PR and send this information to Jira.

## Migrate from the DVCS Connector
Existing users of Jira's built-in DVCS connector that meet the [requirements](https://github.com/atlassian/github-for-jira/blob/main/README.md#requirements) should migrate to this integration. If you've not yet been prompted to do so, you can manually kick off the migration by:

1. Sign in to your Jira Cloud account.
2. From the left sidebar in Jira, select **Jira Settings > Applications > DVCS accounts**.
3. Follow the prompt to upgrade your GitHub connection.

## Need help?
Take a look through the troubleshooting steps in our [support guide](https://github.com/atlassian/github-for-jira/blob/main/SUPPORT.md).

## Contribute
Want to help improve the integration between GitHub and Jira? Check out the [contributing docs](https://github.com/atlassian/github-for-jira/blob/main/CONTRIBUTING.md) to get involved.

## License
The project is available as open source under the terms of the [MIT License](https://github.com/atlassian/github-for-jira/blob/main/LICENSE).

When using the GitHub logos, be sure to follow the [GitHub logo guidelines](https://github.com/logos).