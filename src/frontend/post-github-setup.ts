import {jiraDomainOptions, validJiraDomains} from './validations';
import {Request, Response} from 'express';

export default (req: Request, res: Response): void => {
  const {jiraSubdomain, jiraDomain} = req.body;
  if (!validJiraDomains(jiraSubdomain, jiraDomain)) {
    res.status(400);
    return res.render('github-setup.hbs', {
      error: 'The entered Jira Cloud Site is not valid',
      jiraSubdomain,
      nonce: res.locals.nonce,
      jiraDomainOptions: jiraDomainOptions(jiraDomain),
      csrfToken: req.csrfToken(),
    });
  }

  req.session.jiraHost = `https://${jiraSubdomain}.${jiraDomain}`;

  res.redirect(
    req.session.githubToken ?
      // TODO: duplicate code. Need to centralize this.
      `${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production` :
      '/github/login'
  );
};
