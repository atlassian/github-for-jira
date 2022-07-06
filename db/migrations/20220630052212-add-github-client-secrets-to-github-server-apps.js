"use strict";

const tableName = "GitHubServerApps";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "encryptedGitHubClientSecret", {
			type: Sequelize.TEXT,
			allowNull: false
		});
		await queryInterface.addColumn(tableName, "encryptedWebhookSecret", {
			type: Sequelize.TEXT,
			allowNull: false
		});
		await queryInterface.addColumn(tableName, "encryptedPrivateKey", {
			type: Sequelize.TEXT,
			allowNull: false
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "encryptedGitHubClientSecret");
		await queryInterface.removeColumn(tableName, "encryptedWebhookSecret");
		await queryInterface.removeColumn(tableName, "encryptedPrivateKey");
	}
};
