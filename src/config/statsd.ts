import { StatsCb, StatsD, Tags } from "hot-shots";
import { getLogger } from "./logger";
import { NextFunction, Request, Response } from "express";
import { isNodeDev, isNodeTest } from "../util/isNodeEnv";
import {metricHttpRequest} from "./metric-names";

export const globalTags = {
	environment: isNodeTest() ? "test" : process.env.MICROS_ENV || "",
	environment_type: isNodeTest() ? "testenv" : process.env.MICROS_ENVTYPE || "",
	deployment_id: process.env.MICROS_DEPLOYMENT_ID || "1",
	region: process.env.MICROS_AWS_REGION || "localhost"
};

const RESPONSE_TIME_HISTOGRAM_BUCKETS =	"100_1000_2000_3000_5000_10000_30000_60000";
const logger = getLogger("config.statsd");

const statsd = new StatsD({
	prefix: "github-for-jira.",
	host: "platform-statsd",
	port: 8125,
	globalTags,
	errorHandler: (err) => {
		if (!isNodeDev()) {
			logger.warn(err, "Error writing metrics");
		}
	},

	mock: isNodeTest()
});

/**
 * High-resolution timer
 *
 * @returns {function(): number} A function to call to get the duration since this function was created
 */
function hrtimer() {
	const start = process.hrtime();

	return () => {
		const durationComponents = process.hrtime(start);
		const seconds = durationComponents[0];
		const nanoseconds = durationComponents[1];
		return seconds * 1000 + nanoseconds / 1e6;
	};
}

/**
 * Returns a middleware function which produce duration and requests count metrics
 * @param path The value of the "path" tag. If not set then the rout path will be used
 */
export const elapsedTimeMetrics = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const elapsedTimeInMs = hrtimer();
	const method = req.method;

	res.once("finish", () => {
		const pathTag = req.route?.path || ((req.baseUrl || "/") + "*" );
		const elapsedTime = elapsedTimeInMs();
		const statusCode  = `${res.statusCode}`;
		const tags = { path: pathTag, method,  statusCode};
		(req.log || logger).debug(`Request executed in ${elapsedTime} with status ${statusCode} path ${pathTag}`)

		//Count response time metric
		statsd.histogram(metricHttpRequest.duration, elapsedTime, tags);

		//Publish bucketed histogram metric for the call duration
		statsd.histogram(metricHttpRequest.duration, elapsedTime,
			{...tags,
				gsd_histogram: RESPONSE_TIME_HISTOGRAM_BUCKETS
			}
		);

		//Count requests count
		statsd.increment(metricHttpRequest.executed, tags)
	});

	next();
};

/**
 * Async Function Timer using Distributions
 */
export function asyncDistTimer(
	func: (...args: never[]) => Promise<unknown>,
	stat: string | string[],
	sampleRate?: number,
	tags?: Tags,
	callback?: StatsCb
) {
	return (...args: never[]): Promise<unknown> => {
		const end = hrtimer();
		const p = func(...args);
		const recordStat = () =>
			statsd.distribution(stat, end(), sampleRate, tags, callback);
		p.then(recordStat, recordStat);
		return p;
	};
}

export default statsd;
