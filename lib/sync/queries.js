module.exports = {
  getPullRequests: `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo){
      pullRequests(first: $per_page, orderBy: {field: CREATED_AT, direction: DESC}, after: $cursor) {
        edges {
          cursor
          node {
            author {
              avatarUrl
              login
              url
            }
            databaseId
            comments {
              totalCount
            }
            repository {
              url
            }
            baseRef {
              name
            }
            headRef {
              name
            }
            number
            state
            title        
            updatedAt
            url
          }
        }
      }
    }
  }`,

  getCommits: `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo){
      ref(qualifiedName: "master") {
        target {
          ... on Commit {
            history(first: $per_page, after: $cursor) {
              edges {
                cursor
                node {
                  author {
                    avatarUrl
                    name
                    user {
                      url
                    }
                  }
                  authoredDate
                  changedFiles
                  message
                  oid
                  url
                }
              }
            }
          }
        }
      }
    }
  }
  `
}
