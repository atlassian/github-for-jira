import axios from "axios";

const getHeaders = (): Promise<string> => new Promise(resolve => {
	AP.context.getToken((token: string) => {
		resolve(token);
	});
});

const AxiosInstance = axios.create({
	timeout: 3000
});

// Adding the token in the headers through interceptors because it is an async value
AxiosInstance.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getHeaders();
	return config;
});

export default AxiosInstance;
