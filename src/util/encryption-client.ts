import { envVars } from "config/env";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { retry } from "ts-retry-promise";
import { isNodeTest } from "utils/is-node-env";

export enum EncryptionSecretKeyEnum {
	GITHUB_SERVER_APP = "github-server-app-secrets",
	JIRA_INSTANCE_SECRETS = "jira-instance-secrets"
}

export type EncryptionContext = Record<string, string | number>;

interface EncryptResponse {
	cipherText: string;
}

interface DecryptResponse {
	plainText: string;
}

// We don't want to sleep in tests
const DELAY = isNodeTest() ? 10 : 500;

/**
 * This client calls Cryptor side-car to encrypt/decrypt data.
 *
 * How to use:
 *
 * - Without encryption context: Same, but just don't pass the context
 *   const encrypted = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "super-secret-secret");
 *
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class EncryptionClient {

	protected static readonly axios: AxiosInstance = axios.create({
		baseURL: envVars.CRYPTOR_URL,
		headers: {
			"X-Cryptor-Client": envVars.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE,
			"Content-Type": "application/json; charset=utf-8"
		}
	});

	static async encrypt(secretKey: EncryptionSecretKeyEnum, plainText: string, encryptionContext: EncryptionContext = {}): Promise<string> {
		return await retry(async () => {
			const response = await this.axios.post<EncryptResponse>(`/cryptor/encrypt/micros/github-for-jira/${secretKey}`, {
				plainText,
				encryptionContext
			});
			return response.data.cipherText;
		}, { retries: 5, delay: DELAY });
	}

	static async decrypt(cipherText: string, encryptionContext: EncryptionContext = {}): Promise<string> {
		return await retry(async () => {
			const response = await this.axios.post<DecryptResponse>(`/cryptor/decrypt`, {
				cipherText,
				encryptionContext
			});
			return response.data.plainText;
		}, { retries: 5, delay: DELAY });
	}

	static async healthcheck(): Promise<AxiosResponse> {
		return await this.axios.get("/healthcheck");
	}

	static async deepcheck(): Promise<string[]> {
		return await Promise.all([
			EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "healthcheck-test-github-server-app")
				.then(value => EncryptionClient.decrypt(value)),
			EncryptionClient.encrypt(EncryptionSecretKeyEnum.JIRA_INSTANCE_SECRETS, "healthcheck-test-jira-instance-secret")
				.then(value => EncryptionClient.decrypt(value))
		]);
	}
}
