import { axiosRest } from "../axiosInstance";
import { RestSyncReqBody } from "~/src/rest-interfaces";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	deleteSubscription: (subscriptionId: number) =>
		axiosRest.delete(`/rest/app/cloud/subscriptions/${subscriptionId}`),
	syncSubscriptions: (subscriptionId: number, reqBody: RestSyncReqBody) =>
		axiosRest.post(`/rest/app/cloud/subscriptions/${subscriptionId}/sync`, reqBody),
};
