const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')
const transformCommit = require('../transforms/commit')
const { getCommits } = require('./queries')

module.exports.processCommits = robot => {
  return async function (job) {
    const { installationId, jiraHost, repository } = job.data

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)
    // TODO: figure out what Jira Util does
    // const util = getJiraUtil(jiraClient)

    const github = await robot.auth(installationId)
    let commitsData = (await github.query(getCommits, {
      owner: repository.owner.login,
      repo: repository.name,
      per_page: 2
    })).repository.ref.target.history.nodes

    const authors = commitsData.map(item => item.author)

    const commits = commitsData.map(item => {
      // translating the object into a schema that matches our transforms
      return {
        author: item.author,
        authorTimestamp: item.authoredDate,
        fileCount: item.changedFiles,
        sha: item.oid,
        message: item.message,
        url: item.url
      }
    })

    const { data } = transformCommit({ commits, repository }, authors)

    if (!data) {
      // robot.log(`No Jira issue found on commits for ${repository.name}`)
      return
    }

    robot.log('jira commits:', data)
    await jiraClient.devinfo.updateRepository(data)
  }

}