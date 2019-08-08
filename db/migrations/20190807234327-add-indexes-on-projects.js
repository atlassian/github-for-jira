module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('Projects', {
      fields: ['jiraHost', 'projectKey'],
      name: 'Projects_jiraHost_projectKey_idx'
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Projects', 'Projects_jiraHost_projectKey_idx')
  }
}
