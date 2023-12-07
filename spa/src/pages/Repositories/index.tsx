import Button from "@atlaskit/button";
import { Wrapper } from "../../common/Wrapper";
import ArrowLeftIcon from "@atlaskit/icon/glyph/arrow-left";
import { useNavigate } from "react-router-dom";
import PageHeader from "@atlaskit/page-header";
import { token } from "@atlaskit/tokens";
import { css } from "@emotion/react";
import Form, { Field } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";
import SearchIcon from "@atlaskit/icon/glyph/search";
import Select, { ValueType } from "@atlaskit/select";
import { Inline } from "@atlaskit/primitives";
import { DynamicTableStateless } from "@atlaskit/dynamic-table";

const Repositories = () => {
	const navigate = useNavigate();
	const titleStyle = css`
		margin: ${token("space.400")} ${token("space.0")} ${token("space.300")};
	`;

	interface Option {
		label: string;
		value: string;
	}

	return (
		<Wrapper>
			<PageHeader>
				<Button
					appearance="subtle"
					onClick={() => {
						navigate(-1);
					}}
					iconBefore={<ArrowLeftIcon label="more" size="medium" />}
				></Button>
			</PageHeader>
			<h2 css={titleStyle}>Connected repositories</h2>
			<Form onSubmit={(formData) => console.log("form data", formData)}>
				{({ formProps }) => (
					<form {...formProps} name="repository-search">
						<Inline>
							<Field name="repository-search-input" defaultValue="">
								{({ fieldProps }) => (
									<Textfield
										{...fieldProps}
										elemAfterInput={<SearchIcon label="" size="medium" />}
										placeholder="Search repositories"
									/>
								)}
							</Field>
							<Field<ValueType<Option>>
								name="status"
								defaultValue={{
									label: "All",
									value: "all",
								}}
							>
								{({ fieldProps: { id, ...rest } }) => (
									<Select<Option>
										inputId={id}
										options={[
											{ label: "All", value: "all" },
											{ label: "In Progress", value: "in progress" },
											{ label: "Failed", value: "failed" },
										]}
										isSearchable={false}
										{...rest}
									/>
								)}
							</Field>
						</Inline>
					</form>
				)}
			</Form>
		</Wrapper>
	);
};

export default Repositories;
