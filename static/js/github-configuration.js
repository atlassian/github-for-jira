/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault()

  $.post('/github/configuration', {
    installationId: $(event.target).data('installation-id'),
    _csrf: document.getElementById('_csrf').value
  }, function (data) {
    if (data.err) {
      return console.log(data.err.message)
    }
    window.close()
  })
})
