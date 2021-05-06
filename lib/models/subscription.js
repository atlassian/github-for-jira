const Sequelize = require('sequelize');

module.exports = class Subscription extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        gitHubInstallationId: DataTypes.INTEGER,
        jiraHost: DataTypes.STRING,
        selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
        repoSyncState: DataTypes.JSONB,
        syncStatus: DataTypes.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
        syncWarning: DataTypes.STRING,
        jiraClientKey: DataTypes.STRING,
      },
      { sequelize },
    );
  }

  static async getAllForHost(host) {
    return Subscription.findAll({
      where: {
        jiraHost: host,
      },
    });
  }

  static async getAllForInstallation(installationId) {
    return Subscription.findAll({
      where: {
        gitHubInstallationId: installationId,
      },
    });
  }

  static async getAllForClientKey(clientKey) {
    return Subscription.findAll({
      where: {
        jiraClientKey: clientKey,
      },
    });
  }

  static async getSingleInstallation(jiraHost, gitHubInstallationId) {
    return Subscription.findOne({
      where: {
        jiraHost,
        gitHubInstallationId,
      },
    });
  }

  static async getInstallationForClientKey(clientKey, installationId) {
    return Subscription.findOne({
      where: {
        jiraClientKey: clientKey,
        gitHubInstallationId: installationId,
      },
    });
  }

  static async install(payload) {
    const [subscription] = await Subscription.findOrCreate({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host,
        jiraClientKey: payload.clientKey,
      },
    });

    Subscription.findOrStartSync(subscription);

    return subscription;
  }

  static async uninstall(payload) {
    return Subscription.destroy({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host,
      },
    });
  }

  static async findOrStartSync(subscription, syncType) {
    const { gitHubInstallationId: installationId, jiraHost } = subscription;
    const { queues } = require('../worker');

    const repoSyncState = subscription.get('repoSyncState');

    // If repo sync state is empty
    // start a sync job from scratch
    if (!repoSyncState || (syncType === 'full')) {
      await subscription.update({
        syncStatus: 'PENDING',
        syncWarning: '',
        repoSyncState: {
          installationId,
          jiraHost,
          repos: {},
        },
      });
      console.log('Starting Jira sync');
      return queues.discovery.add({ installationId, jiraHost });
    }

    // Otherwise, just add a job to the queue for this installation
    // This will automatically pick back up from where it left off
    // if something got stuck
    return queues.installation.add({ installationId, jiraHost });
  }

  /*
   * Returns array with sync status counts. [ { syncStatus: 'COMPLETED', count: 123 }, ...]
   */
  static async syncStatusCounts() {
    const syncStatusCountQuery = 'SELECT "syncStatus", COUNT(*) FROM "Subscriptions" GROUP BY "syncStatus"';
    const [results] = await this.sequelize.query(syncStatusCountQuery);

    return results;
  }

  async uninstall() {
    return this.destroy();
  }

  async resumeSync() {
    return Subscription.findOrStartSync(this);
  }

  async restartSync() {
    return Subscription.findOrStartSync(this, 'full');
  }

  // A stalled in progress sync is one that is ACTIVE but has not seen any updates in the last 15 minutes
  // This may happen when an error causes a sync to die without setting the status to 'FAILED'
  isInProgressSyncStalled() {
    if (this.syncStatus === 'ACTIVE') {
      const fifteenMinutesAgo = new Date(new Date() - (15 * 60 * 1000));

      return this.updatedAt < fifteenMinutesAgo;
    } else {
      return false;
    }
  }
};
