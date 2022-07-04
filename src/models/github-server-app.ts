import { DataTypes } from "sequelize";
import { sequelize } from "models/sequelize";
import { EncryptionSecretKeyEnum } from "utils/encryption-client";
import { EncryptedModel } from "./encrypted-model";
import { Installation } from "models/installation";

const SECRETS_FIELDS = ["gitHubClientSecret", "privateKey", "webhookSecret"] as const;

interface GitHubServerAppPayload {
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

export class GitHubServerApp extends EncryptedModel<GitHubServerApp, typeof SECRETS_FIELDS[number]> {
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
		const installation = await Installation.findByPk(this.installationId);
		return {
			installationSharedSecret: installation?.sharedSecret
		};
	}

	getSecretFields() {
		return SECRETS_FIELDS;
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
	 * Get all GitHubServerApps for gitHubBaseUrl with installationId
	 *
	 * @param gitHubBaseUrl
	 * @param installationId
	 * @returns {GitHubServerApp[]}
	 */
	static async getAllForGitHubBaseUrl(
		gitHubBaseUrl: string,
		installationId: number
	): Promise<GitHubServerApp[] | null> {
		if (!gitHubBaseUrl || !installationId) {
			return null;
		}

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
	gitHubClientSecret: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	webhookSecret: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	privateKey: {
		type: DataTypes.TEXT,
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
