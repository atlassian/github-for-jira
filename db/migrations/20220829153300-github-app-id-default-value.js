"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("Installations", "githubAppId");

		await queryInterface.changeColumn("Subscriptions", "gitHubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: null
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Installations", "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});

		await queryInterface.changeColumn("Subscriptions", "gitHubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	}
};
