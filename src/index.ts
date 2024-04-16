import Differ, { DiffResult } from 'json-diff-kit/dist/differ';
import { codeToHtml } from 'shiki/bundle-web.mjs';

const differ = new Differ.default({
	detectCircular: true,
	maxDepth: Infinity,
	showModifications: true,
	arrayDiffMethod: 'lcs',
});

function mergeDiff(diff: readonly [DiffResult[], DiffResult[]]) {
	const items: DiffResult[] = [];

	const [d1, d2] = diff;

	for (let i = 0; i < d1.length; i++) {
		const di1 = d1[i]!;
		const di2 = d2[i]!;

		if (di1.type === 'equal' && di2.type === 'equal') {
			items.push(di1);
			continue;
		}

		switch (di1.type) {
			case 'modify':
			case 'remove':
				const comma = di1.comma || di2.type !== 'equal' || di1.text !== di2.text;
				items.push({ ...di1, text: `- ${di1.text}`, comma });
				break;
		}

		switch (di2.type) {
			case 'modify':
			case 'add':
				items.push({ ...di2, text: `+ ${di2.text}` });
				break;
		}
	}
	return items;
}

function buildJson(mergedDiff: DiffResult[]) {
	let json = '';
	for (const item of mergedDiff) {
		const indent = '  '.repeat(item.level);
		json += indent + item.text + (item.comma ? ',' : '') + '\n';
	}
	return json;
}

export async function diffGitJson(before: Record<string, any> | any[], after: Record<string, any> | any[]) {
	const diff = differ.diff(before, after);
	const mergedDiff = mergeDiff(diff);
	const json = buildJson(mergedDiff);

	const html = await codeToHtml(json, {
		lang: 'json',
		theme: 'github-dark-default',
	});
	return html;
}
