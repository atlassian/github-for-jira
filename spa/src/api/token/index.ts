import axios, { AxiosResponse } from "axios";
import { UsersGetAuthenticatedResponse } from "../../rest-interfaces/oauth-types";

const Token = {
	getUserDetails: (token: string): Promise<AxiosResponse<UsersGetAuthenticatedResponse>> => axios.get("https://api.github.com/user", {
		headers: { Authorization: `Bearer ${token}`}
	})
};

export default Token;
