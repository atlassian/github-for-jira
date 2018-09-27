const { Subscription } = require('../models')
const getJiraClient = require('../jira/client')

module.exports = async (req, res) => {
  const jiraHost = req.query.xdm_e

  const jiraClient = await getJiraClient(null, 'uninstalling', jiraHost)
  await jiraClient.devinfo.installation.delete(req.body.installationId)

  await Subscription.uninstall({
    installationId: req.body.installationId,
    host: jiraHost
  })

  res.sendStatus(204)
}
