import JWT from 'atlassian-jwt';
import {Installation} from '../models';
import {NextFunction, Request, Response} from 'express';

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.session.githubToken) {
    return next(new Error('Github Auth token is missing'));
  }

  if (!req.session.jiraHost) {
    return next(new Error('Jira Host url is missing'));
  }

  const {github, client, isAdmin} = res.locals;

  async function getInstallationsWithAdmin({installations, login}) {
    const installationsWithAdmin = [];
    // TODO: make this parallel calls
    for (const installation of installations) {
      // See if we can get the membership for this user
      // TODO: instead of calling each installation org to see if the current user is admin, you could just ask for all orgs the user is a member of and cross reference with the installation org
      const admin = await isAdmin({
        org: installation.account.login,
        username: login,
        type: installation.target_type,
      });
      req.log.info(`Installations: ${JSON.stringify(installationsWithAdmin, null, 2)}`);
      installationsWithAdmin.push({...installation, admin});
    }
    return installationsWithAdmin;
  }

  if (req.session.jwt && req.session.jiraHost) {
    const {data: {login}} = await github.users.getAuthenticated();
    try {
      // we can get the jira client Key from the JWT's `iss` property
      // so we'll decode the JWT here and verify it's the right key before continuing
      const installation = await Installation.getForHost(req.session.jiraHost);
      const {iss: clientKey} = JWT.decode(req.session.jwt, installation.sharedSecret);

      const {data: {installations}} = (await github.apps.listInstallationsForAuthenticatedUser());
      const installationsWithAdmin = await getInstallationsWithAdmin({installations, login});
      const {data: info} = (await client.apps.getAuthenticated());
      return res.render('github-configuration.hbs', {
        csrfToken: req.csrfToken(),
        installations: installationsWithAdmin,
        jiraHost: req.session.jiraHost,
        info,
        clientKey,
      });
    } catch (err) {
      // If we get here, there was either a problem decoding the JWT
      // or getting the data we need from GitHub, so we'll show the user an error.
      req.log.error(err);
      return next(err);
    }
  }

  // TODO: Triplicate code.  Need to centralize.
  res.redirect(`${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`);
};
