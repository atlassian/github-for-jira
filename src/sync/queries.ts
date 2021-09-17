export const getPullRequests = `query ($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo){
      pullRequests(first: 100, orderBy: {field: CREATED_AT, direction: DESC}, after: $cursor) {
        edges {
          cursor
          node {
            author {
              avatarUrl
              login
              url
            }
            databaseId
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
            body
            updatedAt
            url
          }
        }
      }
    }
  }`;

export const getPullRequestReviews = `query($owner: String!, $repo: String!, $pullRequestNumber: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pullRequestNumber) {
      reviews(first: 100, after: $cursor) {
        totalCount
        edges {
          cursor
          node {
            body
            state
            url
            submittedAt
            author {
              ... on User {
                avatarUrl
                login
                email
                url
                name
              }
            }
          }
        }
      }
    }
  }
}`;

export const getCommits = `query ($owner: String!, $repo: String!, $cursor: String, $default_ref: String!) {
    repository(owner: $owner, name: $repo){
      ref(qualifiedName: $default_ref) {
        target {
          ... on Commit {
            history(first: 100, after: $cursor) {
              edges {
                cursor
                node {
                  author {
                    avatarUrl
                    email
                    name
                    user {
                      url
                    }
                  }
                  authoredDate
                  message
                  oid
                  url
                  changedFiles
                }
              }
            }
          }
        }
      }
    }
  }`;

export const getBranches = `query ($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      refs(first: 100, refPrefix: "refs/heads/", after: $cursor) {
        edges {
          cursor
          node {
            associatedPullRequests(first:1) {
              nodes {
                title
              }
            }
            name
            target {
              ... on Commit {
                author {
                  avatarUrl
                  email
                  name
                }
                authoredDate
                changedFiles
                history(first: 100) {
                  nodes {
                    message
                    oid
                    authoredDate
                    author {
                      avatarUrl
                      email
                      name
                      user {
                        url
                      }
                    }
                    url
                  }
                }
                oid
                message
                url
              }
            }
          }
        }
      }
    }
  }`;

export const getDefaultRef = `query ($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          name
        }
    }
  }`;
