$("#noConfiguration__ConnectToGH").on("click", () => {
	AP.navigator.go(
		"addonmodule",
		{
			moduleKey: "github-post-install-page"
		}
	);
});