import { DataTypes, Sequelize } from "sequelize";
import { sequelize } from "models/sequelize";
import { EncryptionSecretKeyEnum } from "utils/encryption-client";
import { EncryptedModel } from "./encrypted-model";

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

	async getEncryptContext() {
		//For example: we can call database to fetch sharedSecret for use as EncryptionContext
		//const installation = await Installation.findByPk(this.installationId);
		//return {
		//	installationSharedSecret: installation?.sharedSecret
		//};
		return {};
	}

	getSecretFields() {
		return ["gitHubClientSecret", "privateKey", "webhookSecret"] as const;
	}

	/**
	 * Get GitHubServerApp
	 *
	 * @param {{gitHubServerAppId: number}} gitHubServerAppId
	 * @returns {GitHubServerApp}
	 */
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

	/**
	 * Get all GitHubServerApps with installationId
	 *
	 * @param {{installationId: number}} installationId
	 * @returns {GitHubServerApp[]}
	 */
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

	/**
	 * Get all GitHubServerApps for gitHubBaseUrl with installationId
	 *
	 * @param gitHubBaseUrl
	 * @param installationId
	 * @returns {GitHubServerApp[]}
	 */
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

	/**
	 * Create a new GitHubServerApp object
	 *
	 * @param {{
	 * 		gitHubClientId: string,
	 * 		uuid: string,
	 * 		appId: number;
	 * 		gitHubBaseUrl: string,
	 * 		gitHubClientSecret: string,
	 * 		webhookSecret: string,
	 * 		privateKey: string,
	 * 		gitHubAppName: string,
	 * 		installationId: number
	 * 	}} payload
	 * @returns {GitHubServerApp}
	 */
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
				gitHubClientId
			},
			defaults: {
				uuid,
				appId,
				gitHubBaseUrl,
				gitHubClientSecret,
				webhookSecret,
				privateKey,
				gitHubAppName,
				installationId
			}
		});

		return gitHubServerApp;
	}

	static async uninstall(uuid: string): Promise<void> {
		await this.destroy({
			where: { uuid }
		});
	}

	/**
	 * Update existing GitHubServerApp object
	 *
	 * @param {{
	 * 		gitHubClientId: string,
	 * 		uuid: string,
	 * 		appId: number;
	 * 		gitHubBaseUrl: string,
	 * 		gitHubClientSecret: string,
	 * 		webhookSecret: string,
	 * 		privateKey: string,
	 * 		gitHubAppName: string,
	 * 		installationId: number
	 * 	}} payload
	 */

	static async updateGitHubApp(payload: GitHubServerAppPayload): Promise<void> {
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

		await this.update(
			{
				uuid,
				appId,
				gitHubClientId,
				gitHubBaseUrl,
				gitHubClientSecret,
				webhookSecret,
				privateKey,
				gitHubAppName,
				installationId
			},
			{
				where: { uuid }
			}
		);
	}

	/**
	 * Get GitHubServerApp
	 *
	 * @param {{uuid: string}} uuid
	 * @returns {GitHubServerApp}
	 */
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
