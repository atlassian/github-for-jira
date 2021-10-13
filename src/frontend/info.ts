import { Request, Response } from "express";

export default (_: Request, res: Response) => {
	res.send({
		id: process.env.COMMIT_SHA,
		date: process.env.COMMIT_DATE
	});
};
