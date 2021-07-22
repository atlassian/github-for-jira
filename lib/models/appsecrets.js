const crypto = require('crypto');
const Sequelize = require('sequelize');
const EncryptedField = require('sequelize-encrypted');

if (!process.env.STORAGE_SECRET) {
  throw new Error('STORAGE_SECRET is not defined.');
}

const encryptedClient = EncryptedField(Sequelize, process.env.STORAGE_SECRET);
const encryptedWebhook = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

class AppSecrets extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init({
      githubHost: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      clientId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      appId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      clientSecret: encryptedClient.vault('clientSecret'),
      privateKey: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      webhookSecret: encryptedWebhook.vault('webhookSecret'),
    }, { sequelize });
  }

  static async getForHost(host) {
    return AppSecrets.findOne({
      where: {
        githubHost: host,
      },
    });
  }

  /**
   * Create a new appsecrets object
   *
   * @param {{clientId: string, clientSecret: string, privateKey: string, appId: integer, webhookSecret: string}} payload
   * @returns {AppSecrets}
   */
  static async insert(payload) {
    const [appsecret] = await AppSecrets.findOrCreate({
      where: {
        githubHost: payload.githubHost,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret,
        appId: payload.appId,
        privateKey: payload.privateKey,
        webhookSecret: payload.webhookSecret,
      },
    });
    return appsecret;
  }
}

module.exports = AppSecrets;
