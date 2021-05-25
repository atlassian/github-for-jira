import GithubAPI from '../config/github-api';
import {NextFunction, Request, RequestHandler, Response} from 'express';
import {App} from '@octokit/app';
import {GitHubAPI} from 'probot';

export default (octokitApp: App): RequestHandler => (req: Request, res: Response, next: NextFunction): void => {
  if (req.session.githubToken) {
    res.locals.github = GithubAPI({
      auth: req.session.githubToken,
    });
  } else {
    res.locals.github = GithubAPI();
  }

  res.locals.client = GithubAPI({
    auth: octokitApp.getSignedJsonWebToken(),
  });
  res.locals.isAdmin = isAdmin(res.locals.github);

  next();
};

/**
 * @returns true if the user is an admin of the Org or if the repo belongs to that user
 */
export const isAdmin = (githubClient: GitHubAPI) => {
  return async function (args: { org: string, username: string, type: string }): Promise<boolean> {
    const {org, username, type} = args;
    // If this is a user installation, the "admin" is the user that owns the repo
    if (type === 'User') {
      return org === username;
    }

    // Otherwise this is an Organization installation and we need to ask GitHub for role of the logged in user
    try {
      const {
        data: {role},
      } = await githubClient.orgs.getMembership({org, username});
      return role === 'admin';
    } catch (err) {
      console.log(err);
      console.log(`${org} has not accepted new permission for getOrgMembership`);
      console.log(`error=${err} org=${org}`);
      return false;
    }
  };
}
