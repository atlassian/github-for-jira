import Logger from "bunyan";

const counters: Record<string, number> = {};
export const logInfoSampled = (logger: Logger, key: string, msg: string, sampledRate: number) => {
	let cnt = counters[key] || 0;
	if (cnt === 0) {
		logger.info({ sampled: true }, msg + " (sampled)");
	}
	cnt ++;
	if (cnt >= sampledRate) {
		cnt = 0;
	}
	counters[key] = cnt;
};
