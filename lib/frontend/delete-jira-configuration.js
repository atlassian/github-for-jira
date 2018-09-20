const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')

module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e
  const installationId = req.body.installationId
  const jiraClient = await getJiraClient(installationId, installationId, jiraHost)

  await Subscription.uninstall({
    installationId: req.body.installationId,
    host: jiraHost
  })

  await jiraClient.devinfo.migration.undo()

  res.sendStatus(204)
}
