/* eslint-disable @typescript-eslint/no-var-requires */
import parseSmartCommit from '../../../src/transforms/smart-commit';
import supertest from 'supertest';
import {
  branchesNoLastCursor,
  branchesWithLastCursor,
} from '../../fixtures/api/graphql/branch-queries';
import nock from 'nock';
import express, { Application } from 'express';
import { NextFunction, Request, Response } from 'express';
import Logger from 'bunyan';

describe('sync/branches', () => {
  let jiraHost;
  let installationId;
  let delay;
  let app: Application;
  let locals;
  const branchNodesFixture = require('../../fixtures/api/graphql/branch-ref-nodes.json');
  const emptyNodesFixture = require('../../fixtures/api/graphql/branch-empty-nodes.json');
  // const branchCommitsHaveKeys = require('../../fixtures/api/graphql/branch-commits-have-keys.json');
  // const associatedPRhasKeys = require('../../fixtures/api/graphql/branch-associated-pr-has-keys.json');
  // const branchNoIssueKeys = require('../../fixtures/api/graphql/branch-no-issue-keys.json');

  function makeExpectedResponse({ branchName }) {
    const { issueKeys } = parseSmartCommit(branchName);
    return {
      preventTransitions: true,
      repositories: [
        {
          branches: [
            {
              createPullRequestUrl: `test-repo-url/pull/new/${branchName}`,
              id: branchName,
              issueKeys: ['TES-123']
                .concat(issueKeys)
                .reverse()
                .filter(Boolean),
              lastCommit: {
                author: {
                  avatar: 'https://camo.githubusercontent.com/test-avatar',
                  name: 'test-author-name',
                },
                authorTimestamp: 'test-authored-date',
                displayId: 'test-o',
                fileCount: 0,
                hash: 'test-oid',
                id: 'test-oid',
                issueKeys: ['TES-123'],
                message: 'TES-123 test-commit-message',
                url: 'test-repo-url/commit/test-sha',
                updateSequenceId: 12345678,
              },
              name: branchName,
              url: `test-repo-url/tree/${branchName}`,
              updateSequenceId: 12345678,
            },
          ],
          commits: [
            {
              author: {
                avatar: 'https://camo.githubusercontent.com/test-avatar',
                email: 'test-author-email@example.com',
                name: 'test-author-name',
              },
              authorTimestamp: 'test-authored-date',
              displayId: 'test-o',
              fileCount: 0,
              hash: 'test-oid',
              id: 'test-oid',
              issueKeys: ['TES-123'],
              message: 'TES-123 test-commit-message',
              timestamp: 'test-authored-date',
              url: 'test-repo-url/commit/test-sha',
              updateSequenceId: 12345678,
            },
          ],
          id: 'test-repo-id',
          name: 'test-repo-name',
          url: 'test-repo-url',
          updateSequenceId: 12345678,
        },
      ],
      properties: {
        installationId: 1234,
      },
    };
  }

  function nockBranchRequest(payload) {
    nock('https://api.github.com')
      .post('/graphql', branchesNoLastCursor)
      .reply(200, payload);
    nock('https://api.github.com')
      .post('/graphql', branchesWithLastCursor)
      .reply(200, emptyNodesFixture);
  }

  let createJob;
  let processInstallation;

  const createApp = async () => {
    const app = express();

    app.use((req: Request, res: Response, next: NextFunction) => {
      res.locals = locals || {};
      req.log = new Logger({
        name: 'api.test.ts',
        level: 'debug',
        stream: process.stdout,
      });
      req.session = { jiraHost: process.env.ATLASSIAN_URL };
      next();
    });

    app.use('/api', (await import('../../../src/api')).default);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    app.log = jest.fn();
    return app;
  };

  beforeEach(async () => {
    locals = {
      client: {
        apps: {
          getInstallation: jest.fn().mockResolvedValue({ data: {} }),
        },
      },
    };
    app = await createApp();

    delay = process.env.LIMITER_PER_INSTALLATION = '2000';

    jiraHost = process.env.ATLASSIAN_URL;
    // jiraApi = td.api(process.env.ATLASSIAN_URL);

    installationId = 1234;
    Date.now = jest.fn(() => 12345678);

    createJob = (await import('../../setup/create-job')).default;
    processInstallation = (await import('../../../src/sync/installation'))
      .processInstallation;
  });

  it.only('should sync to Jira when branch refs have jira references', async () => {
    const job = createJob({
      data: { installationId, jiraHost },
      opts: { delay },
    });

    nockBranchRequest(branchNodesFixture);

    const queues = {
      installation: {
        add: jest.fn(),
      },
    };

    await processInstallation(app, queues)(job);
    // expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

    return supertest(app)
      .post('/rest/devinfo/0.10/bulk')
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual(
          makeExpectedResponse({ branchName: 'TES-321-branch-name' }),
        );
      });
    // td.verify(
    //   jiraApi.post(
    //     '/rest/devinfo/0.10/bulk',
    //     makeExpectedResponse({ branchName: 'TES-321-branch-name' }),
    //   ),
    // );
  });

  // it.skip('should send data if issue keys are only present in commits', async () => {
  //   const job = createJob({
  //     data: { installationId, jiraHost },
  //     opts: { delay },
  //   });
  //   nockBranchRequest(branchCommitsHaveKeys);

  //   const queues = {
  //     installation: {
  //       add: jest.fn(),
  //     },
  //   };
  //   await processInstallation(app, queues)(job);
  //   expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

  //   // td.verify(
  //   //   jiraApi.post(
  //   //     '/rest/devinfo/0.10/bulk',
  //   //     makeExpectedResponse({
  //   //       branchName: 'dev',
  //   //     }),
  //   //   ),
  //   // );
  // });

  // it.skip('should send data if issue keys are only present in an associatd PR title', async () => {
  //   const job = createJob({
  //     data: { installationId, jiraHost },
  //     opts: { delay },
  //   });
  //   nockBranchRequest(associatedPRhasKeys);

  //   const queues = {
  //     installation: {
  //       add: jest.fn(),
  //     },
  //   };
  //   await processInstallation(app, queues)(job);
  //   expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);

  //   // td.verify(
  //   //   jiraApi.post('/rest/devinfo/0.10/bulk', {
  //   //     preventTransitions: true,
  //   //     repositories: [
  //   //       {
  //   //         branches: [
  //   //           {
  //   //             createPullRequestUrl: 'test-repo-url/pull/new/dev',
  //   //             id: 'dev',
  //   //             issueKeys: ['PULL-123'],
  //   //             lastCommit: {
  //   //               author: {
  //   //                 avatar: 'https://camo.githubusercontent.com/test-avatar',
  //   //                 name: 'test-author-name',
  //   //               },
  //   //               authorTimestamp: 'test-authored-date',
  //   //               displayId: 'test-o',
  //   //               fileCount: 0,
  //   //               hash: 'test-oid',
  //   //               issueKeys: ['PULL-123'],
  //   //               id: 'test-oid',
  //   //               message: 'test-commit-message',
  //   //               url: 'test-repo-url/commit/test-sha',
  //   //               updateSequenceId: 12345678,
  //   //             },
  //   //             name: 'dev',
  //   //             url: 'test-repo-url/tree/dev',
  //   //             updateSequenceId: 12345678,
  //   //           },
  //   //         ],
  //   //         commits: [],
  //   //         id: 'test-repo-id',
  //   //         name: 'test-repo-name',
  //   //         url: 'test-repo-url',
  //   //         updateSequenceId: 12345678,
  //   //       },
  //   //     ],
  //   //     properties: {
  //   //       installationId: 1234,
  //   //     },
  //   //   }),
  //   // );
  // });

  // it.skip('should not call Jira if no issue keys are found', async () => {
  //   const job = createJob({
  //     data: { installationId, jiraHost },
  //     opts: { delay },
  //   });
  //   nockBranchRequest(branchNoIssueKeys);

  //   const queues = {
  //     installation: {
  //       add: jest.fn(),
  //     },
  //   };

  //   // td.when(jiraApi.post(), { ignoreExtraArgs: true }).thenThrow(
  //   //   new Error('test error'),
  //   // );

  //   await processInstallation(app, queues)(job);
  //   expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  // });
});
