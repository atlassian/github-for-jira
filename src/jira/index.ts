import bodyParser from 'body-parser';
import * as Sentry from '@sentry/node';

import { Installation } from '../models';
import { hasValidJwt } from './util/jwt';
import logMiddleware from '../middleware/log-middleware';

import connect from './connect';
import disable from './disable';
import enable from './enable';
import install from './install';
import uninstall from './uninstall';
import { Application } from 'probot';
import { NextFunction, Request, Response } from 'express';

const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const installation = await Installation.getForClientKey(req.body.clientKey);
  if (!installation) {
    res.status(404).json({});
    return;
  }

  const { jiraHost, sharedSecret, clientKey } = installation;

  req.addLogFields({
    jiraHost,
    jiraClientKey: `${clientKey.substr(0, 5)}***}`,
  });
  res.locals.installation = installation;

  // TODO: Should the express response logic be inside 'hasValidJwt'?
  if (hasValidJwt(sharedSecret, jiraHost, req, res)) {
    next();
  }
};

export default (robot: Application): void => {
  const router = robot.route('/jira');

  // The request handler must be the first middleware on the app
  router.use(Sentry.Handlers.requestHandler());
  router.use(bodyParser.json());
  router.use(logMiddleware);

  // Set up event handlers
  router.get('/atlassian-connect.json', connect);
  router.post('/events/disabled', authenticate, disable);
  router.post('/events/enabled', authenticate, enable);
  router.post('/events/installed', install); // we can't authenticate since we don't have the secret
  router.post('/events/uninstalled', authenticate, uninstall);

  // The error handler must come after controllers and before other error middleware
  router.use(Sentry.Handlers.errorHandler());
};
