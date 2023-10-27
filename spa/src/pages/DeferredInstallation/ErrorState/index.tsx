import { ErrorObjType } from "../../../utils/modifyError";
import ErrorUI from "../../../components/Error";
import Step from "../../../components/Step";

const ErrorState = ({ error }: { error: ErrorObjType}) => <>
	<ErrorUI type={error.type} message={error.message} />
	<Step title="Connect a GitHub organization to Jira software">
		<div>
			Please inform the person who sent you the link that the link<br/>
			has expired and send a new link.
		</div>
	</Step>
</>;

export default ErrorState;
