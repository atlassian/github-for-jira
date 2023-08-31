import { AxiosError, AxiosResponse } from "axios";

export function mockAxiosResponse(status: number, data: any): AxiosResponse {
	return {
		status,
		data
	} as any;
}

export function mockAxiosError(errorCode: string) {
	return new AxiosError(
		"whatever", //message?: string,
		"doens't matter", //code?: string,
		{} as any, //config?: InternalAxiosRequestConfig<D>,
		{} as any, //request?: any,
		{
			data: {
				errorCode
			}
		} as any, //response?: AxiosResponse<T, D>
	);
}
