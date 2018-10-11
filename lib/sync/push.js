const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')

function mapFile (githubFile) {
  // changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
  // on github when a file is renamed we get two "files": one added, one removed
  const mapStatus = {
    added: 'ADDED',
    removed: 'DELETED',
    modified: 'MODIFIED'
  }
  const {
    filename: path,
    status,
    additions: linesAdded,
    deletions: linesRemoved,
    blob_url: url
  } = githubFile
  return {
    path,
    changeType: mapStatus[status] || 'UNKNOWN',
    linesAdded,
    linesRemoved,
    url
  }
}

module.exports.push = robot => {
  return async function (job) {
    const { jiraPayload, installationId, jiraHost, owner, repo } = job.data

    const subscription = await Subscription.getSingleInstallation(jiraHost, installationId)
    if (!subscription) {
      return
    }

    const jiraClient = await getJiraClient(subscription.id, installationId, subscription.jiraHost)

    const github = await robot.auth(installationId)

    for (const commit of jiraPayload.commits) {
      const { data: commitInfo } = await github.repos.getCommit({ owner, repo, sha: commit.hash })
      const { files } = commitInfo
      commit.files = files.map(mapFile)
    }
    jiraPayload.updateSequenceId = Date.now()

    await jiraClient.devinfo.repository.update(jiraPayload)
  }
}
