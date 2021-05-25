import sslify from 'express-sslify';
import helmet from 'helmet';
import getFrontendApp from './app';
import {Application} from 'probot';
import {Express, Router} from 'express';

function secureHeaders(router: Router, frontendApp: Express) {
  // Content Security Policy
  router.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],
      // Allow <script> tags hosted by ourselves and from atlassian when inserted into an iframe
      scriptSrc: ["'self'", process.env.APP_URL, 'https://*.atlassian.net', 'https://*.jira.com', 'https://connect-cdn.atl-paas.net/'],
      // Allow XMLHttpRequest/fetch requests
      connectSrc: ["'self'", process.env.APP_URL],
      // Allow <style> tags hosted by ourselves as well as style="" attributes
      styleSrc: ["'self'", "'unsafe-inline'"],
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
