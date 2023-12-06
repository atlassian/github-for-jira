import { RestSyncReqBody } from "~/src/rest-interfaces";
import { axiosRest } from "../axiosInstance";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	syncSubscriptions: (data: RestSyncReqBody) => axiosRest.post(`/rest/app/cloud/sync`, data),
};
