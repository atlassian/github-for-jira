const Sequelize = require('sequelize')

module.exports = class Subscription extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init(
      {
        gitHubInstallationId: DataTypes.INTEGER,
        jiraHost: DataTypes.STRING,
        // This stores an array of `node_id`s now since we can't get a
        // repository directly from `repository.id`
        selectedRepositories: DataTypes.ARRAY(DataTypes.STRING),
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
    const app = require('../worker/app')
    const github = await app.auth(installationId)
    const selectedRepositories = await github.paginate(
      github.apps.getInstallationRepositories({ per_page: 100 }),
      res => res.data.repositories.map(repository => repository.node_id)
    )
    console.log(selectedRepositories)
    await subscription.update({
      syncStatus: 'PENDING',
      repoSyncState: {
        installationId,
        jiraHost,
        repos: {}
      },
      selectedRepositories
    })

    console.log('Starting Jira sync')

    // Only add the first repository for an installation to the subscription queue
    await queues.subscriptions.add(
      {
        installationId,
        jiraHost,
        nodeId: selectedRepositories[0],
        next: selectedRepositories[1] // storing the `node_id` of the next repository in the installation
      },
      {
        jobId: `${installationId}:${selectedRepositories[0]}`,
        removeOnComplete: false,
        removeOnFail: false,
        next: selectedRepositories[1]
      }
    )

    // Put the rest in the delayed queue for later processing
    return selectedRepositories.forEach(async (repository, i) => {
      queues.delayedJobs.add(
        {
          installationId,
          jiraHost,
          nodeId: repository,
          next: selectedRepositories[i + 1] || undefined
        },
        {
          jobId: `${installationId}:${repository}`,
          removeOnComplete: false,
          removeOnFail: false
        }
      )
    })
  }

  async uninstall () {
    return this.destroy()
  }
}
