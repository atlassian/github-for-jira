'use strict';

module.exports = {
	up: async (queryInterface, Sequelize) => {
		return queryInterface.createTable('GithubApps', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER
			},
			githubBaseUrl: {
				allowNull: false,
				type: Sequelize.STRING
			},
			githubApiBaseUrl: {
				allowNull: false,
				type: Sequelize.STRING
			},
			githubServerType: {
				allowNull: false,
				type: Sequelize.ENUM("cloud", "ghe")

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
		return queryInterface.dropTable('GithubApps')
	}
};
