/* eslint-disable @typescript-eslint/no-var-requires */

describe('Sync helpers suite', () => {
  const repoSyncState = require('../../../fixtures/repo-sync-state.json');
  const sortedReposFunc = require('../../../fixtures/sorted-repos.json');
  let sortedRepos;

  beforeEach(async () => {
    sortedRepos = (await import('../../../../src/sync/installation')).sortedRepos;
  })
  it('sortedRepos should sort repos by updated_at', () => {
    expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
  });
});
