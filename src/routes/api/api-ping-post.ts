import { Request, Response } from "express";
import axios from "axios";

/**
 * Makes a call to the URL passed into the "url" field of the body JSON.
 */
export const ApiPingPost = async (req: Request, res: Response): Promise<void> => {

	const data = req.body;

	const followRedirects = !!data.followRedirects;

	if (!data || !data.url) {
		res.status(400)
			.json({
				message: "Please provide a JSON object with the fields 'url' and 'followRedirects' (optional)."
			});
		return;
	}

	try {
		const pingResponse = await axios.get(data.url, {
			maxRedirects: followRedirects ? 10 : 0
		});
		res.json({
			url: data.url,
			method: "GET",
			statusCode: pingResponse.status,
			statusText: pingResponse.statusText
		});
	} catch (err) {
		res.json({
			url: data.url,
			method: "GET",
			error: err
		});
	}
};
