# Questions? Need help? You've come to the right place

This file will help you troubleshoot the common issues that can occur with the  GitHub.com + Jira Software integration. 

## Table of Contents

- [App is not responding](#app-is-not-responding)
- [Sync status not reaching complete](#sync-status-not-reaching-complete)
- [Nothing showing up in Jira](#nothing-showing-up-in-jira)
- [Getting additional help](#getting-additional-help)

## App is not responding

After installing the integration, clicking "Getting started" in Jira can lead to a page that shows a GitHub error page with the message `App is not responding. Wait or cancel.`

Uninstalling and reinstalling the integration is the most common fix for this.

1. Click **Uninstall** from the Manage Apps page of your Jira settings.
2. Visit the Atlassian Marketplace and install the [GitHub for Jira app](https://marketplace.atlassian.com/apps/1219592/github-for-jira?hosting=cloud&tab=overview).

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Sync status not reaching complete

After installing the integration, your sync status should move from `PENDING` to `ACTIVE` to `COMPLETE`. 

The sync should take a maximum of ~5 hours. If your sync status is still `ACTIVE` after 5 hours:

1. Open the integration settings: **Jira Settings** -> **Add-ons** -> **Manage Add-ons** -> **GitHub** -> **Get started**
2. Click the **Retry** button

If after another 5 hours your status is still not `COMPLETE`, try selecting just the repositories that Jira needs access to:

1. Open the GitHub Apps settings in GitHub.
2. Click **Configure** on Jira.
3. In Repository access, select only the repositories that Jira needs access to
4. Click **Save**

This will automatically start a new sync.

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Nothing showing up in Jira

Check that you're adding your Jira issue keys in your commits, branches, or pull request titles. These are the only places on GitHub where you can put your Jira issue keys that will cause updates to be sent to the Jira issue.

For more information, check out [Using the integration](https://github.com/integrations/jira#using-the-integration).

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Getting additional help

Please fill out GitHub's [Support form](https://github.com/contact?form%5Bsubject%5D=Re:+GitHub%2BJira+Integration) and your request will be routed to the right team at GitHub.

Be sure to include the details of any troubleshooting steps you've tried so far.