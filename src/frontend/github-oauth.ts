/*
 * Copied from https://github.com/maxogden/github-oauth/blob/master/index.js
 * But it had a vulnerability on the `request` package version range.
 * So, instead of making a fork, since it's only one file and the package
 * hasn't been updated in 3 years I thought it was simpler to just copy the source here
 */
import crypto from 'crypto';
import url from 'url';
import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from 'express';
import axios from 'axios';

const host = process.env.GHE_HOST || 'github.com';

export interface OAuthOptions {
  baseURL: string;
  githubClient: string;
  githubSecret: string;
  loginURI?: string;
  callbackURI?: string;
  scopes?: string[];
}

export interface GithubOAuth {
  router: Router;
  checkGithubAuth: RequestHandler;
}

export default (opts: OAuthOptions): GithubOAuth => {
  opts.callbackURI = opts.callbackURI || '/github/callback';
  opts.loginURI = opts.loginURI || '/github/login';
  opts.scopes = opts.scopes || ['user', 'repo'];
  const redirectURI = new URL(opts.callbackURI, opts.baseURL).toString();

  function login(req: Request, res: Response, next: NextFunction): void {
    // TODO: We really should be using an Auth library for this, like @octokit/github-auth
    // Create unique state for each oauth request
    const state = crypto.randomBytes(8).toString('hex');

    // Save the redirect that may have been specified earlier into session to be retrieved later
    req.session[state] =
      res.locals.redirect ||
      `/github/configuration${url.parse(req.originalUrl).search || ''}`;
    res.redirect(
      `https://${host}/login/oauth/authorize?client_id=${opts.githubClient}${
        opts.scopes.length ? `&scope=${opts.scopes.join(' ')}` : ''
      }&redirect_uri=${redirectURI}&state=${state}`,
    );
    next();
  }

  async function callback(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const code = req.query.code as string;
    const state = req.query.state as string;

    // Take save redirect url and delete it from session
    const redirectUrl = req.session[state] as string;
    delete req.session[state];

    // Check if state is available and matches a previous request
    if (!state || !redirectUrl)
      return next(new Error('Missing matching Auth state parameter'));
    if (!code) return next(new Error('Missing OAuth Code'));

    try {
      const response = await axios.get(
        `https://${host}/login/oauth/access_token`,
        {
          params: {
            client_id: opts.githubClient,
            client_secret: opts.githubSecret,
            code,
            state,
          },
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          responseType: 'json',
        },
      );

      req.session.githubToken = response.data.access_token;

      if (!req.session.githubToken) {
        return next(new Error('Missing Access Token from Github OAuth Flow.'));
      }

      return res.redirect(redirectUrl);
    } catch (e) {
      return next(new Error('Cannot retrieve access token from Github'));
    }
  }

  const router = express.Router();
  // compatible with flatiron/director
  router.get(opts.loginURI, login);
  router.get(opts.callbackURI, callback);

  return {
    router: router,
    checkGithubAuth: (req: Request, res: Response, next: NextFunction) => {
      if (!req.session.githubToken) {
        res.locals.redirect = req.originalUrl;
        return login(req, res, next);
      }
      return next();
    },
  };
};
