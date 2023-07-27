import { Request, Response, NextFunction } from "express";

/*eslint-disable @typescript-eslint/no-explicit-any */
export const RestErrorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {

	const status = parseInt(err.status) || 500;

	if (status >= 500) {
		req.log.error({ err }, "Error happen during rest api");
	} else {
		req.log.warn({ err }, "Error happen during rest api");
	}

	res.status(status).send(err.message);
};

