import AxiosInstance from "../../utils/axiosInstance";

const Token = {
	// TODO: create this endpoint
	checkValidity: () => AxiosInstance.get("rest/app/cloud/oauth/validation")
};

export default Token;
