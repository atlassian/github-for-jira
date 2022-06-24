import  { envVars } from "config/env";
import axios, { AxiosRequestConfig } from "axios";
import { statsd } from "config/statsd";
import { cryptorMetrics } from "config/metric-names";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

// TODO: add description
// TODO: test that the local dev loop is not broken
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

	async encrypt(logger: LoggerWithTarget, plainText: string, encryptionContext: any = {}): Promise<string> {
		const { cipherText } = await this._post('encrypt', `/cryptor/encrypt/${this.keyAlias}`, {
			plainText, encryptionContext
		}, logger);
		return cipherText;
	}

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
			// TODO: add statsd counter

			return result;
		} catch (e) {
			// Do not add { err: e } param to avoid logging payload
			logger.warn("Cryptor request failed: " + e?.message?.replace(data, "<censored>"));
			// TODO: add statsd counter
			throw e;
		}
	}
}
