"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Subscriptions", "backfillSinceDate", { type: Sequelize.DATE, allowNull: true });
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn("Subscriptions", "backfillSinceDate");
	}
};
