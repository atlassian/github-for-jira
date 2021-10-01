import { NextFunction, Request, Response } from "express";
import Logger from "bunyan";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import {FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME} from "../config/logger";

/*

This enhances the existing request logger, created by Probot.
https://github.com/probot/probot/blob/e20d3ce8f188f8266d6c1ab71aa245c110a0a26f/src/middleware/logging.ts

Works only for frontend endpoints; for webhooks endpoint (probot-managed) there's a different "fake" middleware:
src/github/middleware.ts (Probot doesn't allow to have middlewares for webhooks:
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
		// These open interfaces may be extended in an application-specific manner via declaration merging.
		// See for example method-override.d.ts (https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/method-override/index.d.ts)
		interface Request {
			addLogFields: (fields) => void;
			log: Logger;
		}
	}
}

export default (req: Request, res: Response, next: NextFunction): void => {
	req.addLogFields = (fields: Record<string, unknown>): void => {
		if (req.log) {
			req.log = req.log.child(fields);
		} else {
			throw new Error(`No log found during request: ${req.method} ${req.path}`);
		}
	};

	req.log = req.log.child({name: FILTERING_FRONTEND_HTTP_LOGS_MIDDLEWARE_NAME});

	res.once("finish", async () => {
		if ((res.statusCode < 200 || res.statusCode >= 500) && !(res.statusCode === 503 && await booleanFlag(BooleanFlags.MAINTENANCE_MODE, false))) {
			req.log.warn({ res, req }, `Returning HTTP response of '${res.statusCode}' for path '${req.path}'`);
		}
	});

	next();
};
