import { Request, Response } from "express";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import crypto from "crypto";
import { stringFlag, StringFlags } from "config/feature-flags";

const getHashedKey = (clientKey: string): string => {
	const keyHash = crypto.createHash("sha256");
	keyHash.update(clientKey);
	return keyHash.digest("hex");
};

export const GithubEncryptHeaderPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info("Encryption was requested");

	const headerToEncrypt = (await stringFlag(StringFlags.HEADERS_TO_ENCRYPT, "", res.locals.jiraHost) || "").toLowerCase().trim();

	if (headerToEncrypt.length === 0) {
		req.log.warn("Not allowed");
		res.status(401).json({
			error: {
				message: "Not allowed"
			}
		});
		return;
	}

	if (!req.headers[headerToEncrypt]) {
		req.log.info("Header wasn't provided: " + headerToEncrypt);
		res.status(400).json({
			error: {
				message: "Header not found: " + headerToEncrypt
			}
		});
		return;
	}

	const plainValue = req.headers[headerToEncrypt] || "";

	if (Array.isArray(plainValue)) {
		req.log.info("Array was provided: " + headerToEncrypt);
		res.status(400).json({
			error: {
				message: "Just one header was expected: " + headerToEncrypt
			}
		});
		return;
	}

	const encryptedValue = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, plainValue, {
		jiraHost: res.locals.jiraHost
	});

	res.json({
		encryptedValue: encryptedValue,
		plainValueSha256: getHashedKey(plainValue),
		jiraHost: res.locals.jiraHost
	});

	req.log.info("Encrypted header was returned sent back!");

};
