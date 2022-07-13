import { Request, Response } from "express";
import { Installation } from "models/installation";

export const CryptorMigrationInstallationVerificationPost = async (req: Request, res: Response): Promise<any> => {

	const jiraHost: string[] = req.body?.jiraHost;

	if (!jiraHost) return res.status(200).end({ ok: false, reason: "invalid jiraHost param in body" });

	const inst: Installation = await Installation.findOne({ where: { jiraHost } });
	if (!inst) return res.status(200).json({ ok: false, reason: "Could not find installation for jiraHost" });

	if (!inst.encryptedSharedSecret) return res.status(200).json({ ok: false, reason: "Empty encryptedSharedSecret" });

	try {
		if (inst.sharedSecret === (await inst.decrypt("encryptedSharedSecret"))) {
			return res.status(200).json({ ok: true });
		} else {
			return res.status(200).json({ ok: false, reason: "different values to sharedSecret" });
		}
	} catch (e) {
		return res.status(200).json({ ok: false, reason: e.message });
	}

};
