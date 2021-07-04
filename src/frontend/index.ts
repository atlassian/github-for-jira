import sslify from 'express-sslify';
import helmet from 'helmet';
import getFrontendApp from './app';
import {Application} from 'probot';
import {Express, NextFunction, Request, Response, Router} from 'express';
import crypto from 'crypto';

function secureHeaders(router: Router, frontendApp: Express) {

  router.use((_: Request, res: Response, next: NextFunction): void => {
    res.locals.nonce = crypto.randomBytes(16).toString('hex');
    next();
  });


  // Content Security Policy
  router.use(helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      // Allow <script> tags hosted by ourselves and from atlassian when inserted into an iframe
      scriptSrc: ["'self'", process.env.APP_URL, 'https://*.atlassian.net', 'https://*.jira.com', 'https://connect-cdn.atl-paas.net/',
        "'unsafe-inline'", "'strict-dynamic'", (_: Request, res: Response): string => `'nonce-${res.locals.nonce}'`],
      // Allow XMLHttpRequest/fetch requests
      connectSrc: ["'self'", process.env.APP_URL],
      // Allow <style> tags hosted by ourselves as well as style="" attributes
      styleSrc: ["'self'", "'unsafe-inline'"],
      // Allow using github-for-jira pages as iframes only in jira
      frameAncestors: ['https://*.atlassian.net', 'https://*.jira-dev.com', 'https://*.jira.com'],
      //Doesn't allow usage of <base> element
      baseUri: ["'none'"],
      //Send SCP reports to Atlassian security monitoring
      reportUri: "https://web-security-reports.services.atlassian.com/csp-report/github-for-jira",
      // Allow self-hosted images, data: images, organization images and the error image
      imgSrc: ["'self'", 'data:', 'https://*.githubusercontent.com', 'https://octodex.github.com'],
    },
  }));
  // Enable HSTS with the value we use for education.github.com
  router.use(helmet.hsts({
    maxAge: 15552000,
  }));
  // X-Frame / Clickjacking protection
  // Disabling this. Will probably need to dynamically
  // set this based on the referrer URL and match if it's *.atlassian.net or *.jira.com
  // app.use(helmet.frameguard({ action: 'deny' }))
  // MIME-Handling: Force Save in IE
  router.use(helmet.ieNoOpen());
  // Disable caching
  router.use(helmet.noCache());
  // Disable mimetype sniffing
  router.use(helmet.noSniff());
  // Basic XSS Protection
  router.use(helmet.xssFilter());

  // Remove the X-Powered-By
  // This particular combination of methods works
  frontendApp.disable('x-powered-by');
  router.use(helmet.hidePoweredBy());
}

export default (app: Application): void => {
  const router = app.route();

  if (process.env.FORCE_HTTPS) {
    router.use(sslify.HTTPS({trustProtoHeader: true}));
  }

  const frontendApp = getFrontendApp(app.app);
  secureHeaders(router, frontendApp);
  router.use(frontendApp);
};
