/* globals $, AP */
const ALLOWED_PROTOCOLS = ["http:", "https:"];
const GITHUB_CLOUD = ["github.com", "www.github.com"];
const defaultError = {
	message: 'The entered URL is not valid.',
	linkMessage: 'Learn more',
	// TODO: add URL for this
	linkUrl: '#'
}
const cloudURLError = {
	message: 'The entered URL is a GitHub Cloud site.',
	linkMessage: 'Connect a GitHub Cloud site',
	linkUrl: '/session/github/configuration'
}

/**
 * Method that checks the validity of the passed URL
 *
 * @param {string} inputURL
 * @returns {boolean}
 */
const checkValidGHEUrl = inputURL => {
	try {
		const { protocol, hostname } = new URL(inputURL);

		if (!ALLOWED_PROTOCOLS.includes(protocol)) {
			setErrorMessage(defaultError);
			return false;
		}
		// This checks whether the hostname whether there is an extension like `.com`, `.net` etc.
		if (hostname.split('.').length < 2) {
			setErrorMessage(defaultError);
			return false;
		}
		if (GITHUB_CLOUD.includes(hostname)) {
			setErrorMessage(cloudURLError);
			return false;
		}

		return true;
	} catch (e) {
		setErrorMessage(defaultError);
		return false;
	}
};

/**
 * Sets an error message with the passed parameters
 *
 * @param {Object<defaultError | cloudURLError>} error
 */
const setErrorMessage = error => {
	$("#gheServerURLError").show();
	$("#gheServerURLError > span").html(error.message);
	$("#gheServerURLError > a").html(error.linkMessage).attr("href", error.linkUrl);
	$("#gheServerURL").addClass("has-error");
};

/**
 * Hides the error messages
 */
const hideErrorMessage = () => {
	$("#gheServerURLError").hide();
	$("#gheServerURL").removeClass("has-error");
};

$("#gheServerURL").on("keyup", event => {
	const hasUrl = event.target.value.length > 0;
	$("#gheServerBtn").attr({
		"aria-disabled": !hasUrl,
		"disabled": !hasUrl
	});
	hideErrorMessage();
});

$("#gheServerBtn").on("click", event => {
	const btn = event.target;
	const gheServerURL = $("#gheServerURL").val().replace(/\/+$/, '');
	const isValid = checkValidGHEUrl(gheServerURL);

	$(btn).attr({
		"aria-disabled": !isValid,
		"disabled": !isValid
	});

	if (isValid) {
		hideErrorMessage();

		// Changing the text on the button and displaying the spinner
		$("#gheServerBtnText").hide();
		$("#gheServerBtnSpinner").show();

		console.log("gheServerURL: ", gheServerURL)

		// todo - make request to url to make sure we can get a 200 response
		// if that request fails, hide the spinner and show the text and render an error
		// if request succeeds, call the following
		$.ajax({
			type: "POST",
			url: "/jira/app-creation",
			data: {
				gheServerURL
			},
			success: function(data) {
				console.log("SUCCESS!!")
				AP.navigator.go(
					'addonmodule',
					{
						moduleKey: "github-app-creation-page"
					}
				);
			}
		});
	}
});
