/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault()

  $.post('/github/configuration', {
    installationId: $(event.target).data('installation-id'),
    jiraHost: document.getElementById('jiraHost').value,
    _csrf: document.getElementById('_csrf').value,
    clientKey: document.getElementById('clientKey').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err)
    }
    window.close()
  })
})

$('.manage-link').click(function (event) {
  event.preventDefault()
  const appUrl = document.querySelector('meta[name=public-url]').getAttribute('content');
  const installationId = $(event.target).data('installation-id');
  const jiraHost = document.getElementById('jiraHost').value;
  const child = window.open(`${appUrl}/github/subscriptions/?installationId=${encodeURIComponent(installationId)}&xdm_e=${encodeURIComponent(jiraHost)}`,'_self')

  const interval = setInterval(function () {
    if (child.closed) {
      clearInterval(interval)

      AP.navigator.reload()
    }
  }, 100)
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
