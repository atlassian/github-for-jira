import { axiosRest } from "../axiosInstance";

export default {
	getSubscriptions: () => axiosRest.get("/rest/subscriptions"),
	syncSubscriptions: (data: {
		installationId: number;
		commitsFromDate: string;
		source: string;
		syncType: string;
	}) => axiosRest.post(`/rest/app/cloud/sync`, data),
};
