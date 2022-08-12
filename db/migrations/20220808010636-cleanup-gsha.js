'use strict';

const tableName = "GitHubServerApps";

module.exports = {
	up: async (queryInterface) => {
		// Staging database is out of sync - workaround so we can deploy to staging without it failing
		try {
			await queryInterface.removeColumn(tableName, "githubBaseUrl");
			await queryInterface.removeColumn(tableName, "githubClientId");
		} catch (err) {}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "githubBaseUrl", {
			type: Sequelize.String,
			allowNull: true
		});
		await queryInterface.addColumn(tableName, "githubClientId", {
			type: Sequelize.String,
			allowNull: true
		});
	}
};
