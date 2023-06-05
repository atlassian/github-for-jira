import { paginatedRepositories } from "utils/paginate-response";

const mockWorkspaces = [
	{
		id: "1",
		name: "workspace1",
		canCreateContainer: false
	},
	{
		id: "2",
		name: "workspace2",
		canCreateContainer: false
	},
	{
		id: "3",
		name: "workspace3",
		canCreateContainer: false
	},
	{
		id: "4",
		name: "workspace4",
		canCreateContainer: false
	},
	{
		id: "5",
		name: "workspace5",
		canCreateContainer: false
	},
	{
		id: "6",
		name: "workspace6",
		canCreateContainer: false
	},
	{
		id: "7",
		name: "workspace7",
		canCreateContainer: false
	}
];

describe("Paginate response data", () => {
	it("Should return the correct data when paginated", () => {
		expect(paginatedRepositories(1, 3, mockWorkspaces)).toEqual(mockWorkspaces.slice(0, 3)); // first 3 items in mockWorkspaces
		expect(paginatedRepositories(2, 3, mockWorkspaces)).toEqual(mockWorkspaces.slice(3, 6)); // second 3 items in mockWorkspaces
		expect(paginatedRepositories(3, 3, mockWorkspaces)).toEqual(mockWorkspaces.slice(6, 7)); // second 3 items in mockWorkspaces
		expect(paginatedRepositories(4, 3, mockWorkspaces)).toEqual([]);
	});
});
