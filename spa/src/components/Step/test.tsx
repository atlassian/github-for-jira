import { render, screen } from "@testing-library/react";
import Step from "./index";

const DUMMY_TITLE = "Collapsible Title";
const DUMMY_CONTENT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras eros velit, efficitur eget molestie sed, laoreet vitae lectus. Nullam varius, ipsum pharetra commodo viverra, ante leo finibus velit, nec pellentesque metus nulla sit amet nisl. Maecenas vel blandit lectus, ac venenatis tortor. Donec velit erat, hendrerit vestibulum auctor vitae, convallis vel neque. Cras malesuada enim imperdiet leo suscipit rhoncus. Vivamus commodo tincidunt leo, vel sodales nulla efficitur eget. Cras vulputate laoreet odio in consectetur. Proin consectetur fermentum magna, vehicula convallis lacus sollicitudin id. Nunc scelerisque risus eu volutpat mattis. In non tellus ac nibh semper fermentum. Praesent sed nisi tristique, iaculis enim a, iaculis urna. Aliquam ut felis sit amet sapien congue aliquet non a ipsum. Vivamus id turpis ornare, porttitor leo eu, tincidunt ligula. Curabitur nisl eros, congue in tellus ut, porta finibus turpis. Proin tempor diam eu nibh viverra, non tristique erat aliquet. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.";
const CONTENT_TEST_ID = "content";

test("When it can not be expanded", async () => {
	render(
		<Step title={DUMMY_TITLE}>
			<div>{DUMMY_CONTENT}</div>
		</Step>
	);

	expect(screen.queryByText(DUMMY_TITLE)).toBeInTheDocument();
	expect(screen.queryByTestId(CONTENT_TEST_ID)).toBeInTheDocument();
});
