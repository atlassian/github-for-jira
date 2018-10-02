/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1))

$('.add-organization-link').click(function (event) {
  event.preventDefault()

  const child = window.open(`/github/redirect?jwt=${encodeURIComponent(params.get('jwt'))}&xdm_e=${encodeURIComponent(params.get('xdm_e'))}`)

  const interval = setInterval(function () {
    if (child.closed) {
      clearInterval(interval)

      AP.navigator.reload()
    }
  }, 100)
})

$('.configure-connection-link').click(function (event) {
  event.preventDefault()

  const installationLink = $(event.target).data('installation-link')
  const child = window.open(installationLink)

  const interval = setInterval(function () {
    if (child.closed) {
      clearInterval(interval)

      AP.navigator.reload()
    }
  }, 100)
})

$('.delete-connection-link').click(function (event) {
  event.preventDefault()

  $.ajax({
    type: 'DELETE',
    url: `/jira/configuration?jwt=${encodeURIComponent(params.get('jwt'))}&xdm_e=${encodeURIComponent(params.get('xdm_e'))}`,
    data: {
      installationId: $(event.target).data('installation-id')
    },
    success: function (data) {
      AP.navigator.reload()
    }
  })
})

$('.sync-connection-link').click(function (event) {
  event.preventDefault()

  $.ajax({
    type: 'GET',
    url: `/jira/sync`,
    data: {
      installationId: $(event.target).data('installation-id'),
      host: $(event.target).data('jira-host')
    },
    success: function (data) {
      AP.navigator.reload()
    },
    error: function (error) {
      console.log(error)
    }
  })
})
