export default (entity: { issueKeys: string[] }, projects: string[]) => {
  // TODO: change this to a reduce
  for (const key of entity.issueKeys) {
    const project = key.split('-')[0];
    if (!projects.includes(project)) {
      projects.push(project);
    }
  }
  return projects;
};
