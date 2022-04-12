import { Repository } from "@octokit/graphql-schema";

export const ViewerRepositoryCountQuery = `
query {
	viewer {
		repositories {
			totalCount
		}
	}
}`;

type RepositoryNode = {
	node: Repository
}

export type GetRepositoriesResponse = {
	viewer: {
		repositories: {
			pageInfo,
			edges: RepositoryNode[]
		}
	}
};

export const GetRepositoriesQuery = `query ($per_page: Int!, $cursor: String) {
  viewer {
    repositories(first: $per_page, after: $cursor) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id: databaseId
          name
          full_name: nameWithOwner
          owner {
            login
          }
          html_url: url
          updated_at: updatedAt
        }
      }
    }
  }
}`;

export const getPullRequests = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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

export type CommitQueryNode = {
	cursor: string,
	node: {
		author: {
			avatarUrl: string,
			email: string,
			name: string,
			user: { url: string }
		},
		authoredDate: Date,
		message: string,
		oid: string,
		url: string,
		changedFiles?: number
	}
}

export type getCommitsResponse = {
	repository: {
		defaultBranchRef: {
			target: {
				history: {
					edges: CommitQueryNode[]
				}
			}
		}
	}
};

export const getCommitsQueryWithChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo){
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: $per_page, after: $cursor) {
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

export const getCommitsQueryWithoutChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo){
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: $per_page, after: $cursor) {
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
              }
            }
          }
        }
      }
    }
  }
  }`;

export type getBranchesResponse = { repository: Repository };
export const getBranchesQueryWithChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      refs(first: $per_page, refPrefix: "refs/heads/", after: $cursor) {
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
                history(first: 50) {
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

export const getBranchesQueryWithoutChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      refs(first: $per_page, refPrefix: "refs/heads/", after: $cursor) {
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
                history(first: 50) {
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

export type DeploymentQueryNode = {
  cursor: string,
  node: {
    repository: Repository,
    databaseId: string,
    commitOid: string,
    task: string,
    ref: {
      name: string,
      id: string
    },
    environment: string,
    description: string,
    latestStatus: {
      environmentUrl: string,
      logUrl: string,
      state: string,
      id: string,
      updatedAt: string
    }
  }
}

export type getDeploymentsResponse = {
	repository: {
		deployments: {
      edges: DeploymentQueryNode[]
    }
	}
};


export const getDeploymentsQuery = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo){
    deployments(first: $per_page, after: $cursor) {
      edges {
        cursor
        node {
          repository {
            name
            owner {
              login
            }
          }
          databaseId
          commitOid
          task
          ref {
            name
            id
          }
          environment
          description
          latestStatus {
            environmentUrl
            logUrl
            state
            id
            updatedAt
          }
        }
      }
    }
  }
}`;
