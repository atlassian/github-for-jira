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
	headers: any;
	request: FailedInstallationRequest;
	documentation_url: string;
}

export interface FailedInstallations {
	error: FailedInstallationError;
	id: number;
	deleted: boolean;
}
