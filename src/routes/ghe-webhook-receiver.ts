
import { Request, Response } from "express";

export const GheWebhookReceiver = async (req: Request, res: Response) => {

	try {
		console.log(req.params);
		
		res.json({
			"success": true,
		})
	} catch (err) {
		console.log(err);

	}

};