import { Request, Response } from "express";
import crypto from "crypto";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

const calculateSha256 = (str: string): string => {
	const keyHash = crypto.createHash("sha256");
	keyHash.update(str);
	return keyHash.digest("hex");
};

const strToKey = (keyStr: string): EncryptionSecretKeyEnum | null => {
	const validValues = Object.values(EncryptionSecretKeyEnum); // get all the valid values of the enum
	if (validValues.includes(keyStr as EncryptionSecretKeyEnum)) { // check if the input color is a valid value of the enum
		return keyStr as EncryptionSecretKeyEnum; // type cast the string to the enum
	} else {
		return null; // if the input color is not valid, return null
	}
};

export const ApiRecryptPost = async (req: Request, res: Response): Promise<void> => {

	const { key, encryptedValue, oldContext, newContext } = req.body;

	const validKey = strToKey(key);
	if (!validKey) {
		res.status(400)
			.json({
				message: "Key is not valid."
			});
		return;
	}

	if (!encryptedValue) {
		res.status(400)
			.json({
				message: "Please provide a value to recrypt."
			});
		return;
	}

	if (!oldContext) {
		res.status(400)
			.json({
				message: "Please provide an old encryption context."
			});
		return;
	}

	if (!newContext) {
		res.status(400)
			.json({
				message: "Please provide an new encryption context."
			});
		return;
	}

	const plainValue = await EncryptionClient.decrypt(encryptedValue, oldContext);

	const recryptedValue = await EncryptionClient.encrypt(key, plainValue, newContext);

	res.json({
		recryptedValue,
		plainValueSha256: calculateSha256(plainValue)
	});
};
