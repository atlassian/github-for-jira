import { Request, Response } from "express";
import { createHashWithSharedSecret } from "~/src/util/encryption";

export const ApiHashPost = async (req: Request, res: Response): Promise<void> => {

	const { data: originalValue } = req.body;

	if (!originalValue){
		res.status(400).send("Please provide a value to be hashed.");
		return;
	}

	const hashedValue = createHashWithSharedSecret(originalValue);

	res.json({
		originalValue,
		hashedValue
	});
}