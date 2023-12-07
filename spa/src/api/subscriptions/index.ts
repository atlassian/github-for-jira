
import { axiosRest, axiosRestWithGitHubToken } from "../axiosInstance";
import { RestSyncReqBody } from "~/src/rest-interfaces";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	deleteSubscription: (subscriptionId: number) =>
		axiosRestWithGitHubToken.delete("/rest/app/cloud/subscription/:subscriptionId", { params: { subscriptionId } }),
	syncSubscriptions: (data: RestSyncReqBody) => axiosRest.post(`/rest/app/cloud/sync`, data),

};
