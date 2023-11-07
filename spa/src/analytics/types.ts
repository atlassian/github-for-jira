type UIEventActionSubject =
	"startToConnect"
	| "authorizeTypeGitHubCloud" | "authorizeTypeGitHubEnt"
  | "startOAuthAuthorisation" | "switchGitHubAccount"
	| "connectOrganisation" | "installToNewOrganisation"
	| "checkBackfillStatus"
	| "dropExperienceViaBackButton"
	| "learnAboutIssueLinking"
	| "checkOrgAdmin" | "generateDeferredInstallationLink"
	| "closedDeferredInstallationModal" | "copiedDeferredInstallationUrl"
	| "signInThroughDeferredInstallationStartScreen";

export type UIEventProps = {
	actionSubject: UIEventActionSubject,
	action: "clicked"
};

export type ScreenNames =
	"StartConnectionEntryScreen"
  | "AuthorisationScreen"
	| "InstallationRequested"
	| "OrganisationConnectionScreen"
	| "SuccessfulConnectedScreen"
	| "DeferredInstallationModal"
	| "DeferredInstallationStartScreen"
	| "DeferredInstallationForbiddenScreen"
	| "DeferredInstallationErrorScreen"
	| "DeferredInstallationSuccessScreen";

type TrackEventActionSubject =
	"finishOAuthFlow"
  | "organizations"
  | "organisationConnectResponse"
	| "installNewOrgInGithubResponse";

export type TrackEventProps = {
	actionSubject: TrackEventActionSubject,
	action: "success" | "fail" | "fetched" | "requested";
};

export type ScreenEventProps = {
	name: ScreenNames
};

export type AnalyticClient = {
	sendScreenEvent: (eventProps: ScreenEventProps, attributes?: Record<string, unknown>, requestId?: string) => void;
	sendUIEvent: (eventProps: UIEventProps, attributes?: Record<string, unknown>, requestId?: string) => void;
	sendTrackEvent: (eventProps: TrackEventProps, attributes?: Record<string, unknown>, requestId?: string) => void;
};

