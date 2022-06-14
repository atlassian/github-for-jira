'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("Installations", "githubAppId");

		await queryInterface.addColumn("Subscriptions", "gitHubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Installations", "gitHubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});

		await queryInterface.removeColumn("Subscriptions", "gitHubAppId");
	}
};
