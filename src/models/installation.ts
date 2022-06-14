import { BOOLEAN, DataTypes, DATE, Model } from "sequelize";
import { Subscription } from "./subscription";
import { encrypted, getHashedKey, sequelize } from "models/sequelize";

// TODO: this should not be there.  Should only check once a function is called
if (!process.env.STORAGE_SECRET) {
	throw new Error("STORAGE_SECRET is not defined.");
}

export class Installation extends Model {
	id: number;
	jiraHost: string;
	secrets: string;
	sharedSecret: string;
	clientKey: string;
	updatedAt: Date;
	createdAt: Date;
	githubAppId?: number;

	static async getForClientKey(
		clientKey: string
	): Promise<Installation | null> {
		if (!clientKey?.length) {
			return null;
		}
		return await this.findOne({
			where: {
				clientKey: getHashedKey(clientKey)
			}
		});
	}

	static async getForHost(host: string): Promise<Installation | null> {
		if (!host?.length) {
			return null;
		}
		return await this.findOne({
			where: {
				jiraHost: host
			},
			order: [["createdAt", "DESC"]]
		});
	}

	static async getAllForHost(host: string): Promise<Installation[]> {
		if (!host?.length) {
			return [];
		}
		return await this.findAll({
			where: {
				jiraHost: host
			},
			order: [["id", "DESC"]]
		});
	}

	/**
	 * Create a new Installation object from a Jira Webhook
	 *
	 * @param {{host: string, clientKey: string, secret: string}} payload
	 * @returns {Installation}
	 */
	static async install(payload: InstallationPayload): Promise<Installation> {
		const [installation, created] = await this.findOrCreate({
			where: {
				clientKey: getHashedKey(payload.clientKey)
			},
			defaults: {
				jiraHost: payload.host,
				sharedSecret: payload.sharedSecret
			}
		});

		if (!created) {
			await installation
				.update({
					sharedSecret: payload.sharedSecret,
					jiraHost: payload.host
				})
				.then(async (record) => {
					const subscriptions = await Subscription.getAllForClientKey(
						record.clientKey
					);
					await Promise.all(
						subscriptions.map((subscription) =>
							subscription.update({ jiraHost: record.jiraHost })
						)
					);

					return installation;
				});
		}

		return installation;
	}

	async uninstall(): Promise<void> {
		await this.destroy();
	}

	async subscriptions(): Promise<Subscription[]> {
		return await Subscription.getAllForClientKey(this.clientKey);
	}
}

Installation.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	jiraHost: DataTypes.STRING,
	secrets: encrypted.vault("secrets"),
	sharedSecret: encrypted.field("sharedSecret", {
		type: DataTypes.STRING,
		allowNull: false
	}),
	clientKey: {
		type: DataTypes.STRING,
		allowNull: false
	},
	enabled: BOOLEAN,
	createdAt: DATE,
	updatedAt: DATE,
	githubAppId: {
		type: DataTypes.INTEGER,
		allowNull: true
	}
}, { sequelize });

export interface InstallationPayload {
	host: string;
	clientKey: string;
	// secret: string;
	sharedSecret: string;
}
