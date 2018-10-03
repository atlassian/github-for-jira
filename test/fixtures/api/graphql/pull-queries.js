const query = 'query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {\n    repository(owner: $owner, name: $repo){\n      pullRequests(first: $per_page, orderBy: {field: CREATED_AT, direction: DESC}, after: $cursor) {\n        edges {\n          cursor\n          node {\n            author {\n              avatarUrl\n              login\n              url\n            }\n            databaseId\n            comments {\n              totalCount\n            }\n            repository {\n              url\n            }\n            baseRef {\n              name\n            }\n            headRef {\n              name\n            }\n            number\n            state\n            title        \n            updatedAt\n            url\n          }\n        }\n      }\n    }\n  }'

module.exports.pullsNoLastCursor = {
  query,
  variables: { owner: 'integrations', repo: 'test-repo-name', per_page: 100 }
}

module.exports.pullsWithLastCursor = {
  query,
  variables: {
    owner: 'integrations',
    repo: 'test-repo-name',
    per_page: 100,
    cursor: 'Y3Vyc29yOnYyOpK5MjAxOC0wOC0yM1QxNzozODowNS0wNDowMM4MjT7J'
  }
}
