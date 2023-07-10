import { Request, Response } from "express";

/* eslint-disable @typescript-eslint/no-unused-vars */
export const JwtHandler = async function restSymmetricMiddleware(_req: Request, res: Response) {
	res.locals.jiraHost = "blahblah";
};
