"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Installations", "plainClientKey", { type: Sequelize.STRING, allowNull: true });
		await queryInterface.addColumn("Subscriptions", "plainClientKey", { type: Sequelize.STRING, allowNull: true });
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn("Installations", "plainClientKey");
		await queryInterface.removeColumn("Subscriptions", "plainClientKey");
	}
};
