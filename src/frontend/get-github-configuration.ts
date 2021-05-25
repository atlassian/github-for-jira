import JWT from 'atlassian-jwt';
import {Installation} from '../models';
import {NextFunction, Request, Response} from 'express';

export default async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.githubToken) {
    return next(new Error('Github Auth token is missing'));
  }

  if (!req.session.jiraHost) {
    return next(new Error('Jira Host url is missing'));
  }

  const {github, client, isAdmin} = res.locals;

  async function getInstallationsWithAdmin({installations, login}) {
    const installationsWithAdmin = [];
    for (const installation of installations) {
      // See if we can get the membership for this user
      const admin = await isAdmin({
        org: installation.account.login,
        username: login,
        type: installation.target_type,
      });
      const hasMemberPermission = installation.permissions.members === 'read';
      installationsWithAdmin.push({...installation, admin, hasMemberPermission});
    }
    return installationsWithAdmin;
  }

  if (req.query.jwt && req.query.xdm_e) {
    const {jwt: token, xdm_e: jiraHost} = req.query;
    const {data: {login}} = await github.users.getAuthenticated();
    try {
      // we can get the jira client Key from the JWT's `iss` property
      // so we'll decode the JWT here and verify it's the right key before continuing
      const installation = await Installation.getForHost(jiraHost);
      const {iss: clientKey} = JWT.decode(token, installation.sharedSecret);

      const {data: {installations}} = (await github.apps.listInstallationsForAuthenticatedUser());
      const installationsWithAdmin = await getInstallationsWithAdmin({installations, login});
      const {data: info} = (await client.apps.getAuthenticated());
      return res.render('github-configuration.hbs', {
        csrfToken: req.csrfToken(),
        installations: installationsWithAdmin,
        info,
        jiraHost,
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
