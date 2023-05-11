function initApiKeyValidation(apiKeyHeaderName, apiKeyHeaderValue, knownHttpHeadersLowerCase, onValidationFinished) {
	console.log("aaaaa");
	console.log(apiKeyHeaderName, apiKeyHeaderValue);
	console.log("bbbbb");

	AJS.formValidation.register([apiKeyHeaderName.auiTag], (field) => {
		const inputStr = field.el.value;
		if (inputStr.trim().length) {
			if (inputStr.trim().length > 1024) {
				field.invalidate(AJS.format('Max length is 1,024 characters.'));
			} else if (knownHttpHeadersLowerCase.indexOf(inputStr.trim().toLowerCase()) >= 0) {
				field.invalidate(AJS.format(inputStr.trim() + ' is a reserved string and cannot be used.'));
			} else {
				field.validate();
			}
		} else {
			field.validate();
		}
		AJS.formValidation.validate(apiKeyHeaderValue.elt);
	});

	AJS.formValidation.register([apiKeyHeaderValue.auiTag], (field) => {
		const inputStr = field.el.value;
		if (apiKeyHeaderName.elt.value.trim().length === 0) {
			if (inputStr.trim().length === 0) {
				field.validate();
			} else {
				field.invalidate(AJS.format('Cannot be used without HTTP header name.'));
			}
		} else if (inputStr.trim().length === 0) {
			field.invalidate(AJS.format('Cannot be empty.'));
		} else if (inputStr.trim().length > 8096) {
			field.invalidate(AJS.format('Max length is 8,096 characters.'));
		} else {
			field.validate();
		}
		if (onValidationFinished) {
			onValidationFinished();
		}
	});

}
