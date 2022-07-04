"use strict";

const tableName = "GitHubServerApps";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "gitHubClientSecret", {
			type: Sequelize.TEXT,
			allowNull: false
		});
		await queryInterface.addColumn(tableName, "webhookSecret", {
			type: Sequelize.TEXT,
			allowNull: false
		});
		await queryInterface.addColumn(tableName, "privateKey", {
			type: Sequelize.TEXT,
			allowNull: false
		});
		await queryInterface.removeColumn(tableName, "secrets");
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "gitHubClientSecret");
		await queryInterface.removeColumn(tableName, "webhookSecret");
		await queryInterface.removeColumn(tableName, "privateKey");
		/*
		 * Please note, rollback of following won't work, or will have bugs in the app IF THE APP still use sequalize.encrypt, as data type is different (and allowNull will messup)
		 * Assuming we are using Cryptor for this table in the future, so above concern need not to be worried.
		 * If we switch back to sequalize.encrypt, we will need to use another name for the secret vault column, can't reuse this one (secret).
		 * Having this line merely because to keep the db migration scripts backward/forward compatible, able to roll forward and backwards.
		 */
		await queryInterface.addColumn(tableName, "secrets", {
			type: Sequelize.STRING,
			allowNull: true
		});
	}
};
