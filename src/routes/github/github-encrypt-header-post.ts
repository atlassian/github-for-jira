import { Request, Response } from "express";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import crypto from "crypto";

const getHashedKey = (clientKey: string): string => {
	const keyHash = crypto.createHash("sha256");
	keyHash.update(clientKey);
	return keyHash.digest("hex");
};

export const GithubEncryptHeaderPost = async (req: Request, res: Response): Promise<void> => {

	if (typeof req.headers.tdauthtoken === "string") {
		const plainValue: string = req.headers.tdauthtoken || "";

		const encryptedValue = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_PREAUTH_HEADER_VALUE, plainValue, {
			jiraHost: res.locals.jiraHost
		});

		res.json({
			encryptedValue,
			plainValueSha: getHashedKey(plainValue)
		}).sendStatus(200);

	} else {
		res.json({
			error: {
				message: "Header was not found!"
			}
		}).sendStatus(400);
	}
};
