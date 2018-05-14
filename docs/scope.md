# [JIRA](README.md) » Initial Product Scope

> Status: WIP

At a minimum, the new GitHub/JIRA integration must have functional parity with the legacy integration.
It is unknown what the migration path is for existing users.

- **[MUST]**: We are unable to ship without these items
- **[SHOULD]**: These items are necessary, but they can happen outside of the V1 ship if needed
- **[COULD]**: These items would be nice to have if time allows
- **[WON'T]**: These items will not be included in the V1 ship (Note: these aren't listed exhaustively, but some commonly questioned items are included for clarity.)

## Non Functional Requirements

* **[SHOULD]** Uses [GitHub Apps](https://developer.github.com/apps/) to leverage per repo settings without broad permissions.


## Equivalence to existing [DVCS Connector](https://confluence.atlassian.com/adminjiracloud/connect-jira-cloud-to-github-814188429.html)

* **[MUST]** Allows users viewing a JIRA ticket to see URLs of associated GitHub data : Pull Requests, Commits, Branches
* **[MUST]** Enables JIRA [smart commits]() from specific actions in GitHub - commit messages
* **[MUST]** Supports specific keywords from GitHub or Git data to associate data with JIRA
    * Closes JIRA issue - Synchronize with Pull Request closing
* **[MUST]** Allows adding a comment to a JIRA ticket from GitHub data -
* **[MUST]** Allows specific actions transition JIRA ticket states

## Implementation
* **[MUST]** Uses the new JIRA API endpoints.
* **[COULD]** Linkifies JIRA identifiers `[SENG-1234]` in GitHub UI - Commit Messages, Reviews, Issues and Pull Requests
* **[COULD]** Linkifies JIRA identifiers `[SENG-1234]` in GitHub notifications - email digest
* **[COULD]** Associates JIRA project to 1 or more GitHub repositories
* **[COULD]** Associates one GitHub repository with 1 or more JIRA projects

## Configuration

* **[MUST]** Allows users to specify which repositories to [synchronize with JIRA](https://confluence.atlassian.com/adminjiracloud/connect-jira-cloud-to-github-814188429.html#ConnectJiraCloudtoGitHub-Automaticsynchronizationandtemporarilydisablingalink)
* **[SHOULD]** Allows GitHub Enterprise instances to integrate with JIRA
* **[WONT]** Supports on-premises Atlassian products

## Misc

* **[MUST]** adheres to rate limits to keep GitHub Enterprise stable and responsive  


## Random Ideas

* **[COULD]** Creates a branch in GitHub from a JIRA ticket
* **[COULD]** Displays Pull Request 'state' in JIRA - [open, closed], is mergeable, are all CI passing, state of reviews
* **[COULD]** Modifies a Pull Request in GitHub from a JIRA ticket - Merge, Close
* **[COULD]** Orchestrates branches or releases from JIRA
* **[COULD]** Replaces GitHub issues with JIRA Issues
* **[COULD]** Replaces GitHub Projects with Atlassian Project Boards
* **[COULD]** Displays JIRA content in GitHub
