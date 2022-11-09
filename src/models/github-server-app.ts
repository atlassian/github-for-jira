import { DataTypes, Sequelize } from "sequelize";
import { sequelize } from "models/sequelize";
import { EncryptionSecretKeyEnum } from "utils/encryption-client";
import { EncryptedModel } from "./encrypted-model";

import EncryptedField from "sequelize-encrypted";

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

const GITHUB_CLIENT_SECRET_FIELDNAME = "gitHubClientSecret";
const PRIVATE_KEY_FIELDNAME = "privateKey";
const WEBHOOK_SECRET_FIELDNAME = "webhookSecret";

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


export class GitHubServerApp extends EncryptedModel {
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

	getEncryptionSecretKey() {
		return EncryptionSecretKeyEnum.GITHUB_SERVER_APP;
	}

	getDecryptedGitHubClientSecret(): Promise<string> {
		return this.decrypt(GITHUB_CLIENT_SECRET_FIELDNAME);
	}

	getDecryptedPrivateKey(): Promise<string>  {
		return this.decrypt(PRIVATE_KEY_FIELDNAME);
	}

	getDecryptedWebhookSecret(): Promise<string>  {
		return this.decrypt(WEBHOOK_SECRET_FIELDNAME);
	}

	async getEncryptContext() {
		return {};
	}

	getSecretFields() {
		return [GITHUB_CLIENT_SECRET_FIELDNAME, PRIVATE_KEY_FIELDNAME, WEBHOOK_SECRET_FIELDNAME] as const;
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

	static async install(payload: GitHubServerAppPayload): Promise<GitHubServerApp> {
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

		const [gitHubServerApp] = await this.findOrCreate({
			where: {
				gitHubClientId,
				gitHubBaseUrl
			},
			defaults: {
				uuid,
				appId,
				gitHubClientSecret,
				webhookSecret,
				privateKey,
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

	static async updateGitHubAppByUUID(payload: GitHubServerAppUpdatePayload): Promise<void> {
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
			await existApp.update({
				appId,
				gitHubClientId,
				gitHubBaseUrl,
				gitHubClientSecret,
				webhookSecret,
				privateKey,
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
	hooks: {
		beforeSave: async (app: GitHubServerApp, opts) => {
			await app.encryptChangedSecretFields(opts.fields);
		},
		beforeBulkCreate: async (apps: GitHubServerApp[], opts) => {
			for (const app of apps) {
				await app.encryptChangedSecretFields(opts.fields);
			}
		}
	},
	sequelize
});
