import { FC, ReactNode } from "react";
import Avatar from "@atlaskit/avatar";

export const lorem = [
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"Suspendisse tincidunt vehicula eleifend.",
	"Nunc tristique nisi tortor, at pretium purus interdum sed.",
	"Sed vel augue sit amet sapien elementum bibendum. Aenean aliquam elementum dui, quis euismod metus ultrices ut.",
	"Curabitur est sapien, feugiat vel est eget, molestie suscipit nibh.",
	"Nunc libero orci, lacinia id orci aliquam, pharetra facilisis leo.",
	"Quisque et turpis nec lacus luctus ultrices quis vel nisi.",
	"Cras maximus ex lorem, sit amet bibendum nibh placerat eu.",
	"In hac habitasse platea dictumst. ",
	"Duis molestie sem vel ante varius, rhoncus pretium arcu dictum.",
];
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

function createKey(input: string) {
	return input ? input.replace(/^(the|a|an)/, "").replace(/\s/g, "") : input;
}

// const nameWrapperStyles = css({
//   display: 'flex',
//   alignItems: 'center',
// });

const NameWrapper: FC<{ children: ReactNode }> = ({ children }) => (
	<span>{children}</span>
);

// const avatarWrapperStyles = css({
//   marginRight: token('space.100', '8px'),
// });

const AvatarWrapper: FC<{ children: ReactNode }> = ({ children }) => (
	<div>{children}</div>
);

export const caption = "List of US Presidents";

export const createHead = (withWidth: boolean) => {
	return {
		cells: [
			{
				key: "name",
				content: "Name",
				isSortable: true,
				width: withWidth ? 25 : undefined,
			},
			{
				key: "party",
				content: "Party",
				shouldTruncate: true,
				isSortable: true,
				width: withWidth ? 15 : undefined,
			},
			{
				key: "term",
				content: "Term",
				shouldTruncate: true,
				isSortable: true,
				width: withWidth ? 10 : undefined,
			},
			{
				key: "content",
				content: "Comment",
				shouldTruncate: true,
			},
			{
				key: "more",
				shouldTruncate: true,
			},
		],
	};
};

export const head = createHead(true);

export const rows = presidents.map((president: President, index: number) => ({
	key: `row-${index}-${president.name}`,
	isHighlighted: false,
	cells: [
		{
			key: createKey(president.name),
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
			key: createKey(president.party),
			content: president.party,
		},
		{
			key: president.id,
			content: president.term,
		},
		{
			key: "Lorem",
			content: president.term,
		},
		{
			key: "MoreDropdown",
			content: president.term,
		},
	],
}));
