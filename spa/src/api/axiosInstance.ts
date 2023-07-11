import axios from "axios";

const getHeaders = (): Promise<string> => new Promise(resolve => {
	AP.context.getToken((token: string) => {
		resolve(token);
	});
});

const InternalAxiosInstance = axios.create({
	timeout: 3000
});

// Adding the token in the headers through interceptors because it is an async value
InternalAxiosInstance.interceptors.request.use(async (config) => {
	config.headers.Authorization = await getHeaders();
	return config;
});

export default InternalAxiosInstance;
