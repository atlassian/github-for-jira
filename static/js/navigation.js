/* globals $, AP */
$(".go-back").click(function (event) {
  event.preventDefault();

  if (AP && AP.history) {
    AP.history.back();
  } else {
    history.back();
  }
});
