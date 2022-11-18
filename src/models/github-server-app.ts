import { Model, DataTypes, Sequelize, SaveOptions } from "sequelize";
import { sequelize } from "models/sequelize";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

import EncryptedField from "sequelize-encrypted";

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

export interface GitHubServerAppPayload {
	uuid: string;
	appId: number;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
	gitHubAppName: string;
	installationId: number;
}

export interface GitHubServerAppUpdatePayload {
	uuid: string;
	appId: number;
	gitHubBaseUrl?: string;
	gitHubClientId?: string;
	gitHubClientSecret?: string;
	webhookSecret?: string;
	privateKey?: string;
	gitHubAppName?: string;
	installationId?: number;
}

const KEY = EncryptionSecretKeyEnum.GITHUB_SERVER_APP;

const getEncryptContext = (jiraClientKey: string) => {
	return { jiraClientKey };
};

export class GitHubServerApp extends Model {
	id: number;
	uuid: string;
	appId: number;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
	gitHubAppName: string;
	installationId: number;
	updatedAt: Date;
	createdAt: Date;

	public save(options?: SaveOptions): Promise<this> {
		return super.save(options);
	}

	getDecryptedGitHubClientSecret(jiraClientKey: string): Promise<string> {
		return EncryptionClient.decrypt(this.gitHubClientSecret, getEncryptContext(jiraClientKey));
	}

	getDecryptedPrivateKey(jiraClientKey: string): Promise<string>  {
		return EncryptionClient.decrypt(this.privateKey, getEncryptContext(jiraClientKey));
	}

	getDecryptedWebhookSecret(jiraClientKey: string): Promise<string>  {
		return EncryptionClient.decrypt(this.webhookSecret, getEncryptContext(jiraClientKey));
	}

	static async getForGitHubServerAppId(
		gitHubServerAppId: number
	): Promise<GitHubServerApp | null> {
		if (!gitHubServerAppId) {
			return null;
		}

		return this.findOne({
			where: {
				id: gitHubServerAppId
			}
		});
	}

	static async findForInstallationId(
		installationId: number
	): Promise<GitHubServerApp[] | null> {
		if (!installationId) {
			return null;
		}

		return this.findAll({
			where: {
				installationId: installationId
			}
		});
	}

	static async getAllForGitHubBaseUrlAndInstallationId(
		gitHubBaseUrl: string,
		installationId: number
	): Promise<GitHubServerApp[]> {
		return this.findAll({
			where: {
				gitHubBaseUrl,
				installationId
			}
		});
	}

	static async getForUuidAndInstallationId(
		uuid: string,
		installationId: number
	): Promise<GitHubServerApp | null> {
		return this.findOne({
			where: {
				uuid,
				installationId
			}
		});
	}

	static async install(payload: GitHubServerAppPayload, jiraClientKey: string): Promise<GitHubServerApp> {
		const {
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			installationId
		} = payload;

		const ctx = getEncryptContext(jiraClientKey);
		const [gitHubServerApp] = await this.findOrCreate({
			where: {
				gitHubClientId,
				gitHubBaseUrl
			},
			defaults: {
				uuid,
				appId,
				gitHubClientSecret: await EncryptionClient.encrypt(KEY, gitHubClientSecret, ctx),
				webhookSecret: await EncryptionClient.encrypt(KEY, webhookSecret, ctx),
				privateKey: await EncryptionClient.encrypt(KEY, privateKey, ctx),
				gitHubAppName,
				installationId
			}
		});

		return gitHubServerApp;
	}

	static async uninstallApp(uuid: string): Promise<void> {
		await this.destroy({
			where: { uuid }
		});
	}

	static async uninstallServer(gitHubBaseUrl: string, installationId: number): Promise<void> {
		await this.destroy({
			where: { gitHubBaseUrl, installationId }
		});
	}

	static async updateGitHubAppByUUID(payload: GitHubServerAppUpdatePayload, jiraClientKey: string): Promise<void> {
		const {
			uuid,
			appId,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			installationId
		} = payload;

		const existApp = await this.findForUuid(uuid);
		if (existApp) {
			const ctx = getEncryptContext(jiraClientKey);
			await existApp.update({
				appId,
				gitHubClientId,
				gitHubBaseUrl,
				gitHubClientSecret: gitHubClientSecret ? await EncryptionClient.encrypt(KEY, gitHubClientSecret, ctx) : undefined,
				webhookSecret: webhookSecret ? await EncryptionClient.encrypt(KEY, webhookSecret, ctx) : undefined,
				privateKey: privateKey ? await EncryptionClient.encrypt(KEY, privateKey, ctx) : undefined,
				gitHubAppName,
				installationId
			});
		}

	}

	static async findForUuid(uuid: string): Promise<GitHubServerApp | null> {
		return this.findOne({
			where: {
				uuid
			}
		});
	}
}

GitHubServerApp.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	uuid: {
		type: DataTypes.UUID,
		defaultValue: DataTypes.UUIDV4,
		unique: true,
		allowNull: false
	},
	appId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	gitHubBaseUrl: {
		type: DataTypes.STRING,
		allowNull: false
	},
	gitHubClientId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	secrets: encrypted.vault("secrets"),
	gitHubClientSecret: {
		type: DataTypes.TEXT,
		field: "encryptedGitHubClientSecret",
		allowNull: false
	},
	webhookSecret: {
		type: DataTypes.TEXT,
		field: "encryptedWebhookSecret",
		allowNull: false
	},
	privateKey: {
		type: DataTypes.TEXT,
		field: "encryptedPrivateKey",
		allowNull: false
	},
	gitHubAppName: {
		type: DataTypes.STRING,
		allowNull: false
	},
	installationId: {
		type: DataTypes.INTEGER,
		allowNull: false
	}
}, {
	sequelize
});
