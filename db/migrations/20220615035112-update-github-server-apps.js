"use strict";

const tableName = "GitHubServerApps";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "gitHubAppName", {
			type: Sequelize.STRING,
			allowNull: false
		});

		await queryInterface.addColumn(tableName, "installationId", {
			type: Sequelize.INTEGER,
			allowNull: false
		});

		await queryInterface.renameColumn(tableName, 'githubBaseUrl', 'gitHubBaseUrl');
		await queryInterface.renameColumn(tableName, 'githubClientId', 'gitHubClientId');
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn(tableName, "gitHubAppName");
		await queryInterface.removeColumn(tableName, "installationId");

		await queryInterface.renameColumn(tableName, 'gitHubBaseUrl', 'githubBaseUrl');
		await queryInterface.renameColumn(tableName, 'gitHubClientId', 'githubClientId');
	}
};
