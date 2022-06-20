$('.install-link').click(function (event) {
  event.preventDefault();
  const installationId = $(event.target).data('installation-id');
  const csrfToken = document.getElementById('_csrf').value;
  const clientKey = document.getElementById('clientKey').value;

  // TODO: Revisit later once all the screens are hooked up
  $.post('/github/configuration', {
    installationId,
    _csrf: csrfToken,
    clientKey
  }, function (data) {
    if (data.err) {
      return console.log(data.err);
    }
    window.close();
  });
});