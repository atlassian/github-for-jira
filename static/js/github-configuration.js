/* globals $ */
$('.install-link').click(function (event) {
  event.preventDefault()

  $.post('/github/configuration', {
    installationId: $(event.target).data('installation-id')
  }, function (data) {
    window.close()
  })
})
