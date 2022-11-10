function openChildWindow(url) {
	const child = window.open(url);
	const interval = setInterval(function () {
		if (child.closed) {
			clearInterval(interval);
			location.reload();
		}
	}, 500);
	return child;
}

$("#noConfiguration__ConnectToGH").on("click", () => {
	openChildWindow("/github/configuration");
});
