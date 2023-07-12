"use strict";

const tableName = "Subscriptions";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "avatarUrl", {
			type: Sequelize.STRING,
			allowNull: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn(tableName, "avatarUrl");
	}
};