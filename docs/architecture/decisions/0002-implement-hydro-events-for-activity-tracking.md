# 2. Implement Hydro Events for Activity Tracking

Date: 2020-10-20

## Status

Accepted

## Context

We've seen a number of instances where users' installations have been disabled, subscriptions have been unsubscribed (deleted), or installations have been deleted. Currently that information is (sometimes) reported in the logs, but logs are maintained for 15 days in Loggly (our current logging solution). Between lag time of receiving and investigating an issue, the logs may have expired and we do not have any insight into what has transpired. We should have a permanent location for tracking these destructive-type actions so that we can know when and why something happened to be able to better explain to a user (and to possibly find a bug or unexpected behavior).

## Decision

Internal to GitHub we use an eventing system called Hydro. This has an externally available HTTP Gateway which can receive signed JSON payloads (matching the predefined Schema). These events can contain User IDs, Installation IDs, free text (such as a reason or an action type) and is the normal place that we send this kind of event-driven data that we want for later research/inspection. Hydro seems like a good long-term fit for this information.

### Initial Events to Track

* Installation Created/Disabled/Destroyed
* Subscription Created/Destroyed

### Proposed Schema Fields

* GitHub Installation ID
* Jira Hostname (of the User's installation)
* Jira Integration ID (internal identifier to the Jira App)
* Action (create/disable/destroy)
* Reason (stafftools-api, jira webhook, web interaction)
* GitHub Actor (the stafftools user if this method was used)
* Jira Actor (if this information is present, TBD)

## Consequences

The long-term hosting plan for Jira is still to move it to our internal Kubernetes Infrastructure (Moda). Hydro Events are very common within that infrastructure, so this is a positive future-facing decision. The manner in which Hydro Events are submitted will not change significantly once the app is moved to its future-permanent location, but the URL and the signing aspects may.
