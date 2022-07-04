import { Model, DataTypes } from "sequelize";
import { sequelize } from "models/sequelize";
import { CryptorHttpClient } from "../util/cryptor-http-client";
import { getLogger } from "../config/logger";

const SECRETS_FIELDS = ["gitHubClientSecret", "privateKey", "webhookSecret"];

interface GitHubServerAppPayload {
	uuid: string;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
	gitHubAppName: string;
	installationId: number;
}

export class GitHubServerApp extends Model {
	id: number;
	uuid: string;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
	gitHubAppName: string;
	installationId: number;
	updatedAt: Date;
	createdAt: Date;

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
	gitHubBaseUrl: {
		type: DataTypes.STRING,
		allowNull: false
	},
	gitHubClientId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	gitHubClientSecret: {
		type: DataTypes.STRING,
		allowNull: false
	},
	webhookSecret: {
		type: DataTypes.STRING,
		allowNull: false
	},
	privateKey: {
		type: DataTypes.STRING,
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
}, { sequelize });

const log = getLogger("github-server-app-cryptor");

const encrypt = async function (plainText: string) {
	return CryptorHttpClient.encrypt(CryptorHttpClient.GITHUB_SERVER_APP_SECRET, plainText, log);
};
GitHubServerApp.beforeSave(async (app, opts)=> {
	for (const f of SECRETS_FIELDS) {
		if (opts.fields?.includes(f)) {
			const encrypted = await encrypt(app[f]);
			app[f] = encrypted;
		}
	}
});

GitHubServerApp.beforeBulkCreate(async (apps, opts) => {
	for (const app of apps) {
		for (const f of SECRETS_FIELDS) {
			if (opts.fields?.includes(f)) {
				const encrypted = await encrypt(app[f]);
				app[f] = encrypted;
			}
		}
	}
});
