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
	headers: any;
	request: FailedInstallationRequest;
	documentation_url: string;
}

export interface FailedInstallations {
	error: FailedInstallationError;
	id: number;
	deleted: boolean;
}
