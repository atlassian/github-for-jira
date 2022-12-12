import { Request, Response } from "express";
import { createHashWithSharedSecret } from "~/src/util/encryption";

export const ApiHashPost = async (req: Request, res: Response): Promise<void> => {

	const { data } = req.body;

	if (!data) {
		res.status(400)
			.json({
				message: "Please provide a value to be hashed."
			});
		return;
	}

	const hashedValue = createHashWithSharedSecret(data);

	res.json({
		originalValue: data,
		hashedValue
	});
};
