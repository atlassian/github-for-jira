import { axiosRest, axiosRestWithGitHubToken } from "../axiosInstance";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	deleteSubscription: (installationId: number) =>
		axiosRestWithGitHubToken.delete("/rest/app/cloud/subscription/:installationId", { params: { installationId } })
};
