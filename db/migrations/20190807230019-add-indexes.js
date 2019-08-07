'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('Subscriptions', {
      fields: ['gitHubInstallationId', 'jiraHost'],
      name: 'index-on-installation-and-jira-host'
    })

    await queryInterface.addIndex('Subscriptions', {
      fields: ['jiraHost'],
      name: 'index-on-jira-host'
    })

    await queryInterface.addIndex('Subscriptions', {
      fields: ['jiraClientKey'],
      name: 'index-on-jira-client-key'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Subscriptions', 'index-on-installation-and-jira-host')
    await queryInterface.removeIndex('Subscriptions', 'index-on-jira-host')
    await queryInterface.removeIndex('Subscriptions', 'index-on-jira-client-key')
  }
}
