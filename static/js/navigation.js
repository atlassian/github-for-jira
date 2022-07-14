/* globals $, AP */
$(".go-back").click(function (event) {
  event.preventDefault();
  const previousPagePath = $(event.target).data("previous-page-path");
  const closeOnBack = $(event.target).data("close-on-back");

  if (closeOnBack) {
    window.close();
  } else if (previousPagePath) {
    AP.navigator.go("addonmodule", {moduleKey: previousPagePath});
  } else {
    history.back();
  }
});
