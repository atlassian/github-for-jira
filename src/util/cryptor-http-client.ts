import  { envVars } from "config/env";
import axios, { AxiosError } from "axios";
import { statsd } from "config/statsd";
import { cryptorMetrics } from "config/metric-names";
import { LoggerWithTarget } from "probot/lib/wrap-logger";

import 'axios-debug-log/enable';
import config from 'axios-debug-log';



export class CryptorHttpClient {

	private readonly keyAlias: string;

	constructor(keyAlias) {
		this.keyAlias = keyAlias;
	}

	async encrypt(plainText, logger: LoggerWithTarget) {
		const { cipherText } = await this._post('encrypt', `/cryptor/encrypt/${this.keyAlias}`, {
			plainText
		}, logger);
		return cipherText;
	}

	async decrypt(cipherText, logger: LoggerWithTarget) {
		const { plainText } = await this._post('decrypt', `/cryptor/decrypt`, {
			cipherText
		}, logger);

		return plainText;
	}

	async _post(operation, path, data: any, rootLogger: LoggerWithTarget) {

		config(({
			request: function (_, config) {
				rootLogger.info({ config }, 'request');
			},
			response: function (_, response) {
				rootLogger.info({ response }, "response");
			},
			error: function (_, error) {
				rootLogger.info({ error }, "error");
			}
		}));

		const instance = axios.create({
			baseURL: 'http://localhost:8083', //envVars.CRYPTOR_SIDECAR_BASE_URL,
			headers: {
				'X-Cryptor-Client': envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
				'Content-Type': 'application/json; charset=utf-8'
			},
			timeout: Number(envVars.CRYPTOR_SIDECAR_TIMEOUT_MSEC)
		});
		const logger = rootLogger.child({ keyAlias: this.keyAlias, operation });
		logger.info(`${operation} ${path} ${JSON.stringify(data)}`);

		instance.interceptors.request.use((config) => {
			// TODO: change to debug
			logger.info({ config }, "Cryptor Request Started");
			return config;
		});
		instance.interceptors.response.use(
			(response) => {
				logger.info(
					// TODO change to debug
					{
						res: response
					},
					`Successful Cryptor request`
				);

				return response;
			},
			(error: AxiosError): Promise<Error> => {

				const status = error?.response?.status;
				const errorMessage = "Error executing Axios Request " + (status || '') + ' ' + (error?.message || "");
				const isWarning = status && (status >= 300 && status < 500 && status !== 400);

				(isWarning ? logger.warn : logger.error)({ err: error, res: error?.response }, errorMessage);
				return Promise.reject(new Error(errorMessage));
			}
		);

		const started = new Date().getTime();
		const result = (await instance.post(path, data)).data;
		const finished = new  Date().getTime();

		statsd.histogram(cryptorMetrics.clientHttpCallDuration, finished - started, { operation });

		return result;
	}
}
