import {NextFunction, Request, Response} from 'express';
import express from 'express';
import {check, oneOf, validationResult} from 'express-validator';
import format from 'date-fns/format';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import BodyParser from 'body-parser';
import GitHubAPI from '../config/github-api';
import {Installation, Subscription} from '../models';
import verifyInstallation from '../jira/verify-installation';
import logMiddleware from '../middleware/log-middleware';
import JiraClient from '../models/jira-client';
import getJiraClient from '../jira/client';
import uninstall from '../jira/uninstall';
import {serializeJiraInstallation, serializeSubscription} from './serializers';
import getRedisInfo from "../config/redis-info";
import statsd from '../config/statsd';

const router = express.Router();
const bodyParser = BodyParser.urlencoded({extended: false});

async function getInstallation(client, subscription) {
  const id = subscription.gitHubInstallationId;
  try {
    const response = await client.apps.getInstallation({installation_id: id});
    response.data.syncStatus = subscription.syncStatus;
    return response.data;
  } catch (err) {
    return {error: err, id, deleted: err.status === 404};
  }
}

function validViewerPermission(viewer) {
  switch (viewer.organization.repository.viewerPermission) {
    case 'WRITE':
    case 'ADMIN':
      return true;
    default:
      return false;
  }
}

/**
 * Finds the validation errors in this request and wraps them in an object with handy functions
 */
function returnOnValidationError(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({errors: errors.array()});
  }
  next();
}

const viewerPermissionQuery = `{
  viewer {
    login
    isEmployee
    organization(login: "fusion-arc") {
      repository(name: "github-for-jira-app-admins") {
        viewerPermission
      }
    }
  }
}
`;

const limiter = rateLimit({
  store: new RedisStore({
    client: new Redis(getRedisInfo('express-rate-limit').redisOptions)
  }),
  windowMs: 60 * 1000, // 1 minutes
  max: 60, // limit each IP to 60 requests per windowMs
});

router.use(limiter);
router.use(logMiddleware);

// All routes require a PAT to belong to someone on staff
// This middleware will take the token and make a request to GraphQL
// to see if it belongs to someone on staff

router.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.get('Authorization');
  if (!token) {
    res.sendStatus(404)
    return;
  }
  try {
    // Create a separate octokit instance than the one used by the app
    const octokit = GitHubAPI({
      auth: token.split(' ')[1],
    });
    const {data, errors} = (await octokit.request({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      // 'viewer' will be the person that owns the token
      query: viewerPermissionQuery,
      url: '/graphql',
    })).data;

    req.addLogFields({login: (data && data.viewer && data.viewer.login)});

    if (errors) {
      res.status(401).json({errors, viewerPermissionQuery});
      return;
    }

    if (!data.viewer.organization) {
      req.log.info(`Non Atlassian scoped token attempted to access staff routes: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}`);
      res.status(401)
        .json({
          error: 'Unauthorized',
          message: 'Token provided does not have required access',
        });
      return;
    }

    if (!validViewerPermission(data.viewer)) {
      req.log.info(
        `User attempted to access staff routes: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`,
      );
      res.status(401)
        .json({
          error: 'Unauthorized',
          message: 'Token provided does not have required access',
        });
      return;
    }

    req.log.info(`Staff routes accessed: login=${data.viewer.login}, isEmployee=${data.viewer.isEmployee}, viewerPermission=${data.viewer.organization.repository.viewerPermission}`);

    next();
  } catch (err) {
    req.log.info({err});

    if (err.status === 401) {
      res.status(401).send(err.HttpError);
      return;
    }
    res.sendStatus(500);
  }
});

router.get('/', (_: Request, res: Response): void => {
  res.send({});
});

