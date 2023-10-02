import { BOOLEAN, DataTypes, DATE } from "sequelize";
import { Subscription } from "./subscription";
import { getHashedKey, sequelize } from "models/sequelize";
import { EncryptedModel } from "models/encrypted-model";
import { EncryptionSecretKeyEnum } from "utils/encryption-client";
import { getLogger } from "config/logger";

export class Installation extends EncryptedModel {
	id: number;
	jiraHost: string;
	plainClientKey: string;
	encryptedSharedSecret: string;
	clientKey: string;
	updatedAt: Date;
	createdAt: Date;

	getEncryptionSecretKey() {
		return EncryptionSecretKeyEnum.JIRA_INSTANCE_SECRETS;
	}

	getEncryptContext() {
		return Promise.resolve({ });
	}

	getSecretFields() {
		return ["encryptedSharedSecret"] as const;
	}

	static async getForClientKey(
		clientKey: string | undefined
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
				plainClientKey: payload.clientKey,
				encryptedSharedSecret: payload.sharedSecret //write as plain text, hook will encrypt it
			}
		});
		if (!created) {
			await installation
				.update({
					encryptedSharedSecret: payload.sharedSecret,
					jiraHost: payload.host,
					plainClientKey: payload.clientKey
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

const LOGGER_HOOK_BEFORE_SAVE = getLogger("installation-hook-beforeSave");
const LOGGER_HOOK_BEFORE_BULK_CREATE = getLogger("installation-hook-beforeBulkCreate");


Installation.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	jiraHost: DataTypes.STRING,
	encryptedSharedSecret: {
		type: DataTypes.TEXT,
		allowNull: true
	},
	clientKey: {
		type: DataTypes.STRING,
		allowNull: false
	},
	plainClientKey: {
		type: DataTypes.STRING,
		allowNull: true
	},
	enabled: BOOLEAN,
	createdAt: DATE,
	updatedAt: DATE
}, {
	hooks: {
		beforeSave: async (instance: Installation, opts) => {
			if (!opts.fields) return;
			const optsFields = opts.fields.filter((field): field is string => typeof field === "string");
			await instance.encryptChangedSecretFields(optsFields, LOGGER_HOOK_BEFORE_SAVE);
		},
		beforeBulkCreate: async (instances: Installation[], opts) => {
			for (const instance of instances) {
				if (!opts.fields) return;
				const optsFields = opts.fields.filter((field): field is string => typeof field === "string");
				await instance.encryptChangedSecretFields(optsFields, LOGGER_HOOK_BEFORE_BULK_CREATE);
			}
		}
	},
	sequelize
});

export interface InstallationPayload {
	host: string;
	clientKey: string;
	sharedSecret: string;
}
