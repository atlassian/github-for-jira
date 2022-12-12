const params = new URLSearchParams(window.location.search.substring(1));
const gheHost = params.get("baseUrl");

$(document).ready(() => {
  $.ajax({
    type: "GET",
    // This is a separate route for getting GitHub manifest, which does not require any authentication
    url: `/github-manifest?gheHost=${gheHost}`,
    success: function (appManifest) {
      const newForm = jQuery("<form>", {
        "action": `${gheHost}/settings/apps/new`,
        "method": "post",
        "target": "_self"
      }).append(jQuery("<input>", {
        "name": "manifest",
        "id": "manifest",
        "value": JSON.stringify(appManifest),
        "type": "hidden"
      }));
      $(document.body).append(newForm);
      newForm.submit();
    }
  });
});
