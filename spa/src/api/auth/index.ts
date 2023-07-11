import AxiosInstance from "../axiosInstance";

const GitHubAuth = {
	authenticate: () => AxiosInstance.get("/rest/app/cloud/oauth/redirectUrl")
};

export default GitHubAuth;
