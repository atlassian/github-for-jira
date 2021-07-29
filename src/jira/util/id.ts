const validJiraId = /^[a-zA-Z0-9~.\-_]+$/;
export const getJiraId = (name: string) => validJiraId.test(name) ? name : `~${Buffer.from(name).toString("hex")}`;

