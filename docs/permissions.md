### GitHub App Permissions
Below are the use cases for the permissions requested by the GitHub App, along with a link to the related endpoints and access scopes

#### Repository Content
- Used to scan git commits and branches for Jira issue keys
- [Documentation](https://developer.github.com/v3/apps/permissions/#permission-on-contents)
- Access: `Read-only`

#### Issues
- Used to scan issues and related comments on GitHub for Jira issue keys and to unfurl links to Jira issues in GitHub comments
- [Documentation](https://developer.github.com/v3/apps/permissions/#permission-on-issues)
- Access: `Read` and `Write`

#### Pull Requests
- Used to scan pull requests and related comments on GitHub for Jira issue keys and to unfurl links to Jira issues in pull requests comments
- [Documentation](https://developer.github.com/v3/apps/permissions/#permission-on-pull-requests)
- Access: `Read` and `Write`


### Webhook Subscriptions
To find events that contain Jira issue keys, the integration subscribes to the following webhooks:
- [Commit Comment](https://developer.github.com/v3/activity/events/types/#commitcommentevent)
- [Create](https://developer.github.com/v3/activity/events/types/#createevent)
- [Delete](https://developer.github.com/v3/activity/events/types/#deleteevent)
- [Issue Comment](https://developer.github.com/v3/activity/events/types/#issuecommentevent)
- [Issues](https://developer.github.com/v3/activity/events/types/#issuesevent)
- [Pull Request](https://developer.github.com/v3/activity/events/types/#pullrequestevent)
- [Pull Request Review](https://developer.github.com/v3/activity/events/types/#pullrequestreviewevent)
- [Push](https://developer.github.com/v3/activity/events/types/#pushevent)

### Jira Platform Permissions
Below are the use cases for the Jira API scopes in use by this integration, along with their API documentation link and required scope.

#### Get issue
- Used to retrieve issue titles and bodies to unfurl links in GitHub issues and pull requests
- [Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-api-2-issue-issueIdOrKey-get)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `READ`

#### Get comments
- Used to retrieve issue comments to unfurl links in GitHub issues and pull requests
- [Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-api-2-issue-issueIdOrKey-comment-get)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `READ`

#### Add comment
- Used to add comments to Jira issues from smart commits
- [Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-api-2-issue-issueIdOrKey-comment-post)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `WRITE`

#### Do transition
- Used to perform transitions manually from a transition syntax found in GitHub events
- [Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-api-2-issue-issueIdOrKey-transitions-post)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `WRITE`

#### Add worklog
- Used to add worklogs manually from syntax found in GitHub events
- [Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-api-2-issue-issueIdOrKey-worklog-post)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `WRITE`

#### Delete development information entity
- Used to delete development information from Jira that was removed from GitHub (e.g., when a branch is deleted, the integration can also delete it from Jira)
- [Documentation](https://developer.atlassian.com/cloud/jira/software/rest/#api-rest-devinfo-0-10-repository-repositoryId-entityType-entityId-delete)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `DELETE`

#### Check if data exists for the supplied properties
- Used to check of data exists for a given GitHub installation.
- [Documentation](https://developer.atlassian.com/cloud/jira/software/rest/#api-rest-devinfo-0-10-existsByProperties-get)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `READ`

#### Delete development information by properties
- Used for bulk deletion of development information for a given GitHub installation ID
- [Documentation](https://developer.atlassian.com/cloud/jira/software/rest/#api-rest-devinfo-0-10-bulkByProperties-delete)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `DELETE`

#### Get repository
- Used to verify information exists for a given GitHub repository ID
- [Documentation](https://developer.atlassian.com/cloud/jira/software/rest/#api-rest-devinfo-0-10-repository-repositoryId-get)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `READ`

#### Delete repository
- Used to delete all information for a given repository on GitHub (e.g. if the repository is deleted or removed from a GitHub installation
- [Documentation](https://developer.atlassian.com/cloud/jira/software/rest/#api-rest-devinfo-0-10-repository-repositoryId-delete)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `DELETE`

#### Store development information
- Used to store pull request, branch, and commit data on GitHub that has valid Jira issue keys
- [Documentation](https://developer.atlassian.com/cloud/jira/software/rest/#api-group-Development-Information)
- [App scope](https://developer.atlassian.com/cloud/jira/platform/scopes/) required: `WRITE`
