module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('Installations', {
      fields: ['jiraHost'],
      name: 'Installations_jiraHost_idx'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Installations', 'Installations_jiraHost_idx')
  }
}
