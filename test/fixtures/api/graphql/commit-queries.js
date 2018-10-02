const query = 'query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {\n    repository(owner: $owner, name: $repo){\n      ref(qualifiedName: "master") {\n        target {\n          ... on Commit {\n            history(first: $per_page, after: $cursor) {\n              edges {\n                cursor\n                node {\n                  author {\n                    email\n                    name\n                  }\n                  authoredDate\n                  message\n                  oid\n                  url\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n  '

module.exports.commitsNoLastCursor = {
  query,
  variables: { owner: 'integrations', repo: 'test-repo-name', per_page: 100 }
}

module.exports.commitsWithLastCursor = {
  query,
  variables: {
    owner: 'integrations',
    repo: 'test-repo-name',
    per_page: 100,
    cursor: 'Y3Vyc29yOnYyOpK5MjAxsdlkwOC0yM1QxNzozODowNS0wNDowMM4MjT7J 99'
  }
}
