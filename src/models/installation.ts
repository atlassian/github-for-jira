import crypto from 'crypto';
import Sequelize from 'sequelize';
import Subscription from './subscription';

if (!process.env.STORAGE_SECRET) {
  throw new Error('STORAGE_SECRET is not defined.');
}

export const getHashedKey = (clientKey: string): string => {
  const keyHash = crypto.createHmac('sha256', process.env.STORAGE_SECRET);
  keyHash.update(clientKey);

  return keyHash.digest('hex');
}

export default class Installation extends Sequelize.Model {
  id: number;
  jiraHost: string;
  secrets: string;
  sharedSecret: string;
  clientKey: string;
  enabled: boolean;

  static async getForClientKey(clientKey: string): Promise<Installation | null> {
    return Installation.findOne({
      where: {
        clientKey: getHashedKey(clientKey),
      },
    });
  }

  static async getForHost(host: string): Promise<Installation | null> {
    return Installation.findOne({
      where: {
        jiraHost: host,
        enabled: true,
      },
    });
  }

  static async getPendingHost(jiraHost: string): Promise<Installation | null> {
    return Installation.findOne({
      where: {
        jiraHost,
        enabled: false,
      },
    });
  }

  async enable(): Promise<void> {
    await this.update({
      enabled: true,
    });
  }

  async disable(): Promise<void> {
    await this.update({
      enabled: false,
    });
  }

  /**
   * Create a new Installation object from a Jira Webhook
   *
   * @param {{host: string, clientKey: string, secret: string}} payload
   * @returns {Installation}
   */
  static async install(payload: InstallationPayload): Promise<Installation> {
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
      await installation.update({
        sharedSecret: payload.sharedSecret,
        enabled: false,
        jiraHost: payload.host,
      }).then(async (record) => {
        const subscriptions = await Subscription.getAllForClientKey(record.clientKey);
        await Promise.all(subscriptions.map(subscription => subscription.update({jiraHost: record.jiraHost})));

        return installation;
      });
    }

    await installation.update({
      enabled: false,
    });

    return installation;
  }

  async uninstall(): Promise<void> {
    await this.destroy();
  }

  async subscriptions(): Promise<Subscription[]> {
    return Subscription.getAllForClientKey(this.clientKey);
  }
}

export interface InstallationPayload {
  host: string;
  clientKey: string;
  // secret: string;
  sharedSecret: string;
}
