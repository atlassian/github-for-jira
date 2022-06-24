import  { envVars } from "config/env";
import axios from "axios";
import { statsd } from "config/statsd";
import { cryptorMetrics } from "config/metric-names";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

export class CryptorHttpClient {

	private readonly keyAlias: string;

	constructor(keyAlias) {
		this.keyAlias = keyAlias;
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

	// TODO: add type for data
	async _post(operation, path, data: any, rootLogger: LoggerWithTarget) {
		const logger = rootLogger.child({ keyAlias: this.keyAlias, operation });

		try {
			const started = new Date().getTime();

			const config = {
				baseURL: envVars.CRYPTOR_SIDECAR_BASE_URL,
				headers: {
					'X-Cryptor-Client': envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
					'Content-Type': 'application/json; charset=utf-8'
				},
				timeout: Number(envVars.CRYPTOR_SIDECAR_TIMEOUT_MSEC)
			};
			logger.info({ config, data });
			const result = (await axios.post(path, data, config)).data;

			const finished = new Date().getTime();

			statsd.histogram(cryptorMetrics.clientHttpCallDuration, finished - started, { operation });
			// TODO: add statsd counter

			return result;
		} catch (e) {
			// Do not add { err: e } param because the error might contain
			// TODO: check when decryption is failing
			logger.warn("Cryptor request failed: " + e?.message?.replace(data, "<censored>"));
			// TODO: add call to healthcheck in deepcheck
			// TODO: add statsd counter
			throw e;
		}
	}
}
