import { UsersGetAuthenticatedResponse } from "rest-interfaces";
import { axiosGitHub } from "../axiosInstance";

export default {
	getUserDetails: () => axiosGitHub.get<UsersGetAuthenticatedResponse>("https://api.github.com/user"),
};
