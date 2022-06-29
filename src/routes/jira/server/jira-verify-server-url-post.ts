import { Request, Response } from "express";
import axios from "axios";

export const JiraVerifyServerUrlPost = async (
	req: Request,
	res: Response
): Promise<void> => {
		const { gheServerURL } = req.body;
		req.log.info(`Verifying provided GHE server url: ${gheServerURL}`);
		axios
			.get(gheServerURL)
			.then(function (response) {
				req.log.info(`Successfully verified GHE server url: ${gheServerURL}`);
				return res.sendStatus(200);
			})
			.catch(function (error) {
				req.log.error(`Failed to verify GHE server url: ${gheServerURL}`);
				res.send(401).send({ message: "Check your firewall configurtion and try again." });
			});
};
