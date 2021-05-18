const { sortedRepos } = require('../../../../lib/sync/installation');
const repoSyncState = require('../../../fixtures/repo-sync-state.json');
const sortedReposFunc = require('../../../fixtures/sorted-repos.json');

describe('Sync helpers suite', () => {
  it('sortedRepos should sort repos by updated_at', () => {
    expect(sortedRepos(repoSyncState)).toEqual(sortedReposFunc);
  });
});
