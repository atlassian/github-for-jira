'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Installations', 'sharedSecret')
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Installations', 'sharedSecret', Sequelize.STRING)
  }
}
