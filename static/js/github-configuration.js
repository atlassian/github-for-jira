/* globals $ */
$('.install-link').click((event) => {
  event.preventDefault();

  $.post('/github/configuration', {
    installationId: $(event.target).data('installation-id'),
    _csrf: document.getElementById('_csrf').value,
    clientKey: document.getElementById('clientKey').value,
  }, (data) => {
    if (data.err) {
      return console.log(data.err);
    }
    window.close();
  });
});

$('.delete-link').click((event) => {
  event.preventDefault();

  $.post('/github/subscription', {
    installationId: $(event.target).data('installation-id'),
    jiraHost: $(event.target).data('jira-host'),
    _csrf: document.getElementById('_csrf').value,
  }, (data) => {
    if (data.err) {
      return console.log(data.err);
    }
    window.close();
  });
});
