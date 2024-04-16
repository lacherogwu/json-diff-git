import { diff, diffToJson, diffToHtml } from '../src/index';

const before = { a: 1, b: 2, c: 3 };
const after = { a: 1, b: 3, d: 4 };

// const d = diff(before, after);
// console.log('🚀 → d:', d);

const json = diffToJson(before, after);
console.log('🚀 → json:', json);

// const html = await diffToHtml(before, after);
// console.log('🚀 → html:', html);
