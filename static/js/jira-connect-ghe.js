const ALLOWED_PROTOCOLS = ["http:", "https:"];
const ALLOWED_DOMAIN_EXTENSIONS = [".com", ".net"];
const GITHUB_CLOUD = ["github.com", "www.github.com"];

/**
 * Method that checks the validity of the passed URL
 *
 * @returns {boolean}
 */
const checkValidUrl = inputURL => {
	try {
		const { protocol, hostname} = new URL(inputURL);

		if (!ALLOWED_PROTOCOLS.some(allowedProtocol => protocol === allowedProtocol)) {
			return false;
		}
		if (!ALLOWED_DOMAIN_EXTENSIONS.some(extension => hostname.endsWith(extension))) {
			return false;
		}
		if (GITHUB_CLOUD.some(ghCloud => ghCloud === hostname)) {
			// TODO: Need to alert the users that this URL is GitHub cloud and not Enterprise
			// Waiting for design: https://softwareteams.atlassian.net/browse/ARC-1418
			return false;
		}

		return true;
	} catch (e) {
		return false;
	}
};

$("#gheServerURL").on("keyup", event => {
	const hasUrl = event.target.value.length > 0;
	$("#gheServerBtn").attr({
		"aria-disabled": !hasUrl,
		"disabled": !hasUrl
	});
	$("#gheServerURLError").hide();
	$("#gheServerURL").removeClass("has-error ");
});

$("#gheServerBtn").on("click", event => {
	const btn = event.target;
	const isValid = checkValidUrl($("#gheServerURL").val());

	$(btn).attr({
		"aria-disabled": !isValid,
		"disabled": !isValid
	});

	if (isValid) {
		$("#gheServerURLError").hide();
		$("#gheServerBtnText").hide();
		$("#gheServerBtnSpinner").show();
		$("#gheServerURL").removeClass("has-error ");

		//	TODO: Need to add the action
	} else {
		$("#gheServerURLError").show();
		$("#gheServerURL").addClass("has-error ");
	}
});
