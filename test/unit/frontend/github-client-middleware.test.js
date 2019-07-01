const nock = require('nock')
const { isAdminFunction } = require('../../../lib/frontend/github-client-middleware')
const octokit = require('@octokit/rest')

describe('GitHub client middleware', () => {
  let isAdmin

  const organizationAdminResponse = {
    'role': 'admin'
  }

  const organizationMemberResponse = {
    'role': 'member'
  }

  beforeEach(() => {
    isAdmin = isAdminFunction(octokit())
  })

  it('isAdmin returns true if user is admin of a given organization', async () => {
    nock('https://api.github.com').get('/orgs/test-org/memberships/test-user').reply(200, organizationAdminResponse)
    const result = await isAdmin({
      org: 'test-org',
      username: 'test-user',
      type: 'Organization'
    })

    expect(result).toBe(true)
  })

  it('isAdmin returns false if user is not an admin of a given organization', async () => {
    nock('https://api.github.com').get('/orgs/test-org/memberships/test-user').reply(200, organizationMemberResponse)
    const result = await isAdmin({
      org: 'test-org',
      username: 'test-user',
      type: 'Organization'
    })

    expect(result).toBe(false)
  })

  it('isAdmin returns true if repo is owned by a given user', async () => {
    const result = await isAdmin({
      org: 'test-user',
      username: 'test-user',
      type: 'User'
    })

    expect(result).toBe(true)
  })

  it('isAdmin returns false if repo is owned by another user', async () => {
    const result = await isAdmin({
      org: 'different-user',
      username: 'test-user',
      type: 'User'
    })

    expect(result).toBe(false)
  })
})
