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

		await queryInterface.addColumn(tableName, "gitHubBaseUrl", {
			type: Sequelize.STRING,
			allowNull: false
		});

		await queryInterface.addColumn(tableName, "gitHubClientId", {
			type: Sequelize.STRING,
			allowNull: false
		});

		await queryInterface.changeColumn(tableName, 'githubBaseUrl', {
			type: Sequelize.STRING,
			allowNull: true
		});

		await queryInterface.changeColumn(tableName, 'githubClientId', {
			type: Sequelize.STRING,
			allowNull: true
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "gitHubAppName");
		await queryInterface.removeColumn(tableName, "installationId");
		await queryInterface.removeColumn(tableName, "gitHubBaseUrl");
		await queryInterface.removeColumn(tableName, "gitHubClientId");

		await queryInterface.changeColumn(tableName, 'githubBaseUrl', {
			type: Sequelize.STRING,
			allowNull: false
		});

		await queryInterface.changeColumn(tableName, 'githubClientId', {
			type: Sequelize.STRING,
			allowNull: false
		});
	}
};
