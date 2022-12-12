import { StatsCb, StatsD, Tags } from "hot-shots";
import { getLogger } from "./logger";
import { NextFunction, Request, Response } from "express";
import { isNodeProd, isNodeTest } from "utils/is-node-env";
import { metricHttpRequest } from "./metric-names";
import { envVars } from "./env";

export const globalTags = {
	environment: isNodeTest() ? "test" : process.env.MICROS_ENV || "",
	environment_type: isNodeTest() ? "testenv" : process.env.MICROS_ENVTYPE || "",
	region: process.env.MICROS_AWS_REGION || "us-west-1",
	micros_group: envVars.MICROS_GROUP
};

const RESPONSE_TIME_HISTOGRAM_BUCKETS = "100_1000_2000_3000_5000_10000_30000_60000";
const logger = getLogger("config.statsd");

export const statsd = new StatsD({
	prefix: "github-for-jira.",
	host: "platform-statsd",
	port: 8125,
	globalTags,
	errorHandler: (err) => {
		if (isNodeProd()) {
			logger.warn(err, "Error writing metrics");
		}
	},

	mock: !isNodeProd()
});

/**
 * High-resolution timer
 *
 * @returns {function(): number} A function to call to get the duration since this function was created
 */
const hrtimer = () => {
	const start = process.hrtime();

	return () => {
		const durationComponents = process.hrtime(start);
		const seconds = durationComponents[0];
		const nanoseconds = durationComponents[1];
		return seconds * 1000 + nanoseconds / 1e6;
	};
};

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
	(req.log || logger).debug({
		method: req.method,
		path: req.path,
		body: JSON.stringify(req.body),
		query: req.query
	}, `${method} request initialized for path ${req.path}`);

	res.once("finish", () => {
		const elapsedTime = elapsedTimeInMs();
		const statusCode = `${res.statusCode}`;
		const path = (req.baseUrl || "") + (req.route?.path || "/*");
		const tags = { path, method, statusCode };
		(req.log || logger).debug(`${method} request executed in ${elapsedTime} with status ${statusCode} path ${path}`);

		//Count response time metric
		statsd.histogram(metricHttpRequest.duration, elapsedTime, tags);

		//Publish bucketed histogram metric for the call duration
		statsd.histogram(metricHttpRequest.duration, elapsedTime,
			{
				...tags,
				gsd_histogram: RESPONSE_TIME_HISTOGRAM_BUCKETS
			}
		);

		//Count requests count
		statsd.increment(metricHttpRequest.executed, tags);
	});

	next();
};

/**
 * Async Function Timer using Distributions
 */
export const asyncDistTimer = (
	func: (...args: never[]) => Promise<unknown>,
	stat: string | string[],
	sampleRate?: number,
	tags?: Tags,
	callback?: StatsCb
) => {
	return (...args: never[]): Promise<unknown> => {
		const end = hrtimer();
		const p = func(...args);
		const recordStat = () =>
			statsd.distribution(stat, end(), sampleRate, tags, callback);
		p.then(recordStat, recordStat);
		return p;
	};

};
