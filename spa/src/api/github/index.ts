import { UsersGetAuthenticatedResponse } from "../../rest-interfaces/oauth-types";
import { axiosGitHub } from "../axiosInstance";

export default {
	getUserDetails: () => axiosGitHub.get<UsersGetAuthenticatedResponse>("https://api.github.com/user"),
};
