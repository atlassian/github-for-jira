import axios from "axios";

const getHeaders = (): Promise<string> => new Promise(resolve => {
	AP.context.getToken((token: string) => {
		resolve(token);
	});
});

const AxiosInstance = axios.create({
	timeout: 3000,
	headers: {
		Authorization: await getHeaders()
	}
});

export default AxiosInstance;
