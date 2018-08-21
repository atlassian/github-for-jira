module.exports.getPullRequests = `query ($owner: String!, $repo: String!, $per_page: Int!) {
  repository(owner: $owner, name: $repo){
  	pullRequests(first: $per_page) {
      nodes {
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
}`

module.exports.getCommits = `query ($owner: String!, $repo: String!, $per_page: Int!) {
  repository(owner: $owner, name: $repo){
  	ref(qualifiedName: "master") {
      target {
        ... on Commit {
          history(first: $per_page) {
            nodes {
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
`
