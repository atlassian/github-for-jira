import { OrganizationsResponse } from "../../rest-interfaces/oauth-types";
import { axiosRestWithGitHubToken } from "../axiosInstance";

export default {
	getOrganizations: async () => axiosRestWithGitHubToken.get<OrganizationsResponse>("/rest/app/cloud/org"),
	connectOrganization: async (orgId: number) => axiosRestWithGitHubToken.post<OrganizationsResponse>("/rest/app/cloud/org", { installationId: orgId }),
};
