import { NextFunction, Request, Response } from "express";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags, stringFlag, StringFlags } from "config/feature-flags";
import { defaultLogLevel, getLogger } from "config/logger";
import { getUnvalidatedJiraHost } from "middleware/jirahost-middleware";
import { merge } from "lodash";
import { v4 as newUUID } from "uuid";

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
  } catch (err) {
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

export const LogMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	req.log = getLogger("frontend-log-middleware", {
		fields: req.log?.fields,
		level: await stringFlag(StringFlags.LOG_LEVEL, defaultLogLevel, getUnvalidatedJiraHost(req)),
		filterHttpRequests: true
	});
	req.addLogFields = (fields: Record<string, unknown>): void => {
		if (req.log) {
			req.log.fields = merge(req.log.fields, fields);
		}
	};

	req.addLogFields({ id: newUUID() });

	res.once("finish", async () => {
		if ((res.statusCode < 200 || res.statusCode >= 500) && !(res.statusCode === 503 && await booleanFlag(BooleanFlags.MAINTENANCE_MODE, false))) {
			req.log.warn({ res, req }, `Returning HTTP response of '${res.statusCode}' for path '${req.path}'`);
		}
	});
	next();
};