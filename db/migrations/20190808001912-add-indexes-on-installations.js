module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('Installations', {
      fields: ['jiraHost'],
      name: 'Installations_jiraHost_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('Installations', 'Installations_jiraHost_idx');
  },
};
