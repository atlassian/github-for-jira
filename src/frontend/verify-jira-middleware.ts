import jwt from 'atlassian-jwt';

import {Installation} from '../models';
import {NextFunction, Request, Response} from 'express';

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const jiraHost = req.session.jiraHost || req.body?.jiraHost;
  const token = req.session.jwt || req.body?.token;
  const installation = await Installation.getForHost(jiraHost);

  if (!installation) {
    return next(new Error('Not Found'));
  }
  res.locals.installation = installation;

  req.addLogFields({
    jiraHost: installation.jiraHost,
    jiraClientKey: installation.clientKey,
  });

  try {
    // The JWT contains a `qsh` field that can be used to verify
    // the request body / query
    // See https://bitbucket.org/atlassian/atlassian-connect-express/src/f434e5a9379a41213acf53b9c2689ce5eec55e21/lib/middleware/authentication.js?at=master&fileviewer=file-view-default#authentication.js-227
    jwt.decode(token, installation.sharedSecret);

    next();
  } catch (error) {
    next(new Error('Unauthorized'));
  }
};
