import { codeToHtml, BundledTheme } from 'shiki/bundle-web.mjs';
import Differ, { DiffResult } from './Differ';
import merge from 'lodash.merge';

const differ = new Differ({
	detectCircular: true,
	maxDepth: Infinity,
	showModifications: true,
	arrayDiffMethod: 'lcs',
});

function mergeDiff(diff: readonly [DiffResult[], DiffResult[]], needComma: (i: number) => boolean) {
	const items: DiffResult[] = [];

	const [d1, d2] = diff;
	for (let i = 0; i < d1.length; i++) {
		const di1 = d1[i]!;
		const di2 = d2[i]!;

		if (di1.type === 'equal' && di2.type === 'equal') {
			const comma = needComma(i);
			items.push({ ...di1, comma });
			continue;
		}

		switch (di1.type) {
			case 'modify':
			case 'remove':
				const comma = needComma(i);
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

type Options = {
	theme: BundledTheme;
};

export function diff(before: Record<string, any> | any[], after: Record<string, any> | any[]) {
	const mergedPlain = merge(before, after);
	const diff = differ.diff(before, after);
	const [, mDiff] = differ.diff({}, mergedPlain);
	function needComma(i: number) {
		return mDiff[i]?.comma || false;
	}
	return mergeDiff(diff, needComma);
}

export function diffToJson(before: Record<string, any> | any[], after: Record<string, any> | any[]) {
	const mergedDiff = diff(before, after);
	return buildJson(mergedDiff);
}

export async function diffToHtml(before: Record<string, any> | any[], after: Record<string, any> | any[], options?: Options) {
	const json = diffToJson(before, after);

	const html = await codeToHtml(json, {
		lang: 'json',
		theme: options?.theme || 'github-dark-default',
	});

	return html;
}
