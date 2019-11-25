
module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn('Installations', 'enabled', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  }),
  down: (queryInterface) => queryInterface.removeColumn('Installations', 'enabled'),
};
