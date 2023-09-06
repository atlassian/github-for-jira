import { createHmac, createHash } from "crypto";
import { envVars } from "../config/env";
import { metricPerf } from "config/metric-names";
import { statsd } from "config/statsd";

export const createHashWithSharedSecret = (data?: string): string => {
	if (!data) {
		return "";
	}

	const started = Date.now();
	try {
		const cleanedData = removeNonAlphaNumericCharacters(data);
		return createHmac("sha256", envVars.GLOBAL_HASH_SECRET)
			.update(cleanedData)
			.digest("hex");
	} finally {
		const finished = Date.now();
		statsd.histogram(metricPerf.hashWithSharedSecretHist, finished-started, { } ,{ });
		statsd.increment(metricPerf.hashWithSharedSecretCnt, { }, { });
	}
};

export const createHashWithoutSharedSecret = (data: string | null | undefined) => {
	if (!data) {
		return "";
	}
	const started = Date.now();
	try {
		return createHash("sha256").update(data).digest("hex");
	} finally {
		const finished = Date.now();
		statsd.histogram(metricPerf.hashWithoutSharedSecretHist, finished-started, { } ,{ });
		statsd.increment(metricPerf.hashWithoutSharedSecretCnt, { }, { });
	}

};

const removeNonAlphaNumericCharacters = (str: string): string => {
	return str.replace(/[^\p{L}\p{N}]+/ug, ""); // Tests all unicode characters and only keeps Letters and Numbers
};
