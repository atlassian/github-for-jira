module.exports = async (req, res) => {
  return res.status(200)
    .json({
      name: 'GitHub Integration',
      description: 'Application for integrating with GitHub',
      key: 'com.github.integration',
      baseUrl: `${req.protocol}://${req.get('host')}`,
      lifecycle: {
        installed: '/jira/events/installed',
        uninstalled: '/jira/events/uninstalled',
        enabled: '/jira/events/enabled',
        disabled: '/jira/events/disabled'
      },
      vendor: {
        name: 'GitHub',
        url: 'http://www.github.com'
      },
      authentication: {
        type: 'jwt'
      },
      scopes: [
        'READ',
        'WRITE',
        'ADMIN'
      ],
      apiVersion: 1
    })
}
