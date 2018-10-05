const instance = process.env.INSTANCE_NAME
const isProd = (instance === 'production')

module.exports = async (req, res) => {
  const isHttps = req.secure || req.header('x-forwarded-proto') === 'https'

  return res.status(200)
    .json({
      name: 'GitHub' + (isProd ? '' : (instance ? (` (${instance})`) : '')),
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
            'branch',
            'commit',
            'pull_request'
          ],
          key: 'github-development-tool',
          logoUrl: 'https://assets-cdn.github.com/images/modules/logos_page/GitHub-Mark.png',
          name: {
            value: 'GitHub'
          },
          url: 'https://github.com'
        },
        postInstallPage: {
          key: 'github-post-install-page',
          name: {
            value: 'GitHub Configuration'
          },
          url: '/jira/configuration',
          conditions: [
            {
              condition: 'addon_property_exists',
              invert: true,
              params: {
                propertyKey: 'configuration',
                objectKey: 'has-repos'
              }
            },
            {
              condition: 'user_is_admin'
            }
          ]
        },
        webSections: [
          {
            key: 'github-addon-menu',
            location: 'admin_plugins_menu',
            name: {
              value: 'GitHub'
            }
          }
        ],
        webItems: [
          {
            key: 'GitHub-addon-link',
            location: 'admin_plugins_menu/github-addon-menu',
            name: {
              value: 'Configuration'
            },
            url: '/jira/configuration'
          }
        ]
      }
    })
}
