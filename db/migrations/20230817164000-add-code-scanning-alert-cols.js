'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("RepoSyncStates", "codeScanningAlertFrom", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "codeScanningAlertStatus", { type: Sequelize.ENUM("pending", "complete", "failed"), allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "codeScanningAlertCursor", { type: Sequelize.STRING, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("RepoSyncStates", "codeScanningAlertFrom");
    await queryInterface.removeColumn("RepoSyncStates", "codeScanningAlertStatus");
    await queryInterface.removeColumn("RepoSyncStates", "codeScanningAlertCursor");
  }
};
