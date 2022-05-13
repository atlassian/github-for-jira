'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		return queryInterface.createTable('GitHubServerApps', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER
			},
			uuid: {
				allowNull: false,
				unique: true,
				type: Sequelize.UUID
			},
			githubBaseUrl: {
				allowNull: false,
				type: Sequelize.STRING
			},
			githubClientId: {
				allowNull: false,
				type: Sequelize.STRING
			},
			secrets: {
				allowNull: false,
				type: Sequelize.BLOB
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE
			}
		})
	},

	down: async (queryInterface, Sequelize) => {
		return queryInterface.dropTable('GitHubServerApps')
	}
};
