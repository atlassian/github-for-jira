import { StatsD, Tags } from "hot-shots";
import { getLogger } from "./logger";
import { NextFunction, Request, Response } from "express";
import { isNodeProd, isNodeTest } from "utils/is-node-env";
import { metricHttpRequest } from "./metric-names";
import { envVars } from "./env";
import { isTestJiraHost } from "./jira-test-site-check";

export const globalTags = {
	environment: isNodeTest() ? "test" : process.env.MICROS_ENV || "",
	environment_type: isNodeTest() ? "testenv" : process.env.MICROS_ENVTYPE || "",
	region: process.env.MICROS_AWS_REGION || "us-west-1",
	micros_group: envVars.MICROS_GROUP
};

const RESPONSE_TIME_HISTOGRAM_BUCKETS = "100_1000_2000_3000_5000_10000_30000_60000";
const logger = getLogger("config.statsd");

const innerStatsd = new StatsD({
	prefix: "github-for-jira.",
	host: envVars.MICROS_PLATFORM_STATSD_HOST,
	port: Number(envVars.MICROS_PLATFORM_STATSD_PORT),
	globalTags,
	errorHandler: (err) => {
		if (isNodeProd()) {
			logger.warn(err, "Error writing metrics");
		}
	},

	mock: !isNodeProd()
});

type ObjectTags = { [key: string]: string };
type ExtraInfo = {
	jiraHost?: string
}

const wrapTestSiteTags = (tags: ObjectTags, extraInfo: ExtraInfo): Tags => {
	return {
		...tags,
		isTestJiraHost: String(isTestJiraHost(extraInfo.jiraHost))
	};
};

const increment = (stat: string | string[], tags: ObjectTags, extraInfo: ExtraInfo): void => {
	innerStatsd.increment(stat, 1, wrapTestSiteTags(tags, extraInfo));
};

const incrementWithValue = (stat: string | string[], value: number, tags: ObjectTags, extraInfo: ExtraInfo): void => {
	innerStatsd.increment(stat, value, wrapTestSiteTags(tags, extraInfo));
};

const histogram = (stat: string | string[], value: number, tags: ObjectTags, extraInfo: ExtraInfo): void => {
	innerStatsd.histogram(stat, value, wrapTestSiteTags(tags, extraInfo));
};

//TODO: might remove this one, seem same as histgram
const timing = (stat: string | string[], value: number | Date, sampleRate: number, tags: ObjectTags, extraInfo: ExtraInfo) => {
	innerStatsd.timing(stat, value, sampleRate, wrapTestSiteTags(tags, extraInfo));
};

export const statsd = {
	increment,
	incrementWithValue,
	histogram,
	timing
};

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
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	(req.log || logger).debug({
		method: req.method,
		path: req.path,
		body: JSON.stringify(req.body),
		query: req.query
	}, `${method} request initialized for path ${req.path}`);

	res.once("finish", () => {
		const elapsedTime = elapsedTimeInMs();
		const statusCode = `${res.statusCode}`;
		const path = (req.baseUrl || "") + ((req.route as { path?: string; } | undefined)?.path || "/*");
		const tags = { path, method, statusCode };
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		(req.log || logger).debug(`${method} request executed in ${elapsedTime} with status ${statusCode} path ${path}`);

		//Count response time metric
		innerStatsd.histogram(metricHttpRequest.duration, elapsedTime, tags);

		//Publish bucketed histogram metric for the call duration
		innerStatsd.histogram(metricHttpRequest.duration, elapsedTime,
			{
				...tags,
				gsd_histogram: RESPONSE_TIME_HISTOGRAM_BUCKETS
			}
		);

		//Count requests count
		innerStatsd.increment(metricHttpRequest.executed, tags);
	});

	next();
};

