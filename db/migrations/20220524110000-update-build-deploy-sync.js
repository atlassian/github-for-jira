'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE "RepoSyncStates"
      SET "buildStatus" = 'complete', "deploymentStatus" = 'complete'
    `)
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE "RepoSyncStates"
      SET "buildStatus = NULL, "deploymentStatus" = NULL
    `)
  }
}
