# Questions? Need help? You've come to the right place

This file will help you troubleshoot the common issues that can occur with the  GitHub.com + Jira Software integration. 

## Table of Contents

- [App is not responding](#app-is-not-responding)
- [Sync status not reaching complete](#sync-status-not-reaching-complete)
- [Nothing showing up in Jira](#nothing-showing-up-in-jira)
- [Workflow transitions are not running](#workflow-transitions-are-not-running)
- [Getting additional help](#getting-additional-help)

## App is not responding

After installing the integration, clicking "Getting started" in Jira can lead to a page that shows a GitHub error page with the message `App is not responding. Wait or cancel.`

Uninstalling and reinstalling the integration is the most common fix for this.

1. Click **Uninstall** from the Manage Apps page of your Jira settings.
2. Visit the Atlassian Marketplace and install the [GitHub for Jira app](https://marketplace.atlassian.com/apps/1219592/github-for-jira?hosting=cloud&tab=overview).

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Sync status not reaching complete

After installing the integration, your sync status should move from `PENDING` to `IN PROGRESS` to `COMPLETE`. 

You can check your sync status in the integration settings:

**Jira Settings** -> **Apps** -> **Manage Apps** -> **GitHub** -> **Get started**

### Sync status definitions

| Status   | Definition                 |
|----------|----------------------------|
| PENDING  | The sync has not started.  |
| IN PROGRESS   | The sync has started and is still in progress. No information will be displayed in Jira. |
| COMPLETE | The sync has finished. Information will be displayed in Jira. |
| STALLED  | The sync has not finished but has stopped being updated. Partial information may appear in Jira. |
| FAILED   | The sync hit an error and stopped without completing. Partial information may appear in Jira. |

The time it takes to complete the sync will depend on the size of your installation. Since the sync scans commits for every repository in your installation, be mindful that selecting "All Repositories" will perform a scan of every repository in your account, including forks. If you have repositories with hundreds of thousands of forks (e.g. a fork of the Linux repo), the scan might take several hours to complete.

Because everyone's repository histories are different, it's difficult to determine how long the scan should take for a specific installation, but on average the sync can process around 100 commits per second. If it's still stuck in `IN PROGRESS` after a few hours, please check your installation for any large repositories first and attempt a full re-sync:

1. Open the GitHub Apps settings in GitHub.
2. Click **Configure** in Jira.
3. In Repository access, select only the repositories you wish to sync to Jira.
4. Click **Save**
5. Open the integration settings: **Jira Settings** -> **Add-ons** -> **Manage Add-ons** -> **GitHub** -> **Get started**
6. Under **Retry**, click the dropdown and select "Full", then click **Submit**

This will rediscover all repositories in your installation and start a new sync.

#### Referencing too many issues

`Exceeded issue key reference limit. Some issues may not be linked.`

This warning is shown when a branch or commit includes more than 100 issue keys. When a branch or commit exceeds this limit, we only send the first 100. This is enforced by Jira. This doesn't impact branches or commits that are under the limit or impact the sync status.

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Sync is STALLED

When an IN PROGRESS sync hasn't made progress for some time, the status will move to STALLED. This can happen when an unexpected error occurs.

To resolve, follow these steps to resume the sync:

1. Open the integration settings: **Jira Settings** -> **Add-ons** -> **Manage Add-ons** -> **GitHub** -> **Get started**
2. Under **Retry**, click the dropdown and select "Normal", then click **Submit**

If the sync returns to the STALLED status, [contact GitHub Support for additional help](#getting-additional-help).

## Nothing showing up in Jira

First [check that your sync status has reached `COMPLETE`](#sync-status-not-reaching-complete). No information will be displayed in Jira until the status is `COMPLETE`.

Next check that you're adding your Jira issue keys in your commits, branches, or pull request titles. These are the only places on GitHub where you can put your Jira issue keys that will cause updates to be sent to the Jira issue.

For more information, check out [Using the integration](https://github.com/integrations/jira#using-the-integration).

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Workflow transitions are not running

In order for transitions to run from your smart commit syntax, a permissions requirement must be met.

The email address used for the commit in GitHub that has the transition in the commit message must match an email address that has permission to run the transition in your Jira instance.

You can check the email address on GitHub by adding `.patch` to the end of a commit URL. For example:

`https://github.com/atom/atom/commit/834f8f3d73d84e98a423fe0720abd833d5ca7a87.patch`

Still having trouble? [Contact GitHub Support for additional help](#getting-additional-help).

## Getting additional help

Please fill out GitHub's [Support form](https://github.com/contact?form%5Bsubject%5D=Re:+GitHub%2BJira+Integration) and your request will be routed to the right team at GitHub.

Be sure to include the details of any troubleshooting steps you've tried so far.
