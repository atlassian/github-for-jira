const query = 'query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String, $default_ref: String!) {\n    repository(owner: $owner, name: $repo){\n      ref(qualifiedName: $default_ref) {\n        target {\n          ... on Commit {\n            history(first: $per_page, after: $cursor) {\n              edges {\n                cursor\n                node {\n                  author {\n                    avatarUrl\n                    email\n                    name\n                    user {\n                      url\n                    }\n                  }\n                  authoredDate\n                  message\n                  oid\n                  url\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  '

module.exports.commitsNoLastCursor = {
  query,
  variables: { owner: 'integrations', repo: 'test-repo-name', per_page: 50, default_ref: 'master' }
}

module.exports.commitsWithLastCursor = {
  query,
  variables: {
    owner: 'integrations',
    repo: 'test-repo-name',
    per_page: 50,
    cursor: 'Y3Vyc29yOnYyOpK5MjAxsdlkwOC0yM1QxNzozODowNS0wNDowMM4MjT7J 99',
    default_ref: 'master'
  }
}

const defaultBranchQuery = 'query ($owner: String!, $repo: String!) {\n    repository(owner: $owner, name: $repo) {\n        defaultBranchRef {\n          name\n        }\n    }      \n  }'

module.exports.getDefaultBranch = {
  query: defaultBranchQuery,
  variables: {
    owner: 'integrations',
    repo: 'test-repo-name'
  }
}