router.get('/:installationId',
  check('installationId').isInt(),
  returnOnValidationError,
  async (req: Request, res: Response): Promise<void> => {
    const requestStart = Date.now();
    const {installationId} = req.params;
    const {client} = res.locals;

    try {
      const subscriptions = await Subscription.getAllForInstallation(Number(installationId));

      if (!subscriptions.length) {
        res.sendStatus(404);
        return;
      }

      const {jiraHost} = subscriptions[0];
      const installations = await Promise.all(subscriptions.map(subscription => getInstallation(client, subscription)));
      const connections = installations
        .filter(response => !response.error)
        .map(data => ({
          ...data,
          isGlobalInstall: data.repository_selection === 'all',
          updated_at: format(data.updated_at, 'MMMM D, YYYY h:mm a'),
          syncState: data.syncState,
        }));

      const failedConnections = installations.filter(response => {
        req.log.error(response.error);
        return response.error;
      });

      res.json({
        host: jiraHost,
        installationId,
        connections,
        failedConnections,
        hasConnections: connections.length > 0 || failedConnections.length > 0,
        repoSyncState: `${req.protocol}://${req.get('host')}/api/${installationId}/repoSyncState.json`,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json(err);
    } finally {
      const elapsed = Date.now() - requestStart;
      const tags = {
        path:'/:installationId',
        method: 'GET',
        status: res.status.toString(),
        environment: process.env.NODE_ENV,
        environment_type: process.env.MICROS_ENVTYPE,
      };

      statsd.histogram('get.installationId', elapsed, tags);
    }
  });

router.get('/:installationId/repoSyncState.json',
  check('installationId').isInt(),
  returnOnValidationError,
  async (req: Request, res: Response): Promise<void> => {
    const requestStart = Date.now();
    const githubInstallationId = Number(req.params.installationId);

    try {
      const subscription = await Subscription.getSingleInstallation(req.session.jiraHost, githubInstallationId);

      if (!subscription) {
        res.sendStatus(404);
        return;
      }

      const data = subscription.repoSyncState;
      res.json(data);
    } catch (err) {
      res.status(500).json(err);
    } finally {
      const elapsed = Date.now() - requestStart;
      const tags = {
        path:'/:installationId/repoSyncState.json',
        method: 'GET',
        status: res.status.toString(),
        environment: process.env.NODE_ENV,
        environment_type: process.env.MICROS_ENVTYPE,
      };

      statsd.histogram('get.installationId-repoSyncState', elapsed, tags);
    }
  });

router.post('/:installationId/sync',
  bodyParser,
  check('installationId').isInt(),
  returnOnValidationError,
  async (req: Request, res: Response): Promise<void> => {
    const requestStart = Date.now();
    const githubInstallationId = Number(req.params.installationId);
    req.log.info(req.body);
    const {jiraHost} = req.body;

    try {
      req.log.info(jiraHost, githubInstallationId);
      const subscription = await Subscription.getSingleInstallation(jiraHost, githubInstallationId);

      if (!subscription) {
        res.sendStatus(404);
        return;
      }

      const type = req.body.resetType || null;
      await Subscription.findOrStartSync(subscription, type);

      res.status(202)
        .json({
          message: `Successfully (re)started sync for ${githubInstallationId}`,
        });
    } catch (err) {
      req.log.info(err);
      res.sendStatus(401);
    } finally {
      const elapsed = Date.now() - requestStart;
      const tags = {
        path:'/:installationId/sync',
        method: 'POST',
        status: res.status.toString(),
        environment: process.env.NODE_ENV,
        environment_type: process.env.MICROS_ENVTYPE,
      };

      statsd.histogram('post.installationId-sync', elapsed, tags);
    }
  });

// Grab the last n failed syncs and trigger a sync
router.post('/resyncFailed', bodyParser, async (request: Request, response: Response): Promise<void> => {
  const limit = Math.max(Number(request.query.limit) || 10, 100);
  const offset = Number(request.query.offset) || 0;

  const failedSubscriptions = await Subscription.findAll(
    {
      where: {syncStatus: 'FAILED'},
      limit,
      offset,
      order: [['updatedAt', 'DESC']],
    },
  );

  await Promise.all(failedSubscriptions.map((subscription) => subscription.resumeSync()));

  const data = failedSubscriptions.map((subscription) => serializeSubscription(subscription));

  response.json(await Promise.all(data));
});

router.get('/jira/:clientKeyOrJiraHost', [
  bodyParser,
  oneOf([
    check('clientKeyOrJiraHost').isURL(),
    check('clientKeyOrJiraHost').isHexadecimal(),
  ]),
  returnOnValidationError,
], async (req: Request, res: Response): Promise<void> => {
  const where = req.params.clientKeyOrJiraHost.startsWith('http') ? {jiraHost: req.params.clientKeyOrJiraHost} : {clientKey: req.params.clientKeyOrJiraHost};
  const jiraInstallations = await Installation.findAll({where});
  if (!jiraInstallations.length) {
    res.sendStatus(404);
    return;
  }
  const data = jiraInstallations.map((jiraInstallation) => serializeJiraInstallation(jiraInstallation, req.log));
  res.json(await Promise.all(data));
});

router.post('/jira/:clientKey/uninstall',
  bodyParser,
  check('clientKey').isHexadecimal(),
  returnOnValidationError,
  async (request: Request, response: Response): Promise<void> => {
    response.locals.installation = await Installation.findOne({where: {clientKey: request.params.clientKey}});

    if (!response.locals.installation) {
      response.sendStatus(404);
      return;
    }
    const jiraClient = new JiraClient(response.locals.installation, request.log);
    const checkAuthorization = request.body.force !== 'true';

    if (checkAuthorization && await jiraClient.isAuthorized()) {
      response.status(400).json({message: 'Refusing to uninstall authorized Jira installation'});
      return;
    }
    request.log.info(`Forcing uninstall for ${response.locals.installation.clientKey}`);
    await uninstall(request, response);
  });

router.post('/jira/:installationId/verify',
  bodyParser,
  check('installationId').isInt(),
  returnOnValidationError,
  async (req: Request, response: Response): Promise<void> => {
    const {installationId} = req.params;
    const installation = await Installation.findByPk(installationId);

    const respondWith = (message) => response.json({
      message,
      installation: {
        enabled: installation.enabled,
        id: installation.id,
        jiraHost: installation.jiraHost
      },
    });

    if (installation.enabled) {
      respondWith('Installation already enabled');
      return;
    }
    await verifyInstallation(installation, req.log)();
    respondWith(installation.enabled ? 'Verification successful' : 'Verification failed');
  });

router.post('/:installationId/migrate/:undo?',
  bodyParser,
  check('installationId').isInt(),
  returnOnValidationError,
  async (req: Request, res: Response): Promise<void> => {
    const githubInstallationId = Number(req.params.installationId);
    const {jiraHost} = req.body;
    const subscription = await Subscription.getSingleInstallation(jiraHost, githubInstallationId);

    if (!subscription) {
      res.sendStatus(404);
      return;
    }

    const jiraClient = await getJiraClient(jiraHost, githubInstallationId, req.log);

    if (req.params.undo) {
      try {
        await jiraClient.devinfo.migration.undo();
        res.send('Successfully called migrationUndo');
        await subscription.update({syncStatus: 'FAILED'});
      } catch (err) {
        res.send(`Error trying to undo migration: ${err}`).status(500);
      }
      return;
    }

    try {
      await jiraClient.devinfo.migration.complete();
      res.send('Successfully called migrationComplete');
      await subscription.update({syncStatus: 'COMPLETE'});
    } catch (err) {
      res.send(`Error trying to complete migration: ${err}`).status(500);
    }
  });

export default router;
