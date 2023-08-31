import Avatar from "@atlaskit/avatar";
import styled from "@emotion/styled";
import { token } from "@atlaskit/tokens";

export const presidents = [
	{
		id: 1,
		name: "George Washington",
		party: "None, Federalist",
		term: "1789-1797",
	},
	{
		id: 2,
		name: "John Adams",
		party: "Federalist",
		term: "1797-1801",
	},
	{
		id: 3,
		name: "Thomas Jefferson",
		party: "Democratic-Republican",
		term: "1801-1809",
	},
	{
		id: 4,
		name: "James Madison",
		party: "Democratic-Republican",
		term: "1809-1817",
	},
];

interface President {
	id: number;
	name: string;
	party: string;
	term: string;
}


const NameWrapper = styled.span`
	display: flex;
	align-items: center;
`;

const AvatarWrapper = styled.span`
	marginright: ${token("space.200")};
`;

export const caption = "List of US Presidents";

export const createHead = (withWidth: boolean) => {
	return {
		cells: [
			{
				key: "name",
				content: "Name",
				width: withWidth ? 25 : undefined,
			},
			{
				key: "party",
				content: "Party",
				width: withWidth ? 25 : undefined,
			},
			{
				key: "term",
				content: "Term",
				width: withWidth ? 25 : undefined,
			},
			{
				key: "content",
				content: "Comment",
				width: withWidth ? 25 : undefined,
			}
		],
	};
};

export const head = createHead(true);

export const rows = presidents.map((president: President, index: number) => ({
	key: `row-${index}-${president.name}`,
	isHighlighted: false,
	cells: [
		{
			key: president.name,
			content: (
				<NameWrapper>
					<AvatarWrapper>
						<Avatar name={president.name} size="medium" />
					</AvatarWrapper>
					<a href="https://atlassian.design">{president.name}</a>
				</NameWrapper>
			),
		},
		{
			key: president.party,
			content: president.party,
		},
		{
			key: president.id,
			content: president.term,
		},
		{
			key: "Lorem",
			content: president.term,
		}
	],
}));
