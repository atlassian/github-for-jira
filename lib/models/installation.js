const crypto = require('crypto');
const Sequelize = require('sequelize');
const EncryptedField = require('sequelize-encrypted');
const Subscription = require('./subscription');

if (!process.env.STORAGE_SECRET) {
  throw new Error('STORAGE_SECRET is not defined.');
}

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

function getHashedKey(clientKey) {
  const keyHash = crypto.createHmac('sha256', process.env.STORAGE_SECRET);
  keyHash.update(clientKey);

  return keyHash.digest('hex');
}

class Installation extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init({
      jiraHost: DataTypes.STRING,
      secrets: encrypted.vault('secrets'),
      sharedSecret: encrypted.field('sharedSecret', {
        type: DataTypes.STRING,
        allowNull: false,
      }),
      clientKey: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      enabled: Sequelize.BOOLEAN,
    }, { sequelize });
  }

  static getForClientKey(clientKey) {
    return Installation.findOne({
      where: {
        clientKey: getHashedKey(clientKey),
      },
    });
  }

  static getForHost(host) {
    return Installation.findOne({
      where: {
        jiraHost: host,
        enabled: true,
      },
    });
  }

  static getPendingHost(jiraHost) {
    return Installation.findOne({
      where: {
        jiraHost,
        enabled: false,
      },
    });
  }

  async enable() {
    try {
      await this.update({
        enabled: true,
      });
    } catch (err) {
      logger.error(`Enable error: ${err}`);
    }
  }

  async disable() {
    try {
      await this.update({
        enabled: false,
      });
    } catch (err) {
      logger.error(`Disable error: ${err}`);
    }
  }

  /**
   * Create a new Installation object from a Jira Webhook
   *
   * @param {{host: string, clientKey: string, secret: string}} payload
   * @returns {Installation}
   */
  static async install(payload) {
    const [installation, created] = await Installation.findOrCreate({
      where: {
        clientKey: getHashedKey(payload.clientKey),
      },
      defaults: {
        jiraHost: payload.host,
        sharedSecret: payload.sharedSecret,
      },
    });

    if (!created) {
      try {
        await installation.update({
          sharedSecret: payload.sharedSecret,
          enabled: false,
          jiraHost: payload.host,
        }).then(async (record) => {
          const subscriptions = await Subscription.getAllForClientKey(record.clientKey);
          await Promise.all(subscriptions.map(subscription => subscription.update({ jiraHost: record.jiraHost })));

          return installation;
        });
      } catch (err) {
        logger.error(`Error updating subscription: ${err}`);
      }
    }

    try {
      await installation.update({
        enabled: false,
      });

      return installation;
    } catch (err) {
      logger.error(`Error updating installation: ${err}`);
    }
  }

  async uninstall() {
    this.destroy();
  }

  async subscriptions() {
    return Subscription.getAllForClientKey(this.clientKey);
  }
}

module.exports = Installation;
module.exports.getHashedKey = getHashedKey;
