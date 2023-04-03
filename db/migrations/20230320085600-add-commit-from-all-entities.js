'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("RepoSyncStates", "branchFrom", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "pullFrom", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "buildFrom", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "deploymentFrom", { type: Sequelize.DATE, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("RepoSyncStates", "branchFrom");
    await queryInterface.removeColumn("RepoSyncStates", "pullFrom");
    await queryInterface.removeColumn("RepoSyncStates", "buildFrom");
    await queryInterface.removeColumn("RepoSyncStates", "deploymentFrom");
  }
};
