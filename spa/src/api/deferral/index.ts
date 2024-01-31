import {
	DeferralParsedRequest,
	DeferredInstallationUrlParams,
	GetDeferredInstallationUrl
} from "rest-interfaces";
import { axiosRest, axiosRestWithNoJwtButWithGitHubToken } from "../axiosInstance";

export default {
	getDeferredInstallationUrl: (params: DeferredInstallationUrlParams) =>
		axiosRest.get<GetDeferredInstallationUrl>("/rest/app/cloud/deferred/installation-url", { params }),
	connectDeferredOrg: (requestId: string) => axiosRestWithNoJwtButWithGitHubToken.post(`/rest/app/cloud/deferred/connect/${requestId}`),
	parseDeferredRequestId: (requestId: string) => axiosRestWithNoJwtButWithGitHubToken.get<DeferralParsedRequest>(`/rest/app/cloud/deferred/parse/${requestId}`)
};

