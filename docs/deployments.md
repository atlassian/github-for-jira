# Showing GitHub deployments in Jira

The GitHub for Jira app automatically makes deployments created against [GitHub's deployment API](https://docs.github.com/en/rest/reference/repos#deployments) visible in Jira issues:

![Deployments in Jira](./images/deployments-in-jira.png)

To associate a deployment with a Jira issue, **the app looks for Jira issue keys in all commit messages on the deployed branch since the last successful deployment**.

Let's look at an example:

![Builds are associated by putting Jira issue keys into commit messages](./images/associating-deployments.png)

We have two feature branches off the `main` branch. Say we have configured our GitHub Actions so that each push on the `main` branch triggers a deployment. 

If we use the Jira issue keys (`JIRA-*`) in the commit messages as shown in the diagram, we would see the failed deployment #6 in the Jira issues `JIRA-1` and `JIRA-2` and deployment #7 in ALL shown Jira issues (because none of the commits have been successfully deployed, yet).

To create deployments as part of a GitHub Actions workflow, you can use [this deployment action](https://github.com/chrnorm/deployment-action), for example. Use the action `chrnorm/deployment-action@releases/v1` to create a deployment and don't forget to use the `chrnorm/deployment-status@releases/v1` to update the state of a deployment.

**The GitHub for Jira app only listens to `deployment_status` events**. Just creating a deployment via the [create deployment API](https://docs.github.com/en/rest/reference/repos#create-a-deployment) (or the `chrnorm/deployment-action@releases/v1 action`) isn't enough. After creating a deployment you need to call the [create deployment status API](https://docs.github.com/en/rest/reference/repos#create-a-deployment-status) (or the `chrnorm/deployment-status@releases/v1` action) at least once to provide a status for that deployment (success, failure, pending, ...).