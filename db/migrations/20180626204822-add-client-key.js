
module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn('Installations', 'clientKey', {
    type: Sequelize.STRING,
    allowNull: false,
  }),

  down: (queryInterface) => queryInterface.removeColumn('Installations', 'clientKey'),
};
