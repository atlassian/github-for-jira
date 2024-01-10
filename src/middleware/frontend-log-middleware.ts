import { NextFunction, Request, Response } from "express";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags, stringFlag, StringFlags } from "config/feature-flags";
import { defaultLogLevel, getLogger } from "config/logger";
import { merge } from "lodash";
import { v4 as newUUID } from "uuid";
import { moduleUrls } from "~/src/routes/jira/atlassian-connect/jira-atlassian-connect-get";
import { matchRouteWithPattern } from "~/src/util/match-route-with-pattern";
import { ParamsDictionary } from "express-serve-static-core";

/*

This enhances the existing request logger, created by Probot.
https://github.com/probot/probot/blob/e20d3ce8f188f8266d6c1ab71aa245c110a0a26f/src/middleware/logging.ts

Works only for frontend endpoints; for webhooks endpoint (probot-managed) there's a different "fake" middleware:
src/github/github-webhook-middleware.ts (Probot doesn't allow to have middlewares for webhooks:
https://github.com/probot/probot/issues/598 )

See an example of how to use this in your routes below. Once added, `userId` is included in subsequent log messages.

```
app.get('/foo', async (req, res) => {
  req.addLogFields({ userId: req.params.userId })
  req.log.info('Hello from foo') // INFO -- Hello from foo (userId=123)

  try {
    doThing()
    res.status(200)
  } catch (err: unknown) {
    req.log.error('An error occurred') // ERROR -- An error occurred (userId=123)
    res.status(500)
  }
})
```

*/

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			addLogFields: (fields) => void;
			log: Logger;
		}
	}
}

export const LogMiddleware = async (req: Request<ParamsDictionary, unknown, { jiraHost?: string }>, res: Response, next: NextFunction): Promise<void> => {
	req.log = getLogger("frontend-log-middleware", {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-condition
		fields: req.log?.fields,
		level: await stringFlag(StringFlags.LOG_LEVEL, defaultLogLevel, getUnvalidatedJiraHost(req)),
		filterHttpRequests: true
	});

	req.addLogFields = (fields: Record<string, unknown>): void => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (req.log) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			req.log.fields = merge(req.log.fields, fields);
		}
	};

	const reqTraceId = req.headers["atl-traceid"] || newUUID();
	req.addLogFields({ id: reqTraceId });
	res.locals.reqTraceId = reqTraceId;

	res.once("finish", () => {
		booleanFlag(BooleanFlags.MAINTENANCE_MODE).then(maintenanceMode => {
			if ((res.statusCode < 200 || res.statusCode >= 500) && !(res.statusCode === 503 && maintenanceMode)) {
				req.log.warn({ res, req }, `Returning HTTP response of '${res.statusCode}' for path '${req.path}'`);
			}
		}).catch((err: unknown) => {
			req.log.error({ err }, "Error while checking maintenance mode flag");
		});
	});
	next();
};

const getUnvalidatedJiraHost = (req: Request<ParamsDictionary, unknown, { jiraHost?: string }>): string | undefined =>
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	req.session?.jiraHost || extractUnsafeJiraHost(req);

/**
 * Checks if the URL matches any of the URL patterns defined in `moduleUrls`
 */
const checkPathValidity = (url: string) => moduleUrls.some(moduleUrl => matchRouteWithPattern(moduleUrl, url));

const extractUnsafeJiraHost = (req: Request<ParamsDictionary, unknown, { jiraHost?: string } | undefined>): string | undefined => {
	if (checkPathValidity(req.path) && req.method == "GET") {
		// Only save xdm_e query when on the GET post install url (iframe url)
		return req.query.xdm_e as string;
	}

	if (["POST", "DELETE", "PUT"].includes(req.method)) {
		return req.body?.jiraHost;
	}

	const cookies = req.cookies as { jiraHost?: string } | undefined;
	if (cookies && cookies.jiraHost) {
		return cookies.jiraHost;
	}

	return undefined;
};
