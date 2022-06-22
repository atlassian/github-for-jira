import  { envVars } from "config/env";
import axios, { AxiosInstance } from "axios";
import { statsd } from "config/statsd";
import { cryptorMetrics } from "config/metric-names";

export class CryptorHttpClient {

	private readonly axios: AxiosInstance;
	private readonly keyAlias: string;

	constructor(keyAlias) {
		this.keyAlias = keyAlias;
		this.axios = axios.create({
			baseURL: envVars.CRYPTOR_SIDECAR_BASE_URL,
			headers: {
				'X-Cryptor-Client': envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
				'Content-Type': 'application/json; charset=utf-8'
			},
			timeout: Number(envVars.CRYPTOR_SIDECAR_TIMEOUT_MSEC)
		});
	}

	async encrypt(plainText) {
		const { cipherText } = await this._post('encrypt', `/cryptor/encrypt/${this.keyAlias}`, JSON.stringify({
			plainText
		}));
		return cipherText;
	}

	async decrypt(cipherText) {
		const { plainText } = await this._post('decrypt', `/cryptor/decrypt/${this.keyAlias}`, JSON.stringify({
			cipherText
		}));

		return plainText;
	}

	async _post(operation, path, bodyJsonStr: string) {
		const started = new Date().getTime();
		const result = (await this.axios.post(path, bodyJsonStr)).data;
		const finished = new  Date().getTime();

		statsd.histogram(cryptorMetrics.clientHttpCallDuration, finished - started, { operation });

		return result;
	}
}
