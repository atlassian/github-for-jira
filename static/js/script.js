/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1))

$('.add-organization-link').click(function () {
  const child = window.open(`/pages/github-login?jwt=${encodeURIComponent(params.get('jwt'))}&xdm_e=${encodeURIComponent(params.get('xdm_e'))}`)

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
    url: `/pages/jira-configuration?jwt=${encodeURIComponent(params.get('jwt'))}&xdm_e=${encodeURIComponent(params.get('xdm_e'))}`,
    data: {
      installationId: $(event.target).data('installation-id')
    },
    success: function (data) {
      AP.navigator.reload()
    }
  })
})
