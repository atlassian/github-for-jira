import axios from "axios";

const getHeaders = (): Promise<string> => new Promise(resolve => {
	AP.context.getToken((token: string) => {
		resolve(token);
	});
});

const AxiosInstanceWithJWT = axios.create({
	timeout: 3000
});

// Adding the token in the headers through interceptors because it is an async value
AxiosInstanceWithJWT.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getHeaders();
	return config;
});

const AxiosInstanceWithGHToken = async (gitHubToken: string) => axios.create({
	timeout: 3000,
	headers: {
		"github-auth": gitHubToken,
		Authorization: await getHeaders()
	}
});

export {
	AxiosInstanceWithJWT,
	AxiosInstanceWithGHToken
};
