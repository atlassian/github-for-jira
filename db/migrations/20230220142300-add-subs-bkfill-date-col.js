"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Subscriptions", "lastBackfilledDate", { type: Sequelize.DATE, allowNull: true });
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn("Subscriptions", "lastBackfilledDate");
	}
};
