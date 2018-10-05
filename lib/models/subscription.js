const Sequelize = require('sequelize')

module.exports = class Subscription extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init(
      {
        gitHubInstallationId: DataTypes.INTEGER,
        jiraHost: DataTypes.STRING,
        selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
        repoSyncState: DataTypes.JSONB,
        syncStatus: DataTypes.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED')
      },
      { sequelize }
    )
  }

  static async getAllForHost (host) {
    return Subscription.findAll({
      where: {
        jiraHost: host
      }
    })
  }

  static async getAllForInstallation (installationId) {
    return Subscription.findAll({
      where: {
        gitHubInstallationId: installationId
      }
    })
  }

  static async getSingleInstallation (host, installationId) {
    return Subscription.findOne({
      where: {
        jiraHost: host,
        gitHubInstallationId: installationId
      }
    })
  }

  static async install (payload) {
    const [subscription] = await Subscription.findOrCreate({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      }
    })

    Subscription.findOrStartSync(subscription)

    return subscription
  }

  static async uninstall (payload) {
    return Subscription.destroy({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      }
    })
  }

  static async findOrStartSync (subscription) {
    const { gitHubInstallationId: installationId, jiraHost } = subscription
    const { queues } = require('../worker')

    await subscription.update({
      syncStatus: 'PENDING',
      repoSyncState: {
        installationId,
        jiraHost,
        repos: {}
      }
    })

    console.log('Starting Jira sync')

    queues.discovery.add({ installationId, jiraHost })
  }

  async uninstall () {
    return this.destroy()
  }
}
