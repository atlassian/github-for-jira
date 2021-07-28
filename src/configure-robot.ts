import { Application, GitHubAPI } from 'probot';
import Redis from 'ioredis';
import RateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createAppAuth } from '@octokit/auth-app';
import { findPrivateKey } from 'probot/lib/private-key';
import getRedisInfo from './config/redis-info';
import setupFrontend from './frontend';
import setupGitHub from './github';
import statsd from './config/statsd';
import { isIp4InCidrs } from './config/cidr-validator';
import Logger from 'bunyan';
import { metricError } from './config/metric-names';
import logMiddleware from "./middleware/log-middleware";


import { getLogger } from './config/logger';


/**
 * Get the list of GitHub CIDRs from the /meta endpoint
 *
 * This is a weird one, the /meta endpoint has a very small rate limit
 * for non-authed users, but also doesn't allow queries from authenticated
 * apps, it must be from an installation of an application. So we fetch
 * the first installation and query as it. It only happens on boot, and
 * shouldn't affect anything else, it's theoretically safe.
 *
 * @returns {string[]} A list of CIDRs for GitHub webhooks
 */
async function getGitHubCIDRs(logger: Logger): Promise<string[]> {
  let api = GitHubAPI({
    authStrategy: createAppAuth,
    auth: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      id: process.env.APP_ID,
      privateKey: findPrivateKey(),
    },
    logger,
  });
  const inst = await api.apps.listInstallations({
    per_page: 1,
  });
  // TODO: need to update this.  `api.auth` doesn't exist, must be a deprecated func
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { token } = await (api as any).auth({
    type: 'installation',
    installationId: inst.data[0].id,
  });
  api = GitHubAPI({
    auth: token,
    logger,
  });
  const metaResp = await api.meta.get();
  const GitHubCIDRs = metaResp.data.hooks;
  logger.info({ GitHubCIDRs }, 'CIDRs that can skip rate limiting');
  return GitHubCIDRs;
}

export default async (app: Application): Promise<Application> => {
  if (process.env.USE_RATE_LIMITING === 'true') {
    const GitHubCIDRs = await getGitHubCIDRs(getLogger('rate-limiting'));
    const client = new Redis(getRedisInfo('rate-limiter').redisOptions);
    const limiter = RateLimit({
      store: new RedisStore({
        client,
      }),
      /**
       * Check if we should skip rate limiting
       *
       * NOTE: This is only expected to be done for IP CIDRs we trust (github)
       */
      skip(req) {
        return isIp4InCidrs(req.ip, GitHubCIDRs);
      },
      /**
       * Handle when a users hits the rate limit
       */
      handler(_, res) {
        // We don't include path in this metric as the bots scanning us generate many of them
        statsd.increment(metricError.expressRateLimited);
        res.status(429).send('Too many requests, please try again later.');
      },
      max: 100, // limit each IP to a number of requests per windowMs
    });

    app.router.use(limiter);
  }

  app.router.use(logMiddleware)

  // These incoming webhooks should skip rate limiting
  setupGitHub(app);
  // Our FrontEnd Assets are between 1 and 4 RPM
  setupFrontend(app);

  return app;
};
