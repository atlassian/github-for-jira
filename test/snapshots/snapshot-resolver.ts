import path from "path";

const rootPath = process.cwd();
const srcPath = path.resolve(rootPath, "src");
const snapshotDirPath = path.resolve(rootPath, "test/snapshots/");

module.exports = {
	/**
	 * @param testPath Path of the test file being tested
	 * @param snapshotExtension The extension for snapshots (.snap usually)
	 */
	resolveSnapshotPath:(testPath: string, snapshotExtension: string) =>
		path.join(snapshotDirPath, testPath.replace(srcPath, "") + snapshotExtension),

	/**
	 * @param snapshotFilePath The filename of the snapshot (i.e. some.test.js.snap)
	 * @param snapshotExtension The extension for snapshots (.snap)
	 */
	resolveTestPath:(snapshotFilePath, snapshotExtension) =>
		snapshotFilePath
			.replace(snapshotDirPath, srcPath) // remove snapshot directory prepend
			.replace(snapshotExtension, ""), // Remove the .snap

	/* Used to validate resolveTestPath(resolveSnapshotPath( {this} )) */
	testPathForConsistencyCheck: path.resolve(rootPath, "src/foo/bar/some.test.ts")
};
