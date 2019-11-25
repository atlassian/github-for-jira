module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('Projects', {
      fields: ['jiraHost', 'projectKey'],
      name: 'Projects_jiraHost_projectKey_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('Projects', 'Projects_jiraHost_projectKey_idx');
  },
};
