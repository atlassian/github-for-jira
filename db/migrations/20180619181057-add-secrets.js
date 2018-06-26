'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Installations', 'secrets', Sequelize.BLOB)
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Installations', 'secrets')
  }
}
