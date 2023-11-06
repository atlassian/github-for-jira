import { useLocation } from "react-router-dom";
import { ErrorObjType } from "../../../utils/modifyError";
import ErrorUI from "../../../components/Error";
import Step from "../../../components/Step";
import { Wrapper } from "../../../common/Wrapper";
import SyncHeader from "../../../components/SyncHeader";

const ErrorState = () => {
	const location = useLocation();
	const { error }: { error: ErrorObjType } = location.state;

	return (<>
		<Wrapper hideClosedBtn={true}>
			<SyncHeader />
			<ErrorUI type={error.type} message={error.message}/>
			<Step title="Connect a GitHub organization to Jira software">
				<div>
					Please inform the person who sent you the link that the link <br/>
					has expired and send a new link.
				</div>
			</Step>
		</Wrapper>
	</>);
};

export default ErrorState;
