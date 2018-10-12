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

  static async syncRepository (subscription, { owner, repo }) {
    const { gitHubInstallationId: installationId, jiraHost } = subscription
    const { queues } = require('../worker')
    const app = require('../worker/app')
    const github = await app.auth(installationId)
    const { data } = await github.repos.get({ owner, repo })

    // Making the repository object smaller since it gets passed around
    // to all the jobs in memory
    const repository = {
      id: data.id,
      full_name: data.full_name,
      html_url: data.html_url,
      name: data.name,
      owner: data.owner
    }

    await subscription.update({
      syncStatus: 'PENDING',
      repoSyncState: {
        installationId,
        jiraHost,
        repos: {}
      }
    })

    queues.master.add({ installationId, jiraHost, repository })
  }

  async uninstall () {
    return this.destroy()
  }
}
