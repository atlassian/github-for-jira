import transformCommit from '../transforms/commit';
import { getCommits as getCommitsQuery, getDefaultRef } from './queries';
import {GitHubAPI} from 'probot';

// TODO: better typings
export default async (github:GitHubAPI, repository, cursor, perPage:number) => {
  const data = await github.graphql(getDefaultRef, {
    owner: repository.owner.login,
    repo: repository.name,
  });

  const refName = (data.repository.defaultBranchRef) ? data.repository.defaultBranchRef.name : 'master';

  const commitsData = await github.graphql(getCommitsQuery, {
    owner: repository.owner.login,
    repo: repository.name,
    per_page: perPage,
    cursor,
    default_ref: refName,
  });

  // if the repository is empty, commitsData.repository.ref is null
  const { edges } = commitsData.repository.ref
    ? commitsData.repository.ref.target.history
    : { edges: [] };

  const authors = edges.map(({ node: item }) => item.author);
  const commits = edges.map(({ node: item }) =>
    // translating the object into a schema that matches our transforms
    ({
      author: item.author,
      authorTimestamp: item.authoredDate,
      fileCount: 0,
      sha: item.oid,
      message: item.message,
      url: item.url,
    }));

  return {
    edges,
    jiraPayload: transformCommit({ commits, repository }, authors)
  };
};
