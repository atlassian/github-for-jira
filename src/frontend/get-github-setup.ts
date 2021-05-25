import {jiraDomainOptions} from './validations';
import {NextFunction, Request, Response} from 'express';

export default (req: Request, res: Response, next: NextFunction):void => {
  if (req.session.jiraHost) {
    // TODO: Make URL an environment variable?  Change it to point it to plugin directly instead of search
    return res.redirect(`${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`);
  }

  res.render('github-setup.hbs', {
    jiraDomainOptions: jiraDomainOptions(),
    csrfToken: req.csrfToken(),
  });
  next();
};
