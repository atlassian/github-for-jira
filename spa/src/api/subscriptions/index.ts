import { axiosRest } from "../axiosInstance";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	syncSubscriptions: (data: {
		installationId: number;
		commitsFromDate: string;
		appId?: number;
		source: string;
		syncType: string;
	}) => axiosRest.post("/rest/sync", data),
};
