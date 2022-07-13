import { Request, Response } from "express";
import { Installation } from "models/installation";

export const CryptorMigrationInstallationVerificationPost = async (req: Request, res: Response): Promise<any> => {

	const jiraHost: string = req.body?.jiraHost;

	req.log = req.log.child({ operation: "migrate-installations-verification" });

	req.log.info("---verifying----- 1");
	if (!jiraHost) {
		req.log.info("---verifying----- 2");
		res.status(200).json({ ok: false, reason: "invalid jiraHost param in body" });
		return;
	}

	const inst: Installation = await Installation.findOne({ where: { jiraHost } });
	if (!inst) {
		req.log.info("---verifying----- 3");
		res.status(200).json({ ok: false, reason: "Could not find installation for jiraHost" });
		return;
	}

	if (!inst.encryptedSharedSecret) {
		req.log.info("---verifying----- 4");
		res.status(200).json({ ok: false, reason: "Empty encryptedSharedSecret" });
		return;
	}

	try {
		if (inst.sharedSecret === (await inst.decrypt("encryptedSharedSecret"))) {
			req.log.info("---verifying----- 5");
			res.status(200).json({ ok: true });
			return;
		} else {
			req.log.info("---verifying----- 6");
			res.status(200).json({ ok: false, reason: "different values to sharedSecret" });
			return;
		}
	} catch (e) {
		req.log.info("---verifying----- 7");
		res.status(200).json({ ok: false, reason: e.message });
		return;
	}

	req.log.info("---verifying----- 8");
};
