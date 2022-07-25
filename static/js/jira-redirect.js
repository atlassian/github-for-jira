const params = new URLSearchParams(window.location.search.substring(1));
const gheHost = params.get("serverUrl");
$(document).ready(() => {
  $.ajax({
    type: "GET",
    url: `/github/manifest?gheHost=${gheHost}`,
    success: function (appManifest) {
      const newForm = jQuery("<form>", {
        "action": `${gheHost}/settings/apps/new`,
        "method": "post",
        "target": "_top"
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
