import { Request, Response } from "express";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

const strToKey = (keyStr: string): EncryptionSecretKeyEnum | null => {
	const validValues = Object.values(EncryptionSecretKeyEnum);
	if (validValues.includes(keyStr as EncryptionSecretKeyEnum)) {
		return keyStr as EncryptionSecretKeyEnum;
	} else {
		return null;
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
		oldContext,
		newContext,
		key
	});
};
