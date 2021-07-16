import {ActionFromSubscription, ActionSource, ActionType,} from '../proto/v0/action';
import {submitProto} from '../tracking';
import {Installation, Subscription} from '../models';
import {getHashedKey} from '../models/installation';
import {Request, Response} from 'express';

/**
 * Handle the when a user adds a repo to this installation
 */
export default async (req: Request, res: Response): Promise<void> => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    res.sendStatus(401);
    return;
  }

  if (!req.body.installationId) {
    res.status(400)
      .json({
        err: 'An Installation ID must be provided to link an installation and a Jira host.',
      });
    return;
  }

  req.log.info("Received add subscription request for Installation ID %s and Jira Host %s",
    req.body.installationId, req.session.jiraHost);

  // Check if the user that posted this has access to the installation ID they're requesting
  try {
    const {data: {installations}} = await res.locals.github.apps.listInstallationsForAuthenticatedUser();

    const userInstallation = installations.find(installation => installation.id === Number(req.body.installationId));

    if (!userInstallation) {
      res.status(401)
        .json({
          err: `Failed to add subscription to ${req.body.installationId}. User does not have access to that installation.`,
        });
      return;
    }

    // If the installation is an Org, the user needs to be an admin for that Org
    if (userInstallation.target_type === 'Organization') {
      const {data: {login}} = await res.locals.github.users.getAuthenticated();
      const {data: {role}} = await res.locals.github.orgs.getMembership({
        org: userInstallation.account.login,
        username: login
      });

      if (role !== 'admin') {
        res.status(401)
          .json({
            err: `Failed to add subscription to ${req.body.installationId}. User is not an admin of that installation`,
          });
        return;
      }
    }

    const subscription = await Subscription.install({
      clientKey: getHashedKey(req.body.clientKey),
      installationId: req.body.installationId,
      host: req.session.jiraHost,
    });
    const jiraInstallation = await Installation.getForHost(req.session.jiraHost);
    const action = ActionFromSubscription(subscription, jiraInstallation);
    action.type = ActionType.CREATED;
    action.actionSource = ActionSource.WEB_CONSOLE;

    await submitProto(action);

    res.sendStatus(200);
  } catch (err) {
    req.log.error(err, "Error processing subscription add request");
    res.sendStatus(500);
  }
};
