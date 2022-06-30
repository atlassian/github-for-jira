"use strict";

const tableName = "GitHubServerApps";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "gitHubClientSecret", {
			type: Sequelize.STRING,
			allowNull: false
		});
		await queryInterface.addColumn(tableName, "webhookSecret", {
			type: Sequelize.STRING,
			allowNull: false
		});
		await queryInterface.addColumn(tableName, "privateKey", {
			type: Sequelize.STRING,
			allowNull: false
		});
		await queryInterface.removeColumn(tableName, "secrets");
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "gitHubClientSecret");
		await queryInterface.removeColumn(tableName, "webhookSecret");
		await queryInterface.removeColumn(tableName, "privateKey");
	}
};
