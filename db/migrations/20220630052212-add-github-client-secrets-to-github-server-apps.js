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
		await queryInterface.changeColumn(tableName, "secrets", {
			type: Sequelize.BLOB,
			allowNull: true
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "encryptedGitHubClientSecret");
		await queryInterface.removeColumn(tableName, "encryptedWebhookSecret");
		await queryInterface.removeColumn(tableName, "encryptedPrivateKey");
		//Don't want to do this, it might cause db issue on empty column for those new records
		//await queryInterface.changeColumn(tableName, "secrets", {
		//  type: Sequelize.BLOB,
		//	allowNull: false
		//});
	}
};
