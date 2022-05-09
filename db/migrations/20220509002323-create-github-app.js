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
		  type: Sequelize.STRING
		},
		githubApiBaseUrl: {
		  type: Sequelize.STRING
		},
		githubServerType: {
			type: Sequelize.ENUM("cloud", "ghe"),
			allowNull: false

		  },
		githubClientId: {
			type: Sequelize.STRING
		},
		secrets: {
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
