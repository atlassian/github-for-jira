
module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn('Installations', 'secrets', Sequelize.BLOB),

  down: (queryInterface) => queryInterface.removeColumn('Installations', 'secrets'),
};
