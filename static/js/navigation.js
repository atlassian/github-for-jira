/* globals $, AP */
$(".go-back").click(function (event) {
  event.preventDefault();
  const previousPagePath = $(event.target).data("previous-page-path");

  if (previousPagePath) {
    AP.navigator.go("addonmodule", {moduleKey: previousPagePath});
  } else {
    history.back();
  }
});
