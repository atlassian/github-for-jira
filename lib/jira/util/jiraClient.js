const isProd = () => process.env.NODE_ENV === 'production';

class JiraClientDevInfo {
  static async undo(jiraClient, res) {
    /**
     * Only call github/migrationUndo in prod. Undo will only be called in Jira if
     * GITHUB_CONNECT_APP_IDENTIFIER is equal to com.github.integration.production
     */
    if (isProd()) {
      await jiraClient.devinfo.migration.undo();
      if (res) res.send('Successfully called migrationUndo');
    } else {
      if (res) res.send('migrationUndo will only be called in prod');
    }
  }

  static async complete(jiraClient, res) {
    /**
     * Only call github/migrationComplete in prod. Complete will only be called in Jira if
     * GITHUB_CONNECT_APP_IDENTIFIER is equal to com.github.integration.production
     */
    if (isProd()) {
      await jiraClient.devinfo.migration.complete();
      if (res) res.send('Successfully called migrationComplete');
    } else {
      if (res) res.send('migrationComplete will only be called in prod');
    }
  }
}

module.exports = JiraClientDevInfo;
