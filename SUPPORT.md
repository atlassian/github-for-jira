# Questions? Need help? You've come to the right place

This file will help you troubleshoot the common issues that can occur with the GitHub for Jira integration.
If you're still having troubles after reading through this file, look up your problem or similar in [Issues](https://github.com/atlassian/github-for-jira/issues) or [Create a new Issue](https://github.com/atlassian/github-for-jira/issues/new) if it doesn't already exist.

## Table of Contents

- [App is not responding](#app-is-not-responding)
- [Sync status not reaching complete](#sync-status-not-reaching-complete)
  - [Sync Status Definitions](#sync-status-definitions)
  - [Exceeded issue key reference limit](#referencing-too-many-issues)
- [Nothing showing up in Jira](#nothing-showing-up-in-jira)
- [Workflow transitions are not running](#workflow-transitions-are-not-running)
- [Unmapped deployment environments](#my-deployments-are-showing-up-as-unmapped)

## The app is not responding

After installing the integration, clicking "Getting started" in Jira can lead to a page that shows a GitHub error page with the message `App is not responding. Wait or cancel.`

Uninstalling and reinstalling the integration is the most common fix for this.

1. Click **Uninstall** from the Manage Apps page of your Jira settings.
2. Visit the Atlassian Marketplace and install the [GitHub for Jira app](https://marketplace.atlassian.com/apps/1219592/github-for-jira?hosting=cloud&tab=overview).


## Sync status not reaching complete

After installing the integration, your sync status should move from `PENDING` to `IN PROGRESS` to `COMPLETE`.

You can check your sync status in the integration settings:

**Jira Settings** -> **Apps** -> **Manage Apps** -> **GitHub** -> **Get started**

### Sync status definitions

| Status   | Definition                 |
|----------|----------------------------|
| PENDING  | The backfilling of historical data has not started.  |
| IN PROGRESS   | The backfilling of historical data has started and is still in progress. Over time, more and more historical data will show up in Jira, and the integration will work for new data sent in. |
| COMPLETE | The backfilling of historical data has finished. Historical data will be displayed in Jira. |
| FAILED   | The backfilling of historical data hit an error and stopped without completing. Partial historical data may appear in Jira. |

The time it takes to complete the sync will depend on the size of your GitHub organization, especially the number of commits in your repositories. Since the sync scans branches, commits and pull requests for every repository in your installation, be mindful that selecting "All Repositories" will perform a scan of every repository in your account, including forks. If your repositories have a lot of commits, the process can take hours or even days to complete.

Because everyone's repository histories are different, it's difficult to determine how long the scan should take for a specific installation, but on average the sync can process around 100 commits per second. If it's still stuck in `IN PROGRESS` after a few hours, please check your installation for any large repositories first and attempt a full re-sync:

1. Check that you have given permission to the repositories you want to access from Jira:
   a. For GitHub Cloud customers, open the GitHub app settings in GitHub.
   b. For GitHub Enterprise Server customers, navigate to the settings of the GitHub app in your GitHub Enterprise Server account.
2. From the settings page, select **Install App** in the left panel. Then select the **gear icon** for the organization where you want to modify repository access.
3. In Repository access, select only the repositories you wish to sync to Jira.
4. Select **Save**.
5. Open the integration settings: **Apps** -> **Manage apps** -> **GitHub for Jira** -> **Get started**
6. To restart a backfill:
   a. For GitHub Cloud connections, select the **more options icon** under Settings.
   b. For GitHub Enterprise Server connections, find the GitHub App under the connected server, select the **expand icon**, then select the **more options** icon.
7. Select **Restart backfill**.

This will rediscover all repositories in your installation and start backfilling historical data.

#### Referencing too many issues

`Exceeded issue key reference limit. Some issues may not be linked.`

This warning is shown when a branch or commit includes more than 100 issue keys. When a branch or commit exceeds this limit, we only send the first 100. This is enforced by Jira. This doesn't impact branches or commits that are under the limit or impact the sync status.

## Nothing showing up in Jira

First [check that your sync status has reached `COMPLETE`](#sync-status-not-reaching-complete). No information will be displayed in Jira until the status is `COMPLETE`.

Next check that you're adding your Jira issue keys in your commits, branches, or pull request titles. These are the only places on GitHub where you can put your Jira issue keys that will cause updates to be sent to the Jira issue.

For more information, check out [Using the integration](https://github.com/atlassian/github-for-jira#using-the-integration).

## Workflow transitions are not running

In order for transitions to run from your Smart Commit syntax, a permission requirement must be met.

The email address used for the commit in GitHub that has the transition in the commit message must match an email address that has permission to run the transition in your Jira instance.

You can check the email address on GitHub by adding `.patch` to the end of a commit URL. For example:

`https://github.com/atom/atom/commit/834f8f3d73d84e98a423fe0720abd833d5ca7a87.patch`

> :warning: If you're a GitHub Enterprise Server customer, your GitHub version must be 3.1.x or higher. Otherwise, you won’t be able to receive data for workflow run, deployment status, and code scanning alert events. For more information read our [FAQs documentation](https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/#FAQs).

## My deployments are showing up as unmapped

The app does a mapping between both GitHub and Jira deployments environments names. GitHub does not have a concept of "environment type" and users can name their environments whatever they like. Jira, on the other hand, expects the types of environment, in addition to the environment name. Those can only be development, testing, staging and production. We map GitHub's environments names to one of the Jira environment types. If there's no match, Jira will consider it unmapped. The mapping logic can be found [here](https://github.com/atlassian/github-for-jira/blob/main/src/transforms/transform-deployment.ts#L126), but it simply considers [a set of common values](https://github.com/atlassian/github-for-jira/blob/main/src/transforms/transform-deployment.ts#L141) and their variations, e.g. "prod-east" and "prod-west" are considered variants of "prod".
