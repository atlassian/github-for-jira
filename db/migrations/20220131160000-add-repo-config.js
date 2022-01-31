module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable("RepoConfigs", {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true
			},
			githubInstallationId: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			repoId: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			config: {
				type: Sequelize.JSON,
				allowNull: false
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false
			}
		}, {
			uniqueKeys: {
				RepoConfigs_unique_idx: {
					fields: ['githubInstallationId', 'repoId']
				}
			}
		});
	}
};
