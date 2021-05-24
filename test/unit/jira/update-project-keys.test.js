const reduceProjectKeys = require('../../../src/jira/util/reduce-project-keys');

describe('Reduces an array of Issue Keys to their unique projects', () => {
  test('Reduces commits payload when an array is empty', () => {
    const projects = [];
    const commit = { issueKeys: ['TES-1', 'TES-2', 'JIR-1', 'JIR-2', 'JIR-3'] };

    reduceProjectKeys(commit, projects);
    expect(projects).toEqual(['TES', 'JIR']);
  });

  test('Does not duplicate project identifiers if they already exist', () => {
    const projects = ['TES', 'JIR'];
    const commit = { issueKeys: ['TES-1', 'TES-2', 'JIR-1', 'JIR-2', 'JIR-3'] };

    reduceProjectKeys(commit, projects);
    expect(projects).toEqual(['TES', 'JIR']);
  });

  test('Returns an array when only one project is present', () => {
    const projects = [];
    const pullRequest = { issueKeys: ['TES-1', 'TES-2', 'TES-3', 'TES-4'] };

    reduceProjectKeys(pullRequest, projects);
    expect(projects).toEqual(['TES']);
  });

  test('Works when called multiple times from different entities', () => {
    const projects = [];
    const commit = { issueKeys: ['TES-1', 'JIR-1', 'TES-3', 'TES-4'] };
    const pullRequest = { issueKeys: ['TES-1', 'TES-2', 'JIR-2', 'JIR-3'] };
    reduceProjectKeys(commit, projects);
    reduceProjectKeys(pullRequest, projects);
    expect(projects).toEqual(['TES', 'JIR']);
  });

  test('Should keep existing project keys even if they are not present', () => {
    const projects = ['GIT'];
    const commit = { issueKeys: ['TES-1', 'JIR-1', 'TES-3', 'TES-4'] };
    reduceProjectKeys(commit, projects);
    expect(projects).toEqual(['GIT', 'TES', 'JIR']);
  });
});
