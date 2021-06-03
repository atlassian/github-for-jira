/* eslint-disable @typescript-eslint/no-explicit-any */
export const mockModels = {
  Installation: {
    getForHost: {
      jiraHost: process.env.ATLASSIAN_URL,
      sharedSecret: process.env.ATLASSIAN_SECRET,
      enabled: true
    } as any,
    findByPk: {
      gitHubInstallationId: 1234,
      enabled: true,
      id: 1234,
      jiraHost: process.env.ATLASSIAN_URL
    } as any,
    getPendingHost: {
      jiraHost: process.env.ATLASSIAN_URL,
      sharedSecret: process.env.ATLASSIAN_SECRET,
      enabled: false
    } as any,
    install: {
      id: 1234,
      jiraHost: process.env.ATLASSIAN_URL,
      sharedSecret: process.env.ATLASSIAN_SECRET,
      enabled: true,
      secrets: "secrets",
      clientKey: "client-key",
    } as any
  },
  Subscription: {
    getAllForInstallation: [
      {
        jiraHost: process.env.ATLASSIAN_URL
      }
    ] as any,
    install: {  } as any,
    getSingleInstallation: {
      id: 1,
      jiraHost: process.env.ATLASSIAN_URL
    } as any,
    findOrStartSync: {
      id: 1,
      data: {
        installationId: 1234,
        jiraHost: process.env.ATLASSIAN_URL
      }
    } as any,
    getAllForHost: {
      id: 1,
      jiraHost: process.env.ATLASSIAN_URL
    } as any
  },
  Project: {
    incrementOccurence: {
      projectKey: "PROJ"
    } as any
  }
};
