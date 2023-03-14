const gheHost = document.getElementById("gheHost").value;
const appHost = document.getElementById("appHost").value;
const uuid = document.getElementById("uuid").value;

const defaultManifest = {
  "name": "Jira",
  "url": "https://github.com/marketplace/jira-software-github",
  "redirect_url": `${ appHost }/github/manifest/${ uuid }/complete`,
  "hook_attributes": {
    "url": `${ appHost }/github/${ uuid }/webhooks`
  },
  "setup_url": `${ appHost }/github/${ uuid }/setup`,
  "callback_url": `${ appHost }/github/${ uuid }/callback`,
  "public": true,
  "default_permissions": {
    "actions": "read",
    "security_events": "read",
    "contents": "write",
    "deployments": "read",
    "issues": "write",
    "metadata": "read",
    "pull_requests": "write",
    "members": "read"
  },
  "default_events": [
    "code_scanning_alert",
    "commit_comment",
    "create",
    "delete",
    "deployment_status",
    "issue_comment",
    "issues",
    "pull_request",
    "pull_request_review",
    "push",
    "repository",
    "workflow_run"
  ]
};

$(document).ready(() => {
  const newForm = jQuery("<form>", {
    "action": `${ gheHost }/settings/apps/new`,
    "method": "post",
    "target": "_self"
  }).append(jQuery("<input>", {
    "name": "manifest",
    "id": "manifest",
    "value": JSON.stringify(defaultManifest),
    "type": "hidden"
  }));
  $(document.body).append(newForm);
  newForm.submit();
});
