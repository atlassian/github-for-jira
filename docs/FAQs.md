# GitHub for Jira FAQs

- [General](#general)
- [Permissions](#permissions)
- [GitHub Enterprise Server](#gitHub-enterprise-server)
- [Smart Commits](#smart-commits)
- [Backfilling Data](#backfilling-data)

## General
<h3>Q: Does the GitHub for Jira app support GitLab?</h3>

**A:** No. If you want to integrate GitLab with your Jira instance, you need to install the [GitLab.com for Jira Cloud app](https://docs.gitlab.com/ee/integration/jira/connect-app.html#install-the-gitlabcom-for-jira-cloud-app-for-self-managed-instances) for self-managed instances.

<h3>Q: Backfilling my data is taking a long time. When will I see my data in Jira?</h3>

**A:** When you connect a GitHub organization to Jira via the GitHub for Jira app, a process called “backfilling” begins. This process looks for issue keys in your historical data in GitHub. If it finds issue keys, it links your development data to existing issues in Jira.

When an organization contains a small amount of data, the backfilling process is relatively fast and may only take a few minutes. But when an organization contains a large amount of data, the backfilling process will take longer. The good news is you can start using issue keys in new branches, commits, and pull requests as soon as you’ve connected a Github organization to Jira - and this new data will be visible in Jira immediately.

<h3>Q: Why can't I see the author, reviewer names, and/or icons in my Jira?</h3>

**A:** In order for the author, reviewer names, and/or icons to appear in the development panel of your Jira issue, the email address associated with your GitHub account should match the address in your Jira account. If these two email addresses are different, then the account names and icons will not show up in Jira. This behavior is similar to smart commits, which also require matching emails.
![Not seeing names/icons](./images/author-icons-in-jira-for-non-matching-atlassian-emails.png)
![Not seeing names/icons](./images/code-in-jira-missing-user.png)
![Not seeing names/icons](./images/issue-board-view-missing-user.png)

## Permissions

<h3>Q: The permission scope for code and metadata suggests data is read to synchronize development information. Is code stored on Jira? Should I be concerned that, were the app to be compromised, an actor could exfiltrate all our code from GitHub?</h3>

**A:** Commits, branches, and merges that occur in a connected GitHub repository will be seen on the dev panel in associated Jira issues. Whenever a commit message includes an issue key, it generates an event that is sent to Jira so the issue specified in the commit message can be updated. Our app needs code access to read commit messages and branch names to correctly link your data to your Jira issues. Our app simply sends data through to Jira, no code is stored during this process.

<h3>Q: Why does the app need metadata access to my repositories?</h3>

**A:** [Read-only access to metadata](https://docs.github.com/en/rest/reference/permissions-required-for-github-apps#metadata-permissions) is a mandatory requirement by GitHub for all GitHub apps. This access makes it possible for GitHub apps to access various read-only endpoints for a number of resources. Our app will be able to see the repository’s code, however, Atlassian takes the security of our software very seriously. We constantly monitor our code for vulnerabilities and have processes in place of making sure that it is safe to use. Additionally, GitHub documentation for metadata permissions states: “These endpoints do not leak sensitive private repository information.” If there are repositories you still don’t want our app to have access to, you have to option to select the repositories you want to grant access to when installing the app or by navigating to your GitHub settings page via the editing icon found on the GitHub configuration page or the connect an org page.

![Edit GitHub settings](./images/edit-github-settings.png)

<h3>Q: What about pull requests, contents and issues? I noticed I need to grant read and write permissions. Why is this needed?</h3>

**A:** This is needed so our app can create links to Jira issues from pull request or issue comments. When you create a comment and include the issue key surrounded by square brackets, our app while ping Jira to see if that issue key exists in a project in Jira and, if it finds a matching issue, will create a link for easy navigation. As for contents, we need the write access so we can create a branch on your request.

![Pull request and issue comment links](./images/read-and-write-permissions-issues-and-prs.png)

<h3>Q: What happens if another change is made to the app in the future that requires new permissions? Can I choose to accept the new permission but ignore previously requested permissions that I don’t want/feel comfortable with?</h3>

**A:** Unfortunately not. GitHub apps are limited in this sense as permissions are not granular.

## GitHub Enterprise Server
<h3>Q: How do I set up a hole in my firewall?</h3>

**A:** Refer to [How the GitHub for Jira app fetches data](https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/#How-the-GitHub-for-Jira-app-fetches-data).

<h3>Q: Why can’t I connect my GitHub Enterprise Server to the GitHub for Jira app?</h3>

**A:** There are a few reasons why you might have trouble connecting your GitHub Enterprise Server account to the GitHub for Jira app:

- **Atlassian IP address ranges need whitelisting** - [Please see our IP allowlist documentation](https://github.com/atlassian/github-for-jira/blob/main/docs/ip-allowlist.md)

- **Reverse proxy support** - GitHub for Jira does not support reverse proxies.

- **Self-signed certificate** - There is a problem with your SSL certificate.

<h3>Q: Do you support reverse proxies?</h3>

**A:** Yes! For more information, please see our documentation about [integrating Jira Software with GitHub Enterprise Server](https://support.atlassian.com/jira-cloud-administration/docs/connect-a-github-enterprise-server-account-to-jira-software/).

<h3>Q: Can I connect multiple GitHub Enterprise Servers or GitHub Apps to Jira?</h3>

**A:** Yes. The GitHub for Jira app allows you to connect multiple GitHub servers. So you can connect more than one internal GitHub instance to a single Jira account.

You can also add multiple GitHub Apps for a connected server to connect any GitHub organizations to Jira. We recommend doing this as GitHub applies rate limits for GitHub Apps. Learn more about [Rate limits for GitHub Apps - GitHub Docs](https://docs.github.com/en/developers/apps/building-github-apps/rate-limits-for-github-apps).

<h3>Q: Can I create one master GitHub App in my GitHub Enterprise Server instance and connect it to multiple Jira instances?</h3>

**A:** No. A GitHub App can only be connected to one Jira instance. This is to limit access and prevent data leaks.

<h3>Q: What’s the difference between creating a GitHub App automatically vs manually?</h3>

**A:** We recommend that you create a GitHub App automatically, as this process is relatively simple. All you need to do is enter an app name and make a few selections - we’ll use a combination of the GitHub API and a manifest file to pre-populate the app creation form for you.

If you want to create a GitHub app manually, you can do so, but the process is less simple. You’ll need to create a GitHub App within your GitHub Enterprise Server account, copy several values from the new app into Jira, and copy several URLs from Jira into the app. [Learn more about manually creating a GitHub App](https://support.atlassian.com/jira-cloud-administration/docs/manually-create-a-github-app/).

<h3>Q: I want to create a GitHub App automatically, but it says my GitHub Enterprise Server must be version 3.1 or higher. Why?</h3>

**A:** There are several reasons you might want to upgrade your GitHub version:

1. **Automatic GitHub App creation:** In version 2.19.18, GitHub resolved an issue that impeded the manifest creation flow in some scenarios when a SameSite cookie policy was applied. Then, in version 3.1 support for callback_url was added, which is required by the GitHub for Jira app. You must be using version 3.1 or higher for the automatic app creation option to work.
2. **Subscribe to GitHub action events:** The GitHub for Jira app subscribes to three events that are dependent upon GitHub Actions: workflow run, deployment status, and code scanning alert. GitHub Actions is available in GitHub Enterprise Server 3.0 or higher.
3. **Stay up-to-date with GitHub releases:** GitHub routinely releases new versions and discontinues support for older versions. We recommend that you regularly update your server version for better performance, improved security, and new features. From September 28, 2022, version 3.2 will have discounted support, while versions 3.3 - 3.6 will have continued support and updates.

<h3>Q: How do I upgrade my GitHub Enterprise version?</h3>

**A:** Learn how to [upgrade GitHub Enterprise Server](https://docs.github.com/en/enterprise-server@3.4/admin/enterprise-management/updating-the-virtual-machine-and-physical-resources/upgrading-github-enterprise-server.

<h3>Q: I rotated the private key and GitHub client secret in a GitHub App in my internal instance. How do I update them in the GitHub for Jira app?</h3>

**A:** Here’s how to update your GitHub client secret or upload a new private key, or do both:

Navigate to the GitHub configuration screen in your Jira instance.

Select the 3 dots to the right of the GitHub App you want to update, then select **Edit**.

Enter a new GitHub client secret, or upload a new private key (or both).

Select **Update**.


<h3>Q: How can I create a new branch in a repository of a different organizations that I have access to? </h3>

**A:** If you are trying to search for a repository of a different organization, then make sure that this specific organization is installed in GitHub for Jira App.
Just check the **Connect a GitHub organization to your Jira site** (`/github/configuration`) page and check if that organization is installed or not.
![Connect GitHub Organization to Jira](./images/connect-gh-org-to-jira.png)

If its not there, make sure you install that organization.
![Install GH4J app in GitHub](./images/install-app-in-github.png)

Once you have installed it, then you will be able to search and create new branch on the repositories of that organization.

## Smart Commits
<h3>Q: I'm trying to use Smart Commits but they don't appear to be working. What am I missing?</h3>

**A:** [[Smart Commits](https://support.atlassian.com/bitbucket-cloud/docs/use-smart-commits/)] make it easier for you and your team to comment on issues, transition issues, and add time tracking. To enable this for your team/s you will need to make sure:

- **The email address in your GitHub account matches the email address in your Jira account:** e.g. mypersonal@email.com in GitHub and mywork@email.com in Jira will prevent smart commits from work. However, mypersonal@email.com and mypersonal@email.com will work.
- **You have unchecked 'Keep my email addresses private' in GitHub:** if this is checked, GitHub will not send your email address as part of the payload when a webhook is fired. Jira treats this as a mismatch between emails and fails to meet to above criteria. To update this setting in GitHub go to your **Settings** > **Emails** and then uncheck the box next to **Keep my email addresses private**.
- **You use the correct naming when transitioning:** if you want to transition an issue from one column to another, please make sure you use the same naming for the column you wish to transition to issue to e.g. if you want to flag an issue as complete and this column is called 'Done' you will need to include #done in your commit messge. #closed/#complete etc will not work unless those words are in fact in your workflow.
- **You aren't trying to 'jump' columns in your workflow:** If transitions aren't working, you may need to make sure you are abiding by the workflow set up by your team's admin e.g. if you have 3 columns 'todo', 'in progress' and 'done' but your admin has applied a rule that specifies issues can't be moved straight from 'todo' to 'done', any smart commit that tries to transition an issue from todo to done will fail. In this scenario, you need to first move your issue to #in-progress.
- **You have enabled time tracking and added to each issue type:** If you aren't seeing time tracking in your issues after adding something like `#time 1w 2d 4h 30m` to your commit message, ask you team's admin to check the site's settings. If they go to **Settings** > **Issue features** > **Time tracking** they will need to make sure that **Copying of comments to work description** is set to **Enabled**. Additionally, they will need to manually add 'Time Tracking' to any issue type (story/bug/task/etc) where this is to be recorded. Go to **Project settings** > **Issue types** and if 'Time tracking' isn't listed under 'Context fields', simply click on it in the right-hand panel and **Save changes**.

## Backfilling Data
<h3>Q: Backfilling my data is taking a long time. When will I see my data in Jira?</h3>

**A:** When you connect a GitHub organization to Jira via the GitHub for Jira app, a process called “backfilling” begins. This process looks for issue keys in your historical data in GitHub. If it finds issue keys, it links your development data to existing issues in Jira.

When an organization contains a small amount of data, the backfilling process is relatively fast and may only take a few minutes. But when an organization contains a large amount of data, the backfilling process will take longer. The good news is you can start using issue keys in new branches, commits, and pull requests as soon as you’ve connected a Github organization to Jira - and this new data will be visible in Jira immediately.

![Restart a backfill from your GitHub configuration screen](./images/restart-backfill.png)
![Select a date to backfill historical data from](./images/select-backfill-date.png)

<h3>Q: Do I have to wait for all data to complete backfilling before I can start using the GitHub for Jira integration?</h3>

**A:** No :) The job of backfilling is to pull in all your historical data so that, if any issue keys were referenced before you installed the app, you will eventually see that data in Jira. This means you can start using the app with your team immediately as the app will start listening and responding to webhook events (real-time data) straight away.

