
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Subscriptions', 'selectedRepositories', {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      allowNull: true
    })

    await queryInterface.addColumn('Subscriptions', 'repoSyncState', {
      type: Sequelize.JSONB,
      allowNull: true
    })

    await queryInterface.addColumn('Subscriptions', 'syncStatus', {
      type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Subscriptions', 'selectedRepositories')
    await queryInterface.removeColumn('Subscriptions', 'repoSyncState')
    await queryInterface.removeColumn('Subscriptions', 'syncStatus')
  }
}
