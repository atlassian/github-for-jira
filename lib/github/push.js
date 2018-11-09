const { enqueuePush } = require('../transforms/push')

module.exports = async (context, jiraClient) => {
  // Since a push event can have any number of commits
  // and we have to process each one indvidiually to get the
  // data we need for Jira, send this to a background job
  // so we can close the http connection as soon as the jobs
  // are in the queue.
  await enqueuePush(context.payload, jiraClient.baseURL)
}
