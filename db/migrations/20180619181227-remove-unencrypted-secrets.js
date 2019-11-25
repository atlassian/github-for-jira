
module.exports = {
  up: (queryInterface) => queryInterface.removeColumn('Installations', 'sharedSecret'),

  down: (queryInterface, Sequelize) => queryInterface.addColumn('Installations', 'sharedSecret', Sequelize.STRING),
};
