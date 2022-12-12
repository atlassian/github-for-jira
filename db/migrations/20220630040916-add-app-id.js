'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('GitHubServerApps', 'appId', {
      type: Sequelize.INTEGER,
      allowNull: false
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('GitHubServerApps', 'appId')
  }
}
