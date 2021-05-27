import {ActionFromInstallation, ActionSource, ActionType,} from '../proto/v0/action';
import {submitProto} from '../tracking';
import {Installation} from '../models';
import verifyInstallation from './verify-installation';
import {Request, Response} from 'express';

/**
 * Handle the enable webhook from Jira
 */
export default async (req: Request, res: Response): Promise<void> => {
  const jiraHost = req.body.baseUrl;

  const installation = await Installation.getPendingHost(jiraHost);
  if (!installation) {
    req.log.info(`No pending installation found for jiraHost=${jiraHost}`);
    res.sendStatus(422);
    return;
  }

  const action = await ActionFromInstallation(installation);
  action.type = ActionType.ENABLED;
  action.actionSource = ActionSource.WEBHOOK;
  res.on('finish', verifyInstallation(installation, req.log));
  res.sendStatus(204);
  await submitProto(action);
};
