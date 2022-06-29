import { Model, DataTypes, Sequelize } from "sequelize";
import { sequelize } from "models/sequelize";
import EncryptedField from "sequelize-encrypted";
import { CryptorHttpClient } from "../util/cryptor-http-client";
import Logger from "bunyan";

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

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

	async encryptAndSetGitHubClientSecret(plainText: string, logger: Logger) {
		const encrypted = await CryptorHttpClient.encrypt(CryptorHttpClient.GITHUB_SERVER_APP_SECRET, plainText, logger);
		this.setDataValue("gitHubClientSecret", encrypted);
	}

	async decryptAndGetGitHubClientSecret(logger: Logger) {
		return await CryptorHttpClient.decrypt(this.getDataValue("gitHubClientSecret"), logger);
	}

	async encryptAndSetWebhookSecret(plainText: string, logger: Logger) {
		const encrypted = await CryptorHttpClient.encrypt(CryptorHttpClient.GITHUB_SERVER_APP_SECRET, plainText, logger);
		this.setDataValue("webhookSecret", encrypted);
	}

	async decryptAndGetWebhookSecret(logger: Logger) {
		return await CryptorHttpClient.decrypt(this.getDataValue("webhookSecret"), logger);
	}

	async encryptAndSetPrivateKey(plainText: string, logger: Logger) {
		const encrypted = await CryptorHttpClient.encrypt(CryptorHttpClient.GITHUB_SERVER_APP_SECRET, plainText, logger);
		this.setDataValue("privateKey", encrypted);
	}

	async decryptAndGetPrivateKey(logger: Logger) {
		return await CryptorHttpClient.decrypt(this.getDataValue("privateKey"), logger);
	}
}

const directSetErrror = (field: string, method: string) => {
	return new Error(`Because of using cryptor, please do not directly set the value to the field [${field}] itself, but instead using method [${method}]`);
};

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
	secrets: encrypted.vault("secrets"),
	gitHubClientSecret: {
		type: DataTypes.STRING,
		allowNull: false,
		set() {
			throw directSetErrror("gitHubClientSecret", "setGitHubClientSecret");
		}
	},
	webhookSecret: {
		type: DataTypes.STRING,
		allowNull: false,
		set() {
			throw directSetErrror("webhookSecret", "setWebhookSecret");
		}
	},
	privateKey: {
		type: DataTypes.STRING,
		allowNull: false,
		set() {
			throw directSetErrror("privateKey", "setPrivateKey");
		}
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
