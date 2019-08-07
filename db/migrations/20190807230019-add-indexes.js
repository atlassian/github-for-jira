'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('Subscriptions', {
      fields: ['gitHubInstallationId', 'jiraHost'],
      name: 'index-on-installation-and-jirahost'
    })

    await queryInterface.addIndex('Subscriptions', {
      fields: ['gitHubInstallationId'],
      name: 'index-on-github-installation-id'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Subscriptions', 'index-on-installation-and-jirahost')
    await queryInterface.removeIndex('Subscriptions', 'index-on-github-installation-id')
  }
}
