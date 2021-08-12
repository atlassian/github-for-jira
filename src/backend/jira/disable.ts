import { ActionFromInstallation, ActionSource, ActionType } from "../proto/v0/action";
import { submitProto } from "../tracking";
import { Request, Response } from "express";

/**
 * Handle the disable webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
	const { installation } = res.locals;
	const action = await ActionFromInstallation(installation);
	action.type = ActionType.DISABLED;
	action.actionSource = ActionSource.WEBHOOK;
	await installation.disable();
	await submitProto(action);
	req.log.info("Installation id=%d disabled on Jira", installation.id);
	res.sendStatus(204);
};
