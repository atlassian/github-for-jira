import { canBeUsedAsApiKeyHeader } from "utils/http-headers";

export const validateApiKeyInputsAndReturnErrorIfAny = (apiKeyHeaderName: string | undefined, apiKeyValue: string | undefined) => {
	if (apiKeyHeaderName) {
		let error: string | undefined = undefined;
		if (!apiKeyValue) {
			error = "apiKeyHeaderName was provided but apiKeyValue was empty";
		}
		if (!canBeUsedAsApiKeyHeader(apiKeyHeaderName)) {
			error = "Provided apiKeyHeaderName cannot be used as API key header";
		}
		if (apiKeyHeaderName.length > 1024) {
			error = "apiKeyHeaderName max length is 1024";
		}
		if (apiKeyValue && apiKeyValue.length > 8096) {
			error = "apiKeyValue max length is 8096";
		}
		return error;
	}
	if (apiKeyValue && !apiKeyHeaderName) {
		return "cannot use apiKeyValue without apiKeyHeaderName";
	}
	return undefined;
};
