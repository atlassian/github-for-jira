import { useLocation } from "react-router-dom";

const DeferredInstallationConnected = () => {
	const { state } = useLocation();
	return <>
		{
			state.successfulConnection ? <>
				Success
			</> : <>
				Failure
			</>
		}
	</>;
};

export default DeferredInstallationConnected;
