import { OrganizationsResponse } from "rest-interfaces";
import { axiosRestWithGitHubToken } from "../axiosInstance";

export default {
	getOrganizations: () => axiosRestWithGitHubToken.get<OrganizationsResponse>("/rest/app/cloud/org"),
	connectOrganization: (orgId: number) => axiosRestWithGitHubToken.post<void>("/rest/app/cloud/org", { installationId: orgId }),
};
