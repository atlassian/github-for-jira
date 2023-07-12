import axios, { AxiosResponse } from "axios";
import { OrganizationsResponse, UsersGetAuthenticatedResponse } from "../../rest-interfaces/oauth-types";
import { AxiosInstanceWithGHToken } from "../axiosInstance";

const Token = {
	getUserDetails: (token: string): Promise<AxiosResponse<UsersGetAuthenticatedResponse>> => axios.get("https://api.github.com/user", {
		headers: { Authorization: `Bearer ${token}`}
	}),
	getOrganizations: async (token: string): Promise<AxiosResponse<OrganizationsResponse>> => {
		const instance = await AxiosInstanceWithGHToken(token);
		return instance.get("/rest/app/cloud/org");
	}
};

export default Token;
