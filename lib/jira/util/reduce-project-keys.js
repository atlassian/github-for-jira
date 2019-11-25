module.exports = (entity, projects) => {
  entity.issueKeys.forEach((key) => {
    const project = key.split('-')[0];
    if (!projects.includes(project)) {
      projects.push(project);
    }
  });
  return projects;
};
