module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Subscriptions', 'projects', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Subscriptions', 'projects')
  }
}
