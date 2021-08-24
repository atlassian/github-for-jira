import { NextFunction, Request, Response } from "express";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import Logger from "bunyan";

export const logExpressErrorResponse = (logger?: Logger) =>
	(req: Request, res: Response, next: NextFunction) => {
		res.once("finish", async () => {
			// if status is under 200 or higher/equal to 400, but not 503 in maintenance mode, log it to figure out issues
			if ((res.statusCode < 200 || res.statusCode >= 400) && !(res.statusCode === 503 && await booleanFlag(BooleanFlags.MAINTENANCE_MODE, false))) {
				(logger || req.log).warn({ res, req }, `Returning HTTP response of '${res.statusCode}' for path '${req.path}'`);
			}
		});
		next();
	};
