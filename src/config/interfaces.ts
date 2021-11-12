import { RepoSyncState } from "../models/subscription";

export interface Subscriptions {
	id?: number;
	gitHubInstallationId: number;
	jiraHost: string;
	selectedRepositories?: null | number[];
	repoSyncState?: RepoSyncState | undefined;
	syncStatus?: string | undefined;
	syncWarning?: string | undefined;
	jiraClientKey: string;
	createdAt: Date;
	updatedAt: Date;
}

interface FailedInstallationHeaders {
	"access-control-allow-origin": string;
	"access-control-expose-headers": string;
	connection: string;
	"content-encoding": string;
	"content-security-policy": string;
	"content-type": string;
	date: string;
	"referrer-policy": string;
	server: string;
	"strict-transport-security": string;
	"transfer-encoding": string;
	vary: string;
	"x-content-type-options": string;
	"x-frame-options": string;
	"x-github-media-type": string;
	"x-github-request-id": string;
	"x-xss-protection": string;
}

interface FailledInstallationsRequestHeaders {
	accept: string;
	"user-agent": string;
	authorization: string;
}

interface FailledInstallationsRequestObjectValidateId {
	required: boolean;
	type: string;
}

interface FailledInstallationsRequestObjectValidate {
	installation_id: FailledInstallationsRequestObjectValidateId;
}

interface FailledInstallationsRequestObject {
	validate: FailledInstallationsRequestObjectValidate;
}

interface FailedInstallationRequest {
	method: string;
	url: string;
	headers: FailledInstallationsRequestHeaders;
	request: FailledInstallationsRequestObject;
}

interface FailedInstallationError {
	status: number;
	headers: FailedInstallationHeaders;
	request: FailedInstallationRequest;
	documentation_url: string;
}

export interface FailedInstallations {
	error: FailedInstallationError;
	id: string;
	deleted: boolean;
}
