import axios, { AxiosResponse } from "axios";

const Token = {
	getUserDetails: (token: string): Promise<AxiosResponse> => axios.get("https://api.github.com/user", {
		headers: { Authorization: `Bearer ${token}`}
	})
};

export default Token;
