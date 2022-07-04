import  { envVars } from "config/env";
import axios from "axios";
import Logger from "bunyan";

export type CryptorSecretKey = "github-server-app-secrets";
export type EncryptionContext = Record<string, string | number>;

const KEY_ALIAS_PREFIX = "micros/github-for-jira";

/**
 * This client calling using Cryptor side-car to encrypt/decrypt data.
 *
 * How to use:
 *
 * - Without encryption context: Same, but just don't pass the context
 *   const encrypted = await EncryptionClient.encrypt(EncryptionClient.GITHUB_SERVER_APP_SECRET, "super-secret-secret", req.logger);
 *
 */
export class EncryptionClient {

	public static GITHUB_SERVER_APP_SECRET: CryptorSecretKey = "github-server-app-secrets";

	private static axiosConfig() {
		return {
			baseURL: envVars.CRYPTOR_URL,
			headers: {
				"X-Cryptor-Client": envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
				"Content-Type": "application/json; charset=utf-8"
			}
		};
	}

	static async encrypt(secretKey: CryptorSecretKey, plainText: string, encryptionContext: EncryptionContext, logger: Logger): Promise<string> {
		try {
			const { cipherText }= (await axios.post(`/cryptor/encrypt/${KEY_ALIAS_PREFIX}/${secretKey}`, {
				plainText,
				encryptionContext
			}, EncryptionClient.axiosConfig())).data;
			return cipherText;
		} catch (e) {
			logger.warn("Cryptor request failed: " + (e?.message || "").replace(plainText, "<censored>"));
			throw e;
		}
	}

	static async decrypt(cipherText: string, encryptionContext: EncryptionContext, logger: Logger): Promise<string> {
		try {
			const { plainText }= (await axios.post(`/cryptor/decrypt`, {
				cipherText,
				encryptionContext
			}, EncryptionClient.axiosConfig())).data;
			return plainText;
		} catch (e) {
			logger.warn("Cryptor request failed: " + e?.message);
			throw e;
		}
	}

	static async healthcheck() {
		await axios.get("/healthcheck", EncryptionClient.axiosConfig());
	}

}
