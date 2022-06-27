import  { envVars } from "config/env";
import axios, { AxiosRequestConfig } from "axios";
import { statsd } from "config/statsd";
import { cryptorMetrics } from "config/metric-names";
import Logger from "bunyan";

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

type CryptorHttpClientOptions = {
	keyAlias: string;
	baseUrl?: string;
	timoutMSec?: number;
	cryptorChanllenge?: string;
}

type EncryptionContext = {
	[key: string]: string | number | undefined | null
}

type EncryptionPayload = {
	plainText: string;
	encryptionContext: EncryptionContext
}

type DecryptionPayload = {
	cipherText: string;
	encryptionContext: EncryptionContext;
}

export class CryptorHttpClient {

	private readonly keyAlias: string;
	private readonly axiosCommonConfig: AxiosRequestConfig;
	private readonly axiosPostConfig: AxiosRequestConfig;

	constructor(opts: CryptorHttpClientOptions) {
		this.keyAlias = opts.keyAlias;
		this.axiosCommonConfig = {
			baseURL: opts.baseUrl || envVars.CRYPTOR_SIDECAR_BASE_URL,
			timeout: opts.timoutMSec || Number(envVars.CRYPTOR_SIDECAR_TIMEOUT_MSEC)
		};
		this.axiosPostConfig = {
			...this.axiosCommonConfig,
			headers: {
				"X-Cryptor-Client": opts.cryptorChanllenge || envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
				"Content-Type": "application/json; charset=utf-8"
			}
		};
	}

	async encrypt(logger: Logger, plainText: string, encryptionContext: EncryptionContext = {}): Promise<string> {
		const { cipherText } = await this._post("encrypt", `/cryptor/encrypt/${this.keyAlias}`, {
			plainText, encryptionContext
		}, logger);
		return cipherText;
	}

	async decrypt(logger: Logger, cipherText: string, encryptionContext: EncryptionContext = {}): Promise<string> {
		const { plainText } = await this._post("decrypt", `/cryptor/decrypt`, {
			cipherText, encryptionContext
		}, logger);

		return plainText;
	}

	async healthcheck() {
		await axios.get("/healthcheck", this.axiosCommonConfig);
	}

	async _post(operation: string, path: string, payload: EncryptionPayload | DecryptionPayload, rootLogger: Logger) {
		const logger = rootLogger.child({ keyAlias: this.keyAlias, operation });

		try {
			const started = new Date().getTime();

			const result = (await axios.post(path, payload, this.axiosPostConfig)).data;

			const finished = new Date().getTime();

			statsd.histogram(cryptorMetrics.clientHttpCallDuration, finished - started, { operation });
			// TODO: add statsd counter (maybe check with #help-cryptor if we already have this metric in sfx)
			// statsd.increment(cryptorMetrics.clientHttpSuccessCount, { operation });

			return result;
		} catch (e) {
			// Do not add { err: e } param to avoid logging payload
			logger.warn("Cryptor request failed: " + e?.message?.replace(payload["plainText"], "<censored>"));
			// TODO: add statsd counter
			// statsd.increment(cryptorMetrics.clientHttpFailedCount, { operation });
			throw e;
		}
	}
}
