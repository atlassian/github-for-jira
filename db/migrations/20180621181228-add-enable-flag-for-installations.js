'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Installations', 'enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    })
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Installations', 'enabled')
  }
}
