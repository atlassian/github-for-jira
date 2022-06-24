import  { envVars } from "config/env";
import axios, { AxiosRequestConfig } from "axios";
import { statsd } from "config/statsd";
import { cryptorMetrics } from "config/metric-names";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

// TODO: test that the local dev loop is not broken

/**
 * This client calling using Cryptor side-car to encrypt/decrypt data.
 *
 * How to use:
 *
 * - With encryption context (https://developer.atlassian.com/platform/cryptor/concepts/encryption-context/):
 *
 *   const client = new CryptorHttpClient("micros/github-for-jira/github-server-app-secrets");
 *   // Encryption context values must be strings
 *   const encrypted = await client.encrypt(req.logger, "super-secret-secret", { "jiraHostname": "https://my-fancy-jira.atlassian.net" });
 *   ...
 *   const decrypted = await client.decrypt(req.logger, encrypted, { "jiraHostname": "https://my-fancy-jira.atlassian.net" });
 *   // decrypted now contains "super-secret-secret"
 *
 * - Without encryption context:
 *
 *   absolutely same, just don't pass the context
 *   const encrypted = await client.encrypt(req.logger, "super-secret-secret");
 *
 */
export class CryptorHttpClient {

	private readonly keyAlias: string;
	private readonly axiosCommonConfig: AxiosRequestConfig;
	private readonly axiosPostConfig: AxiosRequestConfig;

	constructor(keyAlias) {
		this.keyAlias = keyAlias;
		this.axiosCommonConfig = {
			baseURL: envVars.CRYPTOR_SIDECAR_BASE_URL,
			timeout: Number(envVars.CRYPTOR_SIDECAR_TIMEOUT_MSEC)
		};
		this.axiosPostConfig = {
			...this.axiosCommonConfig,
			headers: {
				'X-Cryptor-Client': envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
				'Content-Type': 'application/json; charset=utf-8'
			}
		};
	}

	// TODO: add typing for encryption context
	async encrypt(logger: LoggerWithTarget, plainText: string, encryptionContext: any = {}): Promise<string> {
		const { cipherText } = await this._post('encrypt', `/cryptor/encrypt/${this.keyAlias}`, {
			plainText, encryptionContext
		}, logger);
		return cipherText;
	}

	// TODO: add typing for encryption context
	async decrypt(logger: LoggerWithTarget, cipherText: string, encryptionContext: any = {}): Promise<string> {
		const { plainText } = await this._post('decrypt', `/cryptor/decrypt`, {
			cipherText, encryptionContext
		}, logger);

		return plainText;
	}

	async healthcheck() {
		await axios.get("/healthcheck", this.axiosCommonConfig);
	}

	// TODO: add type for data
	async _post(operation, path, data: any, rootLogger: LoggerWithTarget) {
		const logger = rootLogger.child({ keyAlias: this.keyAlias, operation });

		try {
			const started = new Date().getTime();

			// TODO: remove debug logging
			logger.info({ config: this.axiosPostConfig, data });
			const result = (await axios.post(path, data, this.axiosPostConfig)).data;

			const finished = new Date().getTime();

			statsd.histogram(cryptorMetrics.clientHttpCallDuration, finished - started, { operation });
			// TODO: add statsd counter (maybe check with #help-cryptor if we already have this metric in sfx)
			// statsd.increment(cryptorMetrics.clientHttpSuccessCount, { operation });

			return result;
		} catch (e) {
			// Do not add { err: e } param to avoid logging payload
			logger.warn("Cryptor request failed: " + e?.message?.replace(data, "<censored>"));
			// TODO: add statsd counter
			// statsd.increment(cryptorMetrics.clientHttpFailedCount, { operation });
			throw e;
		}
	}
}
