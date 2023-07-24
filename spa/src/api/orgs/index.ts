import { OrganizationsResponse } from "../../rest-interfaces/oauth-types";
import { axiosRestWithGitHubToken } from "../axiosInstance";

export default {
	getOrganizations: () => axiosRestWithGitHubToken.get<OrganizationsResponse>("/rest/app/cloud/org"),
	searchOrganization: (orgName: string) => axiosRestWithGitHubToken.get(`/rest/app/cloud/org/${orgName}`),
	connectOrganization: (orgId: number) => axiosRestWithGitHubToken.post<OrganizationsResponse>("/rest/app/cloud/org", { installationId: orgId }),
};
