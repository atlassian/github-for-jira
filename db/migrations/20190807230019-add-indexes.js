'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('Subscriptions', {
      fields: ['gitHubInstallationId', 'jiraHost'],
      name: 'Subscriptions_gitHubInstallationId_jiraHost_idx'
    })

    await queryInterface.addIndex('Subscriptions', {
      fields: ['jiraHost'],
      name: 'Subscriptions_jiraHost_idx'
    })

    await queryInterface.addIndex('Subscriptions', {
      fields: ['jiraClientKey'],
      name: 'Subscriptions_jiraClientKey_idx'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Subscriptions', 'Subscriptions_gitHubInstallationId_jiraHost_idx')
    await queryInterface.removeIndex('Subscriptions', 'Subscriptions_jiraHost_idx')
    await queryInterface.removeIndex('Subscriptions', 'Subscriptions_jiraClientKey_idx')
  }
}
