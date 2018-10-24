const reduceProjectKeys = require('../../../lib/jira/util/reduce-project-keys')

describe('Reduces an array of Issue Keys to their unique projects', () => {
  test('Reduces commits payload when an array is empty', () => {
    let projects = []
    let commit = { issueKeys: ['TES-1', 'TES-2', 'JIR-1', 'JIR-2', 'JIR-3'] }

    reduceProjectKeys(commit, projects)
    expect(projects).toEqual(['TES', 'JIR'])
  })

  test('Does not duplicate project identifiers if they already exist', () => {
    let projects = ['TES', 'JIR']
    let commit = { issueKeys: ['TES-1', 'TES-2', 'JIR-1', 'JIR-2', 'JIR-3'] }

    reduceProjectKeys(commit, projects)
    expect(projects).toEqual(['TES', 'JIR'])
  })

  test('Returns an array when only one project is present', () => {
    let projects = []
    let pullRequest = { issueKeys: ['TES-1', 'TES-2', 'TES-3', 'TES-4'] }

    reduceProjectKeys(pullRequest, projects)
    expect(projects).toEqual(['TES'])
  })

  test('Works when called multiple times from different entities', () => {
    let projects = []
    let commit = { issueKeys: ['TES-1', 'JIR-1', 'TES-3', 'TES-4'] }
    let pullRequest = { issueKeys: ['TES-1', 'TES-2', 'JIR-2', 'JIR-3'] }
    reduceProjectKeys(commit, projects)
    reduceProjectKeys(pullRequest, projects)
    expect(projects).toEqual(['TES', 'JIR'])
  })

  test('Should keep existing project keys even if they are not present', () => {
    let projects = ['GIT']
    let commit = { issueKeys: ['TES-1', 'JIR-1', 'TES-3', 'TES-4'] }
    reduceProjectKeys(commit, projects)
    expect(projects).toEqual(['GIT', 'TES', 'JIR'])
  })
})
