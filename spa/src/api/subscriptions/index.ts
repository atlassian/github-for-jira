import { axiosRest, axiosRestWithGitHubToken } from "../axiosInstance";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	deleteSubscription: (subscriptionId: number) =>
		axiosRestWithGitHubToken.delete("/rest/app/cloud/subscription/:subscriptionId", { params: { subscriptionId } })
};
