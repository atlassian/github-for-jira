import { axiosRest } from "../axiosInstance";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions")
};
