const { Subscription } = require('../models')
const { queues } = require('../worker')

module.exports = async (req, res, next) => {
  // if (!req.session.githubToken || !req.session.jiraHost) {
  //   return next(new Error('Unauthorized'))
  // }

  const subscription = await Subscription.getSingleInstallation(req.query.host, req.query.installationId)
  console.log(subscription)
  await subscription.update({ syncStatus: 'PENDING' })

  req.log('Starting Jira sync')

  // TODO: cleaning queues before each request while testing
  queues.discovery.clean(5000)
  queues.pullRequests.clean(5000)
  queues.commits.clean(5000)

  const name = `Discover-${req.query.installationId}`

  queues.discovery.add({ installationId: req.query.installationId, jiraHost: req.query.host }, { jobId: name })

  return res.sendStatus(202)
}
