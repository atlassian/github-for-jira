import { jiraDomainOptions } from './validations';
import { NextFunction, Request, Response } from 'express';
import { getGitHubConfigurationUrl } from '../util/getUrl';

/*
When this request is made: Installing from Jira Marketplace - GitHub org does not have Jira installed.
Redirects users back to github/configuration to install their Jira instance in GitHub org/s.
If the installation was done from Jira Marketplace, the app is already installed.
*/
export default (req: Request, res: Response, next: NextFunction): void => {
  if (req.session.jiraHost) {
    const { host: githubHost, session } = req;
    const { jwt, jiraHost } = session;

    const urlParams = { githubHost, jwt, jiraHost };

    /* We don't need to redirect to the marketplace here. If a user has installed from Jira, the
    GitHub app is already installed. */
    return res.redirect(getGitHubConfigurationUrl(urlParams));
  }

  res.render('github-setup.hbs', {
    jiraDomainOptions: jiraDomainOptions(),
    csrfToken: req.csrfToken(),
    nonce: res.locals.nonce,
  });
  next();
};
