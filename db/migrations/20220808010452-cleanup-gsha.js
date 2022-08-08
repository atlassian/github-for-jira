'use strict';

const tableName = "GitHubServerApps";

module.exports = {
	up: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "githubBaseUrl");
		await queryInterface.removeColumn(tableName, "githubClientId");
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
