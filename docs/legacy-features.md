# Existing Jira Integration

> These docs were provided by the Jira team and describe the features of the current integration

## (Discovery) Documentation on how to connect Jira Cloud to GitHub

See
- (Atlassian docs) https://confluence.atlassian.com/adminjiracloud/connect-jira-cloud-to-github-814188429.html
- (Github docs) https://help.github.com/articles/integrating-jira-with-your-organization-s-projects/

## Installation

From within Jira Software, customers would need to

1. go to the DVCS Accounts page within settings
2. set up the Github connection via oAuth client ID and Code Secret
3. Sync all repos that were added.

Note: The same method is used for Github & Github Enterprise, but an additional Host URL is required on installation. When using Atlassian Connect to host the Github application, it will need to deal with Github + Github EE itself. 

![](https://user-images.githubusercontent.com/173/32561336-abd01cb6-c471-11e7-8719-13e165cd3dcd.png)

> We need to look at the initial sync as an important feature. This will most likely be used in the migration path from DVCS --> new integration.
>
> The expectation would be on GitHub to re-sync everything from a historical perspective so their data is maintained in Jira Software

## Configuration - Manage Repo connections

Once the customer has installed Jira Software <> GitHub together they can manage that integration with several different options. They are:
- Link a GitHub account (link one or more accounts)
- Delete a GitHub account
- Add or remove repos from the connected GitHub account
- Re-sync an individual repo (Soft sync or Full sync)
- Toggle smart commits on/off per repo
- Dropdown options for each account include...

1. Configure default repo settings (auto sync all repos - boolean or enable smart commits for all repos - boolean)
2. Refresh all repos
3. Reset OAuth settings
4. Delete

![github_repolist](https://user-images.githubusercontent.com/173/32561519-065b642e-c472-11e7-918a-ed0664f2564d.png)
![github_blankrepolist](https://user-images.githubusercontent.com/173/32561515-03ed17dc-c472-11e7-92af-4977ff55d4cb.png)
![github_re-sync](https://user-images.githubusercontent.com/173/32561514-03d1617c-c472-11e7-840e-a04feab40200.png)
![github_linknewaccount](https://user-images.githubusercontent.com/173/32561520-0678aee4-c472-11e7-8d07-e5ebc08932d2.png)
![github_dvcsaccountspage_syncoptions](https://user-images.githubusercontent.com/173/32561512-035d00de-c472-11e7-847e-d7ef733a17ea.png)
![github_dvcsaccountspage_dropdownoptions](https://user-images.githubusercontent.com/173/32561511-0332712a-c472-11e7-96bc-87e5c25d9e7a.png)
![github_dvcsaccountspage](https://user-images.githubusercontent.com/173/32561510-031b120a-c472-11e7-9f52-a07fbe58c793.png)

## (UX) Dev Panel

The development panel is maintained by Jira Software and will use the available GitHub dev info to populate the information here accordingly. It displays branches, commits, pull requests with a date.

The pull request is the only item with additional data, which is the PR status.

![github_devpanel](https://user-images.githubusercontent.com/173/32561769-b3df7f5e-c472-11e7-90a9-e22352a89c7d.png)


## (UX) Commits

It is expected that GitHub would interpret any commits with an issue key and then send that information to Jira Software via the new APIs provided.

The commit detail is maintained by Jira Software but the data being populated is provided by GitHub.

It is broken down by repo, then each commit message has:
- Author
- Commit hash
- Commit message
- Date
- Files
- File diff (expandable)

<img width="1539" alt="github_filediff" src="https://user-images.githubusercontent.com/173/32561903-fe8d176e-c472-11e7-85f4-bcbbd78e98c2.png">
<img width="1536" alt="github_commitdetail" src="https://user-images.githubusercontent.com/173/32561905-ffa02150-c472-11e7-89ac-b1c037dac511.png">

## (UX) Branches

Branch information is displayed in branch detail modal.

It is a list of branches with the columns being:
- Repo
- Branch name
- Pull request
- Action (Create pull request)

<img width="1534" alt="github_branchdetail" src="https://user-images.githubusercontent.com/173/32561945-19b0d120-c473-11e7-9464-d666c48e50d0.png">

## (UX) Pull Requests

The pull request detail has each PR and columns provided are:
- ID# 
- Title
- Status
- Author
- Reviewer (can be multiple)
- Updated

<img width="1544" alt="github_pullrequestdetail" src="https://user-images.githubusercontent.com/173/32561979-2bd65abe-c473-11e7-8c55-d84ec94c0778.png">
