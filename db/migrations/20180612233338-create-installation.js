'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Installations', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true, type: Sequelize.INTEGER
      },
      jiraHost: {
        type: Sequelize.STRING
      },
      sharedSecret: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Installations')
  }
}
