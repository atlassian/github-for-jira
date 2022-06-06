# Github for Jira Data Model

![Data Model](./images/data-model.jpg)
[draw.io file](./draw.io/data-model.drawio.xml)

Github for Jira used to only integrate between Jira and github.com, but with the added support for Github Enterprise Server, we must be able to handle multiple Github apps to a single Jira instance.  This data model is to try to clarify the interactions between these entities and it's evolution as we continue to develop the integration.

This model doesn't consider all data that's stored in each entity, only those relevant to create the connections between entities.

### Installation

Installations are only specific to the Jira app, 1 per Jira instance.  It holds the `clientKey`, `sharedSecret` and `jiraHost` given to us by the Connect install webhook - `clientKey` is the cloud id and can be used as an identifier for logs as the `jiraHost` is considered to be User Generated Content.

### GithubServerApp

Each Github App created in a Github Enterprise Server instance is added to this table to keep track of them.  We do not hold the Github Cloud app in this table since we need it as a default, but still use the same data structure in the code.  Each App will have access to many Organizations under it and we much show all results to the users when needed, which means multiple API calls .

### Subscription

When you add a Github Organization to the integration, a `Subscription` is created to link the Jira app to the Org through a Github App (cloud or server).  A Jira instance can have an unlimited amount of Subscriptions for each Org added.

### RepoSyncState

When backfilling a Github Organization, we keep the state of each Repository within that Org as to where they are in the process.