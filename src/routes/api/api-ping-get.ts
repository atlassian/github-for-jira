import { Request, Response } from "express";
import axios from "axios";

/**
 * Makes a call to the URL passed into the "url" field of the body JSON.
 */
export const ApiPingGet = async (req: Request, res: Response): Promise<void> => {

	const { data } = req.body;

	if (!data || !data.url) {
		res.status(400)
			.json({
				message: "Please provide a JSON object with the field 'url'."
			});
		return;
	}

	try {
		const pingResponse = await axios.get(data.url);
		res.json({
			url: data.url,
			method: "GET",
			statusCode: pingResponse.status,
			statusText: pingResponse.statusText
		});
	} catch (err: unknown) {
		res.json({
			url: data.url,
			method: "GET",
			error: err
		});
	}
};
