import AxiosInstance from "../../utils/axiosInstance";

const GitHubAuth = {
	authenticate: () => AxiosInstance.get("/rest/app/cloud/oauth/redirectUrl")
};

export default GitHubAuth;
