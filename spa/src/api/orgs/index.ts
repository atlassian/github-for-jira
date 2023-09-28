import { OrganizationsResponse } from "rest-interfaces";
import { axiosRestWithGitHubToken } from "../axiosInstance";

export default {
	getOrganizations: () => axiosRestWithGitHubToken.get<OrganizationsResponse>("/rest/app/cloud/org"),
	connectOrganization: (orgId: number) => axiosRestWithGitHubToken.post<OrganizationsResponse>("/rest/app/cloud/org", { installationId: orgId }),
	checkOrgOwnership: (githubInstallationId: number) =>
		axiosRestWithGitHubToken.get<OrganizationsResponse>("/rest/app/cloud/org/ownership", { params: { githubInstallationId } }),
};
