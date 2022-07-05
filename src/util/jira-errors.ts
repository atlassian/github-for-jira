interface MessageAndCode {
	message: string;
	statusCode: number;
}

interface GheServerUrlErrorResponses {
	[key: string]: MessageAndCode;
}

interface GheServerUrlErrors {
	codeOrStatus: GheServerUrlErrorResponses
}

export const gheServerUrlErrors: GheServerUrlErrors = {
	codeOrStatus: {
		ENOTFOUND: {
			message: "Please make sure you've entered the correct URL and check that you've properly configured the hole in your firewall.",
			statusCode: 200
		},
		502: {
			message: "We weren't able to complete your request. Please try again.",
			statusCode: 502
		},
		default: {
			message: "We ran into a hiccup while verifying your details. Please try again later.",
			statusCode: 200
		}
	}
};
