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

	window.AP.context.getToken(function(token){
		$.ajax({
			type: 'DELETE',
			url: `/jira/configuration?xdm_e=${encodeURIComponent(params.get('xdm_e'))}`,
			data: {
				installationId: $(event.target).data('installation-id'),
				jwt: token
			},
			success: function (data) {
				AP.navigator.reload()
			}
		});
	});


})

$('.sync-connection-link-OLD').click(function (event) {
  event.preventDefault()
  const installationId = $(event.target).data('installation-id')
	const jiraHost = $(event.target).data("jira-host");
	const csrfToken = document.getElementById("_csrf").value;

	window.AP.context.getToken(function(token){
		$.ajax({
			type: 'POST',
			url: `/jira/sync`,
			data: {
				installationId: installationId,
				jiraHost: jiraHost,
				syncType: document.getElementById(`${installationId}-sync-type`).value,
				jwt: token,
				_csrf: csrfToken
			},
			success: function (data) {
				AP.navigator.reload()
			},
			error: function (error) {
				console.log(error)
			}
		});
	});
})

$(".sync-connection-link").click(function (event) {
	event.preventDefault();
	const installationId = $(event.target).data("installation-id");
	const jiraHost = $(event.target).data("jira-host");
	const csrfToken = document.getElementById("_csrf").value;

	window.AP.context.getToken(function (token) {
		$.ajax({
			type: "POST",
			url: "/jira/sync",
			data: {
				installationId,
				jiraHost,
				syncType: "full",
				jwt: token,
				_csrf: csrfToken,
			},
			success: function (data) {
				AP.navigator.reload();
			},
			error: function (error) {
				console.log(error);
			},
		});
	});
});

/* ***************************** */
/* To be removed after FF tested */
/* ***************************** */
const retryModal = document.getElementById('sync-retry-modal')
const statusModal = document.getElementById('sync-status-modal-old')
const retryBtn = document.getElementById('sync-retry-modal-btn')
const statusBtn = document.getElementById('sync-status-modal-btn-old')
const retrySpan = document.getElementById('retry-close')
const statusSpan = document.getElementById('status-close-old')

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
/* ***************************** */
/* To be removed after FF tested */
/* ***************************** */

const syncStatusBtn = document.getElementById("sync-status-modal-btn");
const syncStatusModal = document.getElementById("sync-status-modal");
const syncStatusCloseBtn = document.getElementById("status-close");

if (syncStatusBtn != null) {
	syncStatusBtn.onclick = function () {
		syncStatusModal.style.display = "block";
	};
}

if (syncStatusCloseBtn != null) {
	syncStatusCloseBtn.onclick = function () {
		syncStatusModal.style.display = "none";
	};
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
	if (event.target.className === "jiraConfiguration__syncRetryModalOverlay") {
		syncStatusModal.style.display = "none";
	}
};
