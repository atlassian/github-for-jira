"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn("Installations", "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: null
		});

		await queryInterface.changeColumn("Subscriptions", "gitHubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: null
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn("Installations", "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});

		await queryInterface.changeColumn("Subscriptions", "gitHubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	}
};
