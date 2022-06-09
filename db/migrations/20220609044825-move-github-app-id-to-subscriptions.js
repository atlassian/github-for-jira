'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn("Installations", "githubAppId");

		await queryInterface.addColumn("Subscriptions", "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Installations", "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});

		await queryInterface.removeColumn("Subscriptions", "githubAppId");
	}
};
