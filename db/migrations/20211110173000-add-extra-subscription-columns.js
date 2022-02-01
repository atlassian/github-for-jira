"use strict";

const tableName = "Subscriptions";
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, 'rateLimitRemaining', {
			type: Sequelize.INTEGER,
			allowNull: true
		})

		await queryInterface.addColumn(tableName, 'rateLimitReset', {
			type: Sequelize.DATE,
			allowNull: true
		})

		await queryInterface.addColumn(tableName, 'numberOfSyncedRepos', {
			type: Sequelize.INTEGER,
		})

	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn(tableName, 'rateLimitRemaining')
		await queryInterface.removeColumn(tableName, 'rateLimitReset')
		await queryInterface.removeColumn(tableName, 'numberOfSyncedRepos')
	}
};
