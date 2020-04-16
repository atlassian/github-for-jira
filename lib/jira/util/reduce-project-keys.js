module.exports = (entity, projects) => {
  for (const key of entity.issueKeys) {
    const project = key.split('-')[0];
    if (!projects.includes(project)) {
      projects.push(project);
    }
  }
  return projects;
};
