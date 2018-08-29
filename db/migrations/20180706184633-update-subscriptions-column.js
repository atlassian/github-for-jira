'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Subscriptions', {
      [Sequelize.Op.or]: [
        {
          jiraHost: null
        },
        {
          gitHubInstallationId: null
        }
      ]
    })

    await queryInterface.changeColumn('Subscriptions', 'gitHubInstallationId', {
      allowNull: false,
      type: Sequelize.INTEGER
    })

    await queryInterface.changeColumn('Subscriptions', 'jiraHost', {
      allowNull: false,
      type: Sequelize.STRING
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Subscriptions', 'gitHubInstallationId', {
      type: Sequelize.INTEGER
    })

    await queryInterface.changeColumn('Subscriptions', 'jiraHost', {
      type: Sequelize.STRING
    })
  }
}
