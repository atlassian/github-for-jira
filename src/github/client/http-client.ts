import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export const TEN_MINUTES = 10 * 60 * 1000;
export const ONE_MINUTE = 60 * 1000;

export class AuthToken {
	readonly token: string;
	readonly expirationDate: Date;

	constructor(token: string, expirationDate: Date) {
		this.token = token;
		this.expirationDate = expirationDate;
	}

	isAboutToExpire(now: Date): boolean {
		return now.getTime() + ONE_MINUTE > this.expirationDate.getTime();
	}

	millisUntilAboutToExpire(now: Date) {
		return Math.max(this.expirationDate.getTime() - ONE_MINUTE - now.getTime(), 0);
	}
}

/**
 * Base class for HTTP clients that provides an axios client and some options to configure it.
 */
export default abstract class HttpClient<CONTEXT> {

	protected readonly axios: AxiosInstance;
	protected readonly context: CONTEXT;

	protected constructor(baseURL: string, context: CONTEXT) {
		this.axios = axios.create({
			baseURL
		});

		this.context = context;

		this.axios.interceptors.response.use(
			this.onResponse(this.context),
			this.onResponseError(this.context),
		);

		this.axios.interceptors.request.use(
			this.onRequest(this.context),
			this.onRequestError(this.context)
		)
	}

	/**
	 * Override to intercept axios' requests.
	 */
	protected onRequest(_: CONTEXT): (config: AxiosRequestConfig) => Promise<AxiosRequestConfig> {
		return async (config: AxiosRequestConfig) => config;
	}

	/**
	 * Override to intercept axios' request errors.
	 */
	protected onRequestError(_: CONTEXT): (error: AxiosError) => Promise<AxiosError> {
		return async (error: AxiosError) => error;
	}

	/**
	 * Override to intercept axios' responses.
	 */
	protected onResponse(_: CONTEXT): (response: AxiosResponse) => Promise<AxiosResponse> {
		return async (response: AxiosResponse) => response;
	}

	/**
	 * Override to intercept axios' response errors.
	 */
	protected onResponseError(_: CONTEXT): (error: AxiosError) => Promise<AxiosError> {
		return async (error: AxiosError) => Promise.reject(error);
	}
}
