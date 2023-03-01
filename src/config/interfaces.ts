import { Octokit } from "@octokit/rest";

interface FailedInstallationsRequestHeaders {
	accept: string;
	"user-agent": string;
	authorization: string;
}

interface FailedInstallationsRequestObjectValidateId {
	required: boolean;
	type: string;
}

interface FailedInstallationsRequestObjectValidate {
	installation_id: FailedInstallationsRequestObjectValidateId;
}

interface FailedInstallationsRequestObject {
	validate: FailedInstallationsRequestObjectValidate;
}

interface FailedInstallationRequest {
	method: string;
	url: string;
	headers: FailedInstallationsRequestHeaders;
	request: FailedInstallationsRequestObject;
}

interface FailedInstallationError {
	status: number;
	headers: Record<string, string>;
	request: FailedInstallationRequest;
	documentation_url: string;
}

export interface AppInstallation extends Octokit.AppsGetInstallationResponse {
	syncStatus?: string;
	syncWarning?: string;
	totalNumberOfRepos?: number;
	numberOfSyncedRepos?: number;
	subscriptionId?: number,
	jiraHost: string;
}

export interface FailedAppInstallation {
	error: FailedInstallationError;
	id: number;
	deleted: boolean;
}
