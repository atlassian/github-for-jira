'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('UnitTestDBMigrationTable', 'field3', {
			allowNull: true,
			type: Sequelize.INTEGER
    })
  },
  down: (queryInterface) => {
    return queryInterface.removeColumn('UnitTestDBMigrationTable', 'field3');
  }
}
