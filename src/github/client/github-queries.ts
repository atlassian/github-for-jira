import { Repository } from "models/subscription";

export const ViewerRepositoryCountQuery = `
query {
	viewer {
		repositories {
			totalCount
		}
	}
}`;

export interface RepositoryNode {
	node: Repository;
	cursor?: string;
}

export interface OrgNode {
	login: string;
}

export interface GetRepositoriesResponse {
	viewer: {
		repositories: {
			totalCount: number;
			pageInfo: {
				endCursor: string;
				hasNextPage: boolean;
			};
			edges: RepositoryNode[];
		}
	};
}

export interface SearchedRepositoriesResponse {
	items: Repository[]
}

export interface UserOrganizationsResponse {
	viewer: {
		login: string;
		organizations: {
			nodes: OrgNode[];
		}
	}
}

export const GetRepositoriesQuery = `query ($per_page: Int!, $order_by: RepositoryOrderField = CREATED_AT, $cursor: String) {
  viewer {
    repositories(first: $per_page, after: $cursor, orderBy: {field: $order_by, direction: DESC}) {
      totalCount
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

export type pullRequestNode = {
	number: number;
	id: string;
	state: string;
	mergedAt?: string;
	updatedAt: string;
	createdAt: string;
	title: string;
	body: string;
	url: string;
	draft: boolean;
	headRefName: string; // is defined even if the ref was deleted
	baseRefName: string; // is defined even if the ref was deleted
	headRef?: {
		id: string;
		name: string;
		repository: {
			url: string;
			name: string;
			owner: {
				login: string;
			};
		};
		target: {
			oid: string;
			author: {
				login: string;
				avatarUrl: string;
				url: string;
				name?: string;
				email?: string;
			};
		};
	};
	comments: {
		totalCount: number;
	};
	author?: {
		login: string;
		avatarUrl: string;
		url: string;
		name?: string;
		email?: string;
	};
	commits: {
		nodes: {
			commit: {
				author: {
					user: {
						login: string;
						email: string;
						avatarUrl: string;
						name?: string;
						url: string;
					};
				};
			};
		}[];
	};
	reviews: {
		nodes: {
			submittedAt: string;
			state: string;
			author: {
				login: string;
				avatarUrl: string;
				url: string;
				name?: string;
				email?: string;
			};
		}[];
	};
	reviewRequests: {
		nodes: {
			author: {
				login: string;
				avatarUrl: string;
				url: string;
				name?: string;
				email?: string;
			};
		}[];
	};
};

export type pullRequestQueryResponse = {
	repository: {
		pullRequests: {
			edges: {
				createdAt: string;
				cursor: string,
				node: pullRequestNode;
			}[]
		};
	};
};

export const getPullRequests = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {

		pullRequests(first: $per_page, orderBy: {field: CREATED_AT, direction: DESC}, after: $cursor) {
      edges {
      	cursor
				node {
					number
					id
					state
					mergedAt
					createdAt
					updatedAt
					title
					body
					url
					baseRefName,
					headRefName,
					headRef {
						id
						name
						repository {
							name
							owner {
								login
							}
						}
						target {
							oid
							... on Commit {
                author {
                  user {
                    login
                    email
                    avatarUrl
                    name
                    url
                  }
                }
              }
						}
					}
					comments {
						totalCount
					}
					author {
						login
						avatarUrl
						url
						... on User {
							name
							email
						}
					}
					commits(last: 1) {
						nodes {
							commit {
								author {
									user {
										login
										email
										avatarUrl
										name
										url
									}
								}
							}
						}
					}
					reviews(first: 100) {
						nodes {
              submittedAt
              state
							author {
								login
								avatarUrl
								url
								... on User {
									name
									email
								}
							}
						}
					}
					reviewRequests(first: 100) {
            nodes {
              requestedReviewer {
                __typename
                ... on User {
                  login
                  avatarUrl
                  url
                  ... on User {
                    name
                    email
                  }
                }
              }
            }
          }
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

export const getCommitsQueryWithChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $commitSince: GitTimestamp, $cursor: String) {
  repository(owner: $owner, name: $repo){
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: $per_page, after: $cursor, since: $commitSince) {
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
                changedFilesIfAvailable: changedFiles
              }
            }
          }
        }
      }
    }
  }
}`;

export const getCommitsQueryWithoutChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $commitSince: GitTimestamp, $cursor: String) {
  repository(owner: $owner, name: $repo){
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: $per_page, after: $cursor, since: $commitSince) {
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

export type getBranchesResponse = {
	repository: {
		refs: {
			edges: {
				cursor: string;
				node: {
					associatedPullRequests: {
						nodes: { title: string }[];
					},
					name: string;
					target: {
						author: {
							avatarUrl: string;
							email: string;
							name: string;
						},
						authoredDate: string;
						changedFiles: number;
						oid: string;
						message: string;
						url: string;
						history: {
							nodes: {
								message: string;
								oid: string;
								authoredDate: string;
								author: {
									avatarUrl: string;
									email: string;
									name: string;
									user: {
										url: string;
									}
								},
								url: string;
							}[]
						}
					}
				}
			}[]
		}
	}
};

export const getBranchesQueryWithChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $commitSince: GitTimestamp, $cursor: String) {
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
                changedFilesIfAvailable: changedFiles
                history(since: $commitSince, first: 50) {
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

export const getBranchesQueryWithoutChangedFiles = `query ($owner: String!, $repo: String!, $per_page: Int!, $commitSince: GitTimestamp, $cursor: String) {
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
                history(since: $commitSince, first: 50) {
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

export const getBranchesQueryWithoutCommits = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
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
		createdAt: string,
		updatedAt?: string,
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
		statuses?: {
			nodes: {
				createdAt: string,
				updatedAt: string,
				state: string,
				logUrl: string
			}[]
		},
		latestStatus: {
			environmentUrl: string,
			logUrl: string,
			state: string,
			id: string,
			createdAt: string,
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
    deployments(first: $per_page, after: $cursor, orderBy: { direction: DESC, field: CREATED_AT }) {
      edges {
        cursor
        node {
					createdAt
          repository {
            id: databaseId
            node_id: id
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
						createdAt
            updatedAt
          }
        }
      }
    }
  }
}`;

export const getDeploymentsQueryWithStatuses = `query ($owner: String!, $repo: String!, $per_page: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo){
    deployments(first: $per_page, after: $cursor, orderBy: { direction: DESC, field: CREATED_AT }) {
      edges {
        cursor
        node {
					createdAt
          repository {
            id: databaseId
            node_id: id
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
          statuses(last: 5) {
            nodes {
              createdAt
              updatedAt
              state
							logUrl
            }
          }
          latestStatus {
            environmentUrl
            logUrl
            state
            id
						createdAt
            updatedAt
          }
        }
      }
    }
  }
}`;

export const SearchRepositoriesQuery = `query($query_string: String!, $per_page: Int!, $cursor: String) {
  search(
    type: REPOSITORY,
    query: $query_string,
    first: $per_page,
    after: $cursor
  ) {
    repos: edges {
      repo: node {
        ... on Repository {
          nameWithOwner
          name
        }
      }
    }
  }
}
`;

export const UserOrganizationsQuery = `query($first: Int!) {
  viewer {
    login
    organizations(first: $first) {
      nodes {
        login
      }
    }
  }
}`;
