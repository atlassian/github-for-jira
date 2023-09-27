/* globals $, AP */
$(".go-back").click(function (event) {
  event.preventDefault();

  if (AP && AP.history) {
    AP.history.back();
  } else {
    history.back();
  }
});

$(".go-main-admin").click(function (event) {
	event.preventDefault();

	AP.navigator.go(
		'addonmodule',
		{
			moduleKey: "gh-addon-admin",
		}
	);
});


