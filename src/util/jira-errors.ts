interface MessageAndCode {
	error: string;
	message: string;
	statusCode: number;
	type?: string;
}

interface GheServerUrlErrorResponses {
	[key: string | number]: MessageAndCode;
}

interface GheServerUrlErrors {
	codeOrStatus: GheServerUrlErrorResponses
}

export const gheServerUrlErrors: GheServerUrlErrors = {
	codeOrStatus: {
		ENOTFOUND: {
			error: "We couldn't verify this URL",
			message: "Please make sure you've entered the correct URL and check that you've properly configured the hole in your firewall.",
			statusCode: 200,
			type: "FIREWALL_ERROR"
		},
		502: {
			error: "Request failed",
			message: "We weren't able to complete your request. Please try again.",
			statusCode: 502
		},
		default: {
			error: "Something went wrong",
			message: "We ran into a hiccup while verifying your details. Please try again later.",
			statusCode: 200
		}
	}
};
