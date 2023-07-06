import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollapsibleStep from "./index";

const DUMMY_STEP = "1";
const DUMMY_TITLE = "Collapsible Title";
const DUMMY_CONTENT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras eros velit, efficitur eget molestie sed, laoreet vitae lectus. Nullam varius, ipsum pharetra commodo viverra, ante leo finibus velit, nec pellentesque metus nulla sit amet nisl. Maecenas vel blandit lectus, ac venenatis tortor. Donec velit erat, hendrerit vestibulum auctor vitae, convallis vel neque. Cras malesuada enim imperdiet leo suscipit rhoncus. Vivamus commodo tincidunt leo, vel sodales nulla efficitur eget. Cras vulputate laoreet odio in consectetur. Proin consectetur fermentum magna, vehicula convallis lacus sollicitudin id. Nunc scelerisque risus eu volutpat mattis. In non tellus ac nibh semper fermentum. Praesent sed nisi tristique, iaculis enim a, iaculis urna. Aliquam ut felis sit amet sapien congue aliquet non a ipsum. Vivamus id turpis ornare, porttitor leo eu, tincidunt ligula. Curabitur nisl eros, congue in tellus ut, porta finibus turpis. Proin tempor diam eu nibh viverra, non tristique erat aliquet. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.";
const CONTENT_TEST_ID = "collapsible-content";

test("When it can not be expanded", async () => {
	render(
		<CollapsibleStep
			step={DUMMY_STEP}
			title={DUMMY_TITLE}
			canExpand={false}
			expanded={false}
		>
			<div>{DUMMY_CONTENT}</div>
		</CollapsibleStep>
	);

	expect(screen.queryByText(DUMMY_STEP)).toBeInTheDocument();
	expect(screen.queryByText(DUMMY_TITLE)).toBeInTheDocument();
	expect(screen.queryByTestId(CONTENT_TEST_ID)).not.toBeInTheDocument();

	await userEvent.click(screen.getByText("Collapsible Title"));
	expect(screen.queryByTestId(CONTENT_TEST_ID)).not.toBeInTheDocument();
});

test("When it can be expanded, but is not expanded", async () => {
	render(
		<CollapsibleStep
			step={DUMMY_STEP}
			title={DUMMY_TITLE}
			canExpand={true}
			expanded={false}
		>
			<div>{DUMMY_CONTENT}</div>
		</CollapsibleStep>
	);

	expect(screen.queryByText(DUMMY_STEP)).toBeInTheDocument();
	expect(screen.queryByText(DUMMY_TITLE)).toBeInTheDocument();
	expect(screen.queryByTestId(CONTENT_TEST_ID)).not.toBeInTheDocument();

	await userEvent.click(screen.getByText(DUMMY_TITLE));
	expect(screen.queryByTestId(CONTENT_TEST_ID)).toBeInTheDocument();
	expect(screen.getByTestId(CONTENT_TEST_ID)).toHaveTextContent(DUMMY_CONTENT);
});

test("When it can be expanded and is expanded", async () => {
	render(
		<CollapsibleStep
			step={DUMMY_STEP}
			title={DUMMY_TITLE}
			canExpand={true}
			expanded={true}
		>
			<div>{DUMMY_CONTENT}</div>
		</CollapsibleStep>
	);

	expect(screen.queryByText(DUMMY_STEP)).toBeInTheDocument();
	expect(screen.queryByText(DUMMY_TITLE)).toBeInTheDocument();
	expect(screen.queryByTestId(CONTENT_TEST_ID)).toBeInTheDocument();
	expect(screen.getByTestId(CONTENT_TEST_ID)).toHaveTextContent(DUMMY_CONTENT);

	await userEvent.click(screen.getByText(DUMMY_TITLE));
	expect(screen.queryByTestId(CONTENT_TEST_ID)).not.toBeInTheDocument();
});
