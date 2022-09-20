'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('TestDbMigrationTable1', 'field3', {
			allowNull: true,
			type: Sequelize.INTEGER
    })
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('TestDbMigrationTable1', 'field3');
  }
}
