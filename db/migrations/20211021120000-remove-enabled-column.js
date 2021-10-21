'use strict'
module.exports = {
  up: async (queryInterface, _) => {
		await queryInterface.sequelize.query('DROP VIEW IF EXISTS analytics.Subscriptions');
		await queryInterface.sequelize.query('DROP VIEW IF EXISTS analytics.Installations');
    await queryInterface.sequelize.query('ALTER TABLE "Installations" DROP COLUMN "enabled"');
  },

  down: async (queryInterface, _) => {
		await queryInterface.sequelize.query('ALTER TABLE "Installations" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true');
  }
}
