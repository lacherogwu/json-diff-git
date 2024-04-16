import { codeToHtml, BundledTheme } from 'shiki/bundle-web.mjs';
import Differ, { DiffResult } from './Differ';

const differ = new Differ({
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
				items.push({ ...di1, text: `- ${di1.text}` });
				break;
		}

		switch (di2.type) {
			case 'modify':
			case 'add':
				items.push({ ...di2, text: `+ ${di2.text}` });
				break;
		}
	}

	const modifiedItems: DiffResult[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i]!;
		const nextItem = items[i + 1];

		const comma = needComma(item.text, nextItem?.text);
		modifiedItems.push({ ...item, comma });
	}

	return modifiedItems;

	function needComma(text: string, nextText?: string) {
		if (text.startsWith('- ') || text.startsWith('+ ')) {
			text = text.slice(2);
		}
		if (nextText?.startsWith('- ') || nextText?.startsWith('+ ')) {
			nextText = nextText.slice(2);
		}
		if (text.endsWith('{') || text.endsWith('[')) return false;
		if (!nextText) return false;
		if (nextText === '}' || nextText === ']') return false;
		return true;
	}
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
	const diff = differ.diff(before, after);

	/* DEBUG */
	// const _merged = mergeDiff(diff);
	// const _json = buildJson(_merged);
	// console.log(_json);

	return mergeDiff(diff);
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
