const query = 'query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {\n    repository(owner: $owner, name: $repo) {\n      refs(first: $per_page, refPrefix: "refs/heads/", after: $cursor) {\n        edges {\n          cursor\n          node {\n            associatedPullRequests(first:1) {\n              nodes {\n                title\n              }\n            }\n            name\n            target {\n              ... on Commit {\n                author {\n                  avatarUrl\n                  email\n                  name\n                }\n                authoredDate\n                history(first: $per_page) {\n                  nodes {\n                    message\n                    oid\n                    authoredDate\n                    author {\n                      avatarUrl\n                      email\n                      name\n                      user {\n                        url\n                      }\n                    }\n                    url\n                  }\n                }\n                oid\n                message\n                url\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  '

module.exports.branchesNoLastCursor = {
  query,
  variables: { owner: 'integrations', repo: 'test-repo-name', per_page: 50 }
}

module.exports.branchesWithLastCursor = {
  query,
  variables: {
    owner: 'integrations',
    repo: 'test-repo-name',
    per_page: 50,
    cursor: 'MQ'
  }
}
