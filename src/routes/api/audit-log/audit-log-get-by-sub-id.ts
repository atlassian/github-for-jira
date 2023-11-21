import { Request, Response } from "express";
import { Subscription } from "models/subscription";
import { findLog, AuditInfoPK } from "services/audit-log-service";

export const ApiAuditLogGetBySubscriptionId = async (req: Request, res: Response): Promise<void> => {

	const { subscriptionId } = req.params;
	const { issueKey, entityType, entityId } = req.query;

	const subscription = await Subscription.findByPk(subscriptionId);

	if (subscription === null) {
		throw new Error("Cannot find subscription by id " + subscriptionId);
	}

	const auditInfo: AuditInfoPK = {
		subscriptionId: Number(subscriptionId),
		issueKey: String(issueKey),
		entityType: String(entityType),
		entityId: String(entityId)
	};

	const result = await findLog(auditInfo, req.log);

	res.status(200).json(result);

};
