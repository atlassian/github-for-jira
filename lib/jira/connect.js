const instance = process.env.INSTANCE_NAME

module.exports = async (req, res) => {
  const isHttps = req.secure || req.header('x-forwarded-proto') === 'https'

  return res.status(200)
    .json({
      name: 'GitHub' + (instance ? ` (${instance})` : ''),
      description: 'Application for integrating with GitHub',
      key: 'com.github.integration' + (instance ? `.${instance}` : ''),
      baseUrl: `${isHttps ? 'https' : 'http'}://${req.get('host')}`,
      lifecycle: {
        installed: '/jira/events/installed',
        uninstalled: '/jira/events/uninstalled',
        enabled: '/jira/events/enabled',
        disabled: '/jira/events/disabled'
      },
      vendor: {
        name: 'GitHub',
        url: 'http://github.com'
      },
      authentication: {
        type: 'jwt'
      },
      scopes: [
        'READ',
        'WRITE',
        'ADMIN'
      ],
      apiVersion: 1,
      modules: {
        jiraDevelopmentTool: {
          application: {
            value: 'GitHub'
          },
          capabilities: [
            'commit'
          ],
          key: 'github-development-tool',
          logoUrl: 'https://assets-cdn.github.com/images/modules/logos_page/GitHub-Mark.png',
          name: {
            value: 'GitHub'
          },
          url: 'https://github.com'
        },
        "configurePage": {
          "key": "github-configuration-page",
          "name": {
            "value": "GitHub Configuration"
          },
          "url": "/pages/jira-configuration",
          "conditions": [
            {
              "condition": "addon_property_exists",
              "params": {
                "propertyKey": "configuration",
                "objectKey": "has-repos"
              }
            }
          ]
        },
        "postInstallPage": {
          "key": "github-post-install-page",
          "name": {
            "value": "GitHub Configuration"
          },
          "url": "/pages/jira-configuration",
          "conditions": [
            {
              "condition": "addon_property_exists",
              "invert": true,
              "params": {
                "propertyKey": "configuration",
                "objectKey": "has-repos"
              }
            }
          ]
        }
      }
    })
}
