/* globals $, AP */
const params = new URLSearchParams(window.location.search.substring(1))
const appUrl = document.querySelector('meta[name=public-url]').getAttribute('content')

$('.add-organization-link').click(function (event) {
  event.preventDefault()

  const child = window.open(`${appUrl}/github/login?jwt=${encodeURIComponent(params.get('jwt'))}&xdm_e=${encodeURIComponent(params.get('xdm_e'))}`)

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
  const installationId = $(event.target).data('installation-id')

  $.ajax({
    type: 'POST',
    url: `/jira/sync`,
    data: {
      installationId: installationId,
      jiraHost: $(event.target).data('jira-host'),
      syncType: document.getElementById(`${installationId}-sync-type`).value,
      token: params.get('jwt'),
      _csrf: document.getElementById('_csrf').value
    },
    success: function (data) {
      AP.navigator.reload()
    },
    error: function (error) {
      console.log(error)
    }
  })
})

const retryModal = document.getElementById('sync-retry-modal')
const statusModal = document.getElementById('sync-status-modal')
const retryBtn = document.getElementById('sync-retry-modal-btn')
const statusBtn = document.getElementById('sync-status-modal-btn')
const retrySpan = document.getElementById('retry-close')
const statusSpan = document.getElementById('status-close')

if (retryBtn != null) {
  retryBtn.onclick = function () {
    retryModal.style.display = 'block'
  }
}

if (statusBtn != null) {
  statusBtn.onclick = function () {
    statusModal.style.display = 'block'
  }
}

if (retrySpan != null) {
  retrySpan.onclick = function () {
    retryModal.style.display = 'none'
  }
}

if (statusSpan != null) {
  statusSpan.onclick = function () {
    statusModal.style.display = 'none'
  }
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target === retryModal) {
    retryModal.style.display = 'none'
  }
  if (event.target === statusModal) {
    statusModal.style.display = 'none'
  }
}
