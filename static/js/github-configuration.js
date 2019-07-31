/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault()

  $.post('/github/configuration', {
    installationId: $(event.target).data('installation-id'),
    _csrf: document.getElementById('_csrf').value,
    clientKey: document.getElementById('clientKey').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
    window.close()
  })
})

$('.delete-link').click(function (event) {
  event.preventDefault()

  $.post('/github/subscription', {
    installationId: $(event.target).data('installation-id'),
    jiraHost: $(event.target).data('jira-host'),
    _csrf: document.getElementById('_csrf').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
    window.close()
  })
})
