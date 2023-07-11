import axios from "axios";

const Token = {
	getUserDetails: (token: string) => axios.get("https://api.github.com/user", {
		headers: { Authorization: `Bearer ${token}`}
	})
};

export default Token;
