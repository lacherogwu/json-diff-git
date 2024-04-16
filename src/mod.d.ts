declare module 'json-diff-kit/dist/differ' {
	const defaultExport: {
		default: typeof import('json-diff-kit').Differ;
	};
	export type DiffResult = import('json-diff-kit').DiffResult;
	export default defaultExport;
}
