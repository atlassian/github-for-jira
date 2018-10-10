const { processPullRequests } = require('../sync/pull-request')
const { processCommits } = require('../sync/commits.js')
const { processBranches } = require('../sync/branches.js')
const limiterPerInstallation = require('../worker/limiter')

// To limit the amount of data stored in Redis for every job
// We store the `node_id` of each repository in the database
// and use that to get only the data we need for the transformations
const getRepo = `query ($node_id:ID!) {
  node(id: $node_id) {
    ... on Repository {
      databaseId
      nameWithOwner
      url
      name
      owner {
        login
      }
    }
  }
}`

module.exports.processSubscriptions = (app, queues) => {
  return async function (job) {
    // This job's installation doesn't match an existing active job,
    // so let's process it!
    app.log.info(`No active jobs for ${job.data.installationId}. Beginning processing...`)
    const github = await app.auth(job.data.installationId)
    const response = await github.query(getRepo, { node_id: job.data.nodeId })
    // transform the graphql node into the REST schema
    const repository = {
      id: response.node.databaseId,
      full_name: response.node.nameWithOwner,
      html_url: response.node.url,
      name: response.node.name,
      owner: response.node.owner
    }
    job.data.repository = repository

    app.log(`processing jobs for ${repository.full_name}`)
    // These processors check for the last cursor,
    // so every time this processor function is called it
    // will be able to pick up where it left off
    // as long as the `/jira/sync` endpoint is not called
    await limiterPerInstallation(processBranches(app))(job)

    await limiterPerInstallation(processPullRequests(app))(job)

    await limiterPerInstallation(processCommits(app))(job)

    return app.log(`Finished processing ${repository.full_name}`)
  }
}
