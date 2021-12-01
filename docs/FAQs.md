# GitHub for Jira FAQs

### Permissions

**Q:** The permission scope for code and metadata suggests data is read to synchronize development information. Is code stored on Jira? Should I be concerned that, were the app to be compromised, an actor exfiltrate all our code from GitHub?

**A:** Commits, branches, and merges that occur in a connected GitHub repository will be seen on the dev panel in associated Jira issues. Whenever a commit message includes an issue key, it generates an event that is sent to Jira so the issue specified in the commit message can be updated. Our app needs code access to read commit messages and branch names to correctly link your data to your Jira issues.

<br>

**Q:** Why does the app need metadata access to my repositories? <br>
**A:** [Read-only access to metadata](https://docs.github.com/en/rest/reference/permissions-required-for-github-apps#metadata-permissions) is a mandatory requirement by GitHub for all GitHub apps. This access makes it possible for GitHub apps to access various read-only endpoints for a number of resources. Our app will be able to see the repository’s code, however, Atlassian takes the security of our software very seriously. We constantly monitor our code for vulnerabilities and have processes in place of making sure that it is safe to use. Additionally, GitHub documentation for metadata permissions states: “These endpoints do not leak sensitive private repository information.” If there are repositories you still don’t want our app to have access to, you have to option to select the repositories you want to grant access to when installing the app or by navigating to your GitHub settings page via the editing icon found on the GitHub configuration page or the connect an org page.

![Edit GitHub settings](./images/edit-github-settings.png)

<br>

**Q:** What about pull requests and issues? I noticed I need to grant read and write permissions. Why is this needed?
**A:** This is needed so our app can create links to Jira issues from pull request or issue comments. When you create a comment and include the issue key surrounded by square brackets, our app while ping Jira to see if that issue key exists in a project in Jira and, if it finds a matching issue, will create a link for easy navigation.

![Pull request and issue comment links](./images/read-and-write-permissions-issues-and-prs.png)

<br>

**Q:** Why do you need read and **write** access for deployments? It appears that sending deployment data to Jira would only require read access.
**A:** To correctly map the status of your deployments (pending, in progress, successful etc) we need to access the `state` property which only exists on the `deployment_status` webhook event which occurs when a deployment is created. The [GitHub API](https://docs.github.com/en/rest/reference/repos#create-a-deployment-status) requires that GitHub apps have read and write access to listen to deployment creation events. Unfortunately, the GitHub documentation doesn’t specify why write access is needed but we have raised the concern with them. You can follow the discussion [here](https://github.community/t/write-access-to-deployment-creation-events/215078).

<br>

**Q:** I do not wish to give Jira read and write access to deployments. What are the consequences of that? Does it affect existing functionality?
**A:** There are no consequences as such. If you choose to ignore the request for these permissions you will be able to use the integration and will still see branch, commit, pull request, and merge data show up in the dev panel in Jira. However, if you would like to data for builds and deployments, this access will need to be granted.

<br>

**Q:** What happens if another change is made to the app in the future that requires new permissions? Can I choose to accept the new permission but ignore previously requested permissions that I don’t want/feel comfortable with?
**A:** Unfortunately not. GitHub apps are limited in this sense as permissions are not granular.

