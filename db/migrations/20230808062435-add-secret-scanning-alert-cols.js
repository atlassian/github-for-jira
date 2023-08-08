'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("RepoSyncStates", "secretScanningAlertFrom", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "secretScanningAlertStatus", { type: Sequelize.ENUM("pending", "complete", "failed"), allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "secretScanningAlertCursor", { type: Sequelize.STRING, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("RepoSyncStates", "secretScanningAlertFrom");
    await queryInterface.removeColumn("RepoSyncStates", "secretScanningAlertStatus");
    await queryInterface.removeColumn("RepoSyncStates", "secretScanningAlertCursor");
  }
};
