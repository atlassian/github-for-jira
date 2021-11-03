'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
		// TODO - sql query to remove duplicates before adding unique constraint
		await queryInterface.addConstraint('Installations', {
			fields: ['jiraHost', 'clientKey'],
			type: 'unique',
			name: 'unique_jiraHost_and_clientKey'
		});
  },

	down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('ProInstallationsjects', 'unique_jiraHost_and_clientKey')
  }
};
