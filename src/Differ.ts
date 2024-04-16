// @ts-nocheck
import type { Differ as DifferT } from 'json-diff-kit';
export type { DiffResult } from 'json-diff-kit';

// Keep only the fields that are valid in JSON
const cleanFields = obj => {
	if (typeof obj === 'undefined' || obj === null || typeof obj === 'bigint' || Number.isNaN(obj) || obj === Infinity || obj === -Infinity) {
		return undefined;
	}
	if (['string', 'number', 'boolean'].includes(typeof obj)) {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(cleanFields).filter(t => typeof t !== 'undefined');
	}
	const result = {};
	for (const [key, value] of Object.entries(obj)) {
		const cleaned = cleanFields(value);
		if (typeof cleaned !== 'undefined') {
			result[key] = cleaned;
		}
	}
	return result;
};

/**
 * If we use `a.push(...b)`, it will result in `Maximum call stack size exceeded` error.
 * The reason is unclear, it may be a bug of V8, so we should implement a push method by ourselves.
 */ const concat = (a, b, prependEach = false) => {
	if (!Array.isArray(a) || !Array.isArray(b)) {
		throw new Error('Both arguments should be arrays.');
	}
	const lenA = a.length;
	const lenB = b.length;
	const len = lenA + lenB;
	const result = new Array(len);
	if (prependEach) {
		for (let i = 0; i < lenB; i++) {
			result[i] = b[lenB - i - 1];
		}
		for (let i = 0; i < lenA; i++) {
			result[i + lenB] = a[i];
		}
		return result;
	}
	for (let i = 0; i < lenA; i++) {
		result[i] = a[i];
	}
	for (let i = 0; i < lenB; i++) {
		result[i + lenA] = b[i];
	}
	return result;
};

const detectCircular = (value, map = new Map()) => {
	// primitive types should not be checked
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	// value has appeared
	if (map.has(value)) {
		return true;
	}
	map.set(value, true);
	// value is an array
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			if (detectCircular(value[i], map)) {
				return true;
			}
		}
		return false;
	}
	// value is an object
	for (const key in value) {
		if (detectCircular(value[key], map)) {
			return true;
		}
	}
	return false;
};

// https://gist.github.com/RexSkz/c4f78a6e143e9008f9c717623b7a2bc1
const stringify = (obj, replacer, space, depth = Infinity, undefinedBehavior) => {
	if (!obj || typeof obj !== 'object') {
		let result = undefined;
		if (!Number.isNaN(obj) && obj !== Infinity && obj !== -Infinity && typeof obj !== 'bigint') {
			result = JSON.stringify(obj, replacer, space);
		}
		if (result === undefined) {
			switch (undefinedBehavior) {
				case UndefinedBehavior.throw:
					throw new Error(`Value is not valid in JSON, got ${String(obj)}`);
				case UndefinedBehavior.stringify:
					return stringifyInvalidValue(obj);
				default:
					throw new Error(`Should not reach here, please report this bug.`);
			}
		}
		return result;
	}
	const t =
		depth < 1
			? '"..."'
			: Array.isArray(obj)
			? `[${obj.map(v => stringify(v, replacer, space, depth - 1, undefinedBehavior)).join(',')}]`
			: `{${Object.keys(obj)
					.map(k => `"${k}": ${stringify(obj[k], replacer, space, depth - 1, undefinedBehavior)}`)
					.join(', ')}}`;
	return JSON.stringify(JSON.parse(t), replacer, space);
};
const stringifyInvalidValue = value => {
	if (value === undefined) {
		return 'undefined';
	}
	if (value === Infinity) {
		return 'Infinity';
	}
	if (value === -Infinity) {
		return '-Infinity';
	}
	if (Number.isNaN(value)) {
		return 'NaN';
	}
	if (typeof value === 'bigint') {
		return `${value}n`;
	}
	return String(value);
};

const formatValue = (value, depth = Infinity, pretty = false, undefinedBehavior = UndefinedBehavior.stringify) => {
	if (value === null) {
		return 'null';
	}
	if (Array.isArray(value) || typeof value === 'object') {
		return stringify(value, undefined, pretty ? 1 : undefined, depth, undefinedBehavior);
	}
	return stringify(value, undefined, undefined, undefined, undefinedBehavior);
};

const getOrderByType = value => {
	if (typeof value === 'boolean') {
		return 0;
	}
	if (typeof value === 'number') {
		return 1;
	}
	if (typeof value === 'string') {
		return 2;
	}
	if (value === null) {
		return 3;
	}
	if (Array.isArray(value)) {
		return 4;
	}
	if (typeof value === 'object') {
		return 5;
	}
	if (typeof value === 'symbol') {
		return 6;
	}
	if (typeof value === 'function') {
		return 7;
	}
	if (typeof value === 'bigint') {
		return 8;
	}
	return -1;
};
/**
 * The compare function to correct the order for "array" or "object":
 * - The order for 2 values with different types are: boolean, number, string, null, array, object.
 * - The order for 2 values with the same type is according to the type:
 *   - For boolean, number, string: use the `<` sign.
 *   - For array and object: preserve the original order (or do we have a better idea?)
 */ const cmp = (a, b, options) => {
	var _options_keyOrdersMap, _options_keyOrdersMap1;
	const orderByMapA = (_options_keyOrdersMap = options.keyOrdersMap) == null ? void 0 : _options_keyOrdersMap.get(a);
	const orderByMapB = (_options_keyOrdersMap1 = options.keyOrdersMap) == null ? void 0 : _options_keyOrdersMap1.get(b);
	if (orderByMapA !== undefined && orderByMapB !== undefined) {
		return orderByMapA - orderByMapB;
	}
	const orderByTypeA = getOrderByType(a);
	const orderByTypeB = getOrderByType(b);
	if (orderByTypeA !== orderByTypeB) {
		return orderByTypeA - orderByTypeB;
	}
	if ((a === null && b === null) || (Array.isArray(a) && Array.isArray(b)) || (orderByTypeA === 5 && orderByTypeB === 5)) {
		return 0;
	}
	switch (typeof a) {
		case 'number':
			if ((Number.isNaN(a) && Number.isNaN(b)) || (a === Infinity && b === Infinity) || (a === -Infinity && b === -Infinity)) {
				return 0;
			}
			return a - b;
		case 'string':
			if (options.ignoreCase) {
				a = a.toLowerCase();
				b = b.toLowerCase();
			}
			return a < b ? -1 : a > b ? 1 : 0;
		case 'boolean':
			return +a - +b;
		case 'symbol':
		case 'function':
			return String(a).localeCompare(String(b));
	}
	if (typeof a === 'bigint' && typeof b === 'bigint') {
		const result = BigInt(a) - BigInt(b);
		return result < 0 ? -1 : result > 0 ? 1 : 0;
	}
	return String(a).localeCompare(String(b));
};

const getType = value => {
	if (Array.isArray(value)) {
		return 'array';
	}
	if (value === null) {
		return 'null';
	}
	return typeof value;
};

const prettyAppendLines = (linesLeft, linesRight, keyLeft, keyRight, valueLeft, valueRight, level, options) => {
	const valueCmpOptions = {
		ignoreCase: options.ignoreCase,
	};
	const _resultLeft = formatValue(valueLeft, options.maxDepth, true, options.undefinedBehavior).split('\n');
	const _resultRight = formatValue(valueRight, options.maxDepth, true, options.undefinedBehavior).split('\n');
	if (cmp(valueLeft, valueRight, valueCmpOptions) !== 0) {
		if (options.showModifications) {
			const maxLines = Math.max(_resultLeft.length, _resultRight.length);
			for (let i = _resultLeft.length; i < maxLines; i++) {
				_resultLeft.push('');
			}
			for (let i = _resultRight.length; i < maxLines; i++) {
				_resultRight.push('');
			}
			linesLeft.push({
				level,
				type: 'modify',
				text: keyLeft ? `"${keyLeft}": ${_resultLeft[0]}` : _resultLeft[0],
			});
			for (let i = 1; i < _resultLeft.length; i++) {
				var _resultLeft_i_match, _resultLeft_i_match_;
				linesLeft.push({
					level: level + (((_resultLeft_i_match = _resultLeft[i].match(/^\s+/)) == null ? void 0 : (_resultLeft_i_match_ = _resultLeft_i_match[0]) == null ? void 0 : _resultLeft_i_match_.length) || 0),
					type: 'modify',
					text: _resultLeft[i].replace(/^\s+/, '').replace(/,$/g, ''),
				});
			}
			for (let i = _resultLeft.length; i < maxLines; i++) {
				linesLeft.push({
					level,
					type: 'equal',
					text: '',
				});
			}
			linesRight.push({
				level,
				type: 'modify',
				text: keyRight ? `"${keyRight}": ${_resultRight[0]}` : _resultRight[0],
			});
			for (let i = 1; i < _resultRight.length; i++) {
				var _resultRight_i_match, _resultRight_i_match_;
				linesRight.push({
					level: level + (((_resultRight_i_match = _resultRight[i].match(/^\s+/)) == null ? void 0 : (_resultRight_i_match_ = _resultRight_i_match[0]) == null ? void 0 : _resultRight_i_match_.length) || 0),
					type: 'modify',
					text: _resultRight[i].replace(/^\s+/, '').replace(/,$/g, ''),
				});
			}
			for (let i = _resultRight.length; i < maxLines; i++) {
				linesRight.push({
					level,
					type: 'equal',
					text: '',
				});
			}
		} else {
			linesLeft.push({
				level,
				type: 'remove',
				text: keyLeft ? `"${keyLeft}": ${_resultLeft[0]}` : _resultLeft[0],
			});
			for (let i = 1; i < _resultLeft.length; i++) {
				var _resultLeft_i_match1, _resultLeft_i_match_1;
				linesLeft.push({
					level: level + (((_resultLeft_i_match1 = _resultLeft[i].match(/^\s+/)) == null ? void 0 : (_resultLeft_i_match_1 = _resultLeft_i_match1[0]) == null ? void 0 : _resultLeft_i_match_1.length) || 0),
					type: 'remove',
					text: _resultLeft[i].replace(/^\s+/, '').replace(/,$/g, ''),
				});
			}
			for (let i = 0; i < _resultRight.length; i++) {
				linesLeft.push({
					level,
					type: 'equal',
					text: '',
				});
			}
			for (let i = 0; i < _resultLeft.length; i++) {
				linesRight.push({
					level,
					type: 'equal',
					text: '',
				});
			}
			linesRight.push({
				level,
				type: 'add',
				text: keyRight ? `"${keyRight}": ${_resultRight[0]}` : _resultRight[0],
			});
			for (let i = 1; i < _resultRight.length; i++) {
				var _resultRight_i_match1, _resultRight_i_match_1;
				linesRight.push({
					level: level + (((_resultRight_i_match1 = _resultRight[i].match(/^\s+/)) == null ? void 0 : (_resultRight_i_match_1 = _resultRight_i_match1[0]) == null ? void 0 : _resultRight_i_match_1.length) || 0),
					type: 'add',
					text: _resultRight[i].replace(/^\s+/, '').replace(/,$/g, ''),
				});
			}
		}
	} else {
		const maxLines = Math.max(_resultLeft.length, _resultRight.length);
		for (let i = _resultLeft.length; i < maxLines; i++) {
			_resultLeft.push('');
		}
		for (let i = _resultRight.length; i < maxLines; i++) {
			_resultRight.push('');
		}
		linesLeft.push({
			level,
			type: 'equal',
			text: keyLeft ? `"${keyLeft}": ${_resultLeft[0]}` : _resultLeft[0],
		});
		for (let i = 1; i < _resultLeft.length; i++) {
			var _resultLeft_i_match2, _resultLeft_i_match_2;
			linesLeft.push({
				level: level + (((_resultLeft_i_match2 = _resultLeft[i].match(/^\s+/)) == null ? void 0 : (_resultLeft_i_match_2 = _resultLeft_i_match2[0]) == null ? void 0 : _resultLeft_i_match_2.length) || 0),
				type: 'equal',
				text: _resultLeft[i].replace(/^\s+/, '').replace(/,$/g, ''),
			});
		}
		linesRight.push({
			level,
			type: 'equal',
			text: keyRight ? `"${keyRight}": ${_resultRight[0]}` : _resultRight[0],
		});
		for (let i = 1; i < _resultRight.length; i++) {
			var _resultRight_i_match2, _resultRight_i_match_2;
			linesRight.push({
				level: level + (((_resultRight_i_match2 = _resultRight[i].match(/^\s+/)) == null ? void 0 : (_resultRight_i_match_2 = _resultRight_i_match2[0]) == null ? void 0 : _resultRight_i_match_2.length) || 0),
				type: 'equal',
				text: _resultRight[i].replace(/^\s+/, '').replace(/,$/g, ''),
			});
		}
	}
};

const sortKeys = (arr, options) => {
	return arr.sort((a, b) =>
		cmp(a, b, {
			ignoreCase: options.ignoreCaseForKey,
		}),
	);
};

const diffObject = (lhs, rhs, level = 1, options, arrayDiffFunc) => {
	if (level > (options.maxDepth || Infinity)) {
		return [
			[
				{
					level,
					type: 'equal',
					text: '...',
				},
			],
			[
				{
					level,
					type: 'equal',
					text: '...',
				},
			],
		];
	}
	let linesLeft = [];
	let linesRight = [];
	if ((lhs === null && rhs === null) || (lhs === undefined && rhs === undefined)) {
		return [linesLeft, linesRight];
	} else if (lhs === null || lhs === undefined) {
		const addedLines = stringify(rhs, undefined, 1, undefined, options.undefinedBehavior).split('\n');
		for (let i = 0; i < addedLines.length; i++) {
			var _addedLines_i_match, _addedLines_i_match_;
			linesLeft.push({
				level,
				type: 'equal',
				text: '',
			});
			linesRight.push({
				level: level + (((_addedLines_i_match = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_ = _addedLines_i_match[0]) == null ? void 0 : _addedLines_i_match_.length) || 0),
				type: 'add',
				text: addedLines[i].replace(/^\s+/, '').replace(/,$/g, ''),
			});
		}
		return [linesLeft, linesRight];
	} else if (rhs === null || rhs === undefined) {
		const addedLines = stringify(lhs, undefined, 1, undefined, options.undefinedBehavior).split('\n');
		for (let i = 0; i < addedLines.length; i++) {
			var _addedLines_i_match1, _addedLines_i_match_1;
			linesLeft.push({
				level: level + (((_addedLines_i_match1 = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_1 = _addedLines_i_match1[0]) == null ? void 0 : _addedLines_i_match_1.length) || 0),
				type: 'remove',
				text: addedLines[i].replace(/^\s+/, '').replace(/,$/g, ''),
			});
			linesRight.push({
				level,
				type: 'equal',
				text: '',
			});
		}
		return [linesLeft, linesRight];
	}
	const keysLeft = Object.keys(lhs);
	const keysRight = Object.keys(rhs);
	const keyOrdersMap = new Map();
	if (!options.preserveKeyOrder) {
		sortKeys(keysLeft, options);
		sortKeys(keysRight, options);
	} else if (options.preserveKeyOrder === 'before') {
		for (let i = 0; i < keysLeft.length; i++) {
			keyOrdersMap.set(keysLeft[i], i);
		}
		for (let i = 0; i < keysRight.length; i++) {
			if (!keyOrdersMap.has(keysRight[i])) {
				keyOrdersMap.set(keysRight[i], keysLeft.length + i);
			}
		}
		keysRight.sort((a, b) => keyOrdersMap.get(a) - keyOrdersMap.get(b));
	} else if (options.preserveKeyOrder === 'after') {
		for (let i = 0; i < keysRight.length; i++) {
			keyOrdersMap.set(keysRight[i], i);
		}
		for (let i = 0; i < keysLeft.length; i++) {
			if (!keyOrdersMap.has(keysLeft[i])) {
				keyOrdersMap.set(keysLeft[i], keysRight.length + i);
			}
		}
		keysLeft.sort((a, b) => keyOrdersMap.get(a) - keyOrdersMap.get(b));
	}
	const keysCmpOptions = {
		ignoreCase: options.ignoreCaseForKey,
		keyOrdersMap,
	};
	while (keysLeft.length || keysRight.length) {
		const keyLeft = keysLeft[0];
		const keyRight = keysRight[0];
		const keyCmpResult = cmp(keyLeft, keyRight, keysCmpOptions);
		if (keyCmpResult === 0) {
			if (getType(lhs[keyLeft]) !== getType(rhs[keyRight])) {
				prettyAppendLines(linesLeft, linesRight, keyLeft, keyRight, lhs[keyLeft], rhs[keyRight], level, options);
			} else if (Array.isArray(lhs[keyLeft])) {
				const arrLeft = [...lhs[keyLeft]];
				const arrRight = [...rhs[keyRight]];
				const [resLeft, resRight] = arrayDiffFunc(arrLeft, arrRight, keyLeft, keyRight, level, options, [], []);
				linesLeft = concat(linesLeft, resLeft);
				linesRight = concat(linesRight, resRight);
			} else if (lhs[keyLeft] === null) {
				linesLeft.push({
					level,
					type: 'equal',
					text: `"${keyLeft}": null`,
				});
				linesRight.push({
					level,
					type: 'equal',
					text: `"${keyRight}": null`,
				});
			} else if (typeof lhs[keyLeft] === 'object') {
				const result = diffObject(lhs[keyLeft], rhs[keyRight], level + 1, options, arrayDiffFunc);
				linesLeft.push({
					level,
					type: 'equal',
					text: `"${keyLeft}": {`,
				});
				linesLeft = concat(linesLeft, result[0]);
				linesLeft.push({
					level,
					type: 'equal',
					text: '}',
				});
				linesRight.push({
					level,
					type: 'equal',
					text: `"${keyRight}": {`,
				});
				linesRight = concat(linesRight, result[1]);
				linesRight.push({
					level,
					type: 'equal',
					text: '}',
				});
			} else {
				prettyAppendLines(linesLeft, linesRight, keyLeft, keyRight, lhs[keyLeft], rhs[keyRight], level, options);
			}
		} else if (keysLeft.length && keysRight.length) {
			if (keyCmpResult < 0) {
				const addedLines = stringify(lhs[keyLeft], undefined, 1, undefined, options.undefinedBehavior).split('\n');
				for (let i = 0; i < addedLines.length; i++) {
					var _addedLines_i_match2, _addedLines_i_match_2;
					const text = addedLines[i].replace(/^\s+/, '').replace(/,$/g, '');
					linesLeft.push({
						level: level + (((_addedLines_i_match2 = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_2 = _addedLines_i_match2[0]) == null ? void 0 : _addedLines_i_match_2.length) || 0),
						type: 'remove',
						text: i ? text : `"${keyLeft}": ${text}`,
					});
					linesRight.push({
						level,
						type: 'equal',
						text: '',
					});
				}
			} else {
				const addedLines = stringify(rhs[keyRight], undefined, 1, undefined, options.undefinedBehavior).split('\n');
				for (let i = 0; i < addedLines.length; i++) {
					var _addedLines_i_match3, _addedLines_i_match_3;
					const text = addedLines[i].replace(/^\s+/, '').replace(/,$/g, '');
					linesLeft.push({
						level,
						type: 'equal',
						text: '',
					});
					linesRight.push({
						level: level + (((_addedLines_i_match3 = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_3 = _addedLines_i_match3[0]) == null ? void 0 : _addedLines_i_match_3.length) || 0),
						type: 'add',
						text: i ? text : `"${keyRight}": ${text}`,
					});
				}
			}
		} else if (keysLeft.length) {
			const addedLines = stringify(lhs[keyLeft], undefined, 1, undefined, options.undefinedBehavior).split('\n');
			for (let i = 0; i < addedLines.length; i++) {
				var _addedLines_i_match4, _addedLines_i_match_4;
				const text = addedLines[i].replace(/^\s+/, '').replace(/,$/g, '');
				linesLeft.push({
					level: level + (((_addedLines_i_match4 = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_4 = _addedLines_i_match4[0]) == null ? void 0 : _addedLines_i_match_4.length) || 0),
					type: 'remove',
					text: i ? text : `"${keyLeft}": ${text}`,
				});
				linesRight.push({
					level,
					type: 'equal',
					text: '',
				});
			}
		} else if (keysRight.length) {
			const addedLines = stringify(rhs[keyRight], undefined, 1, undefined, options.undefinedBehavior).split('\n');
			for (let i = 0; i < addedLines.length; i++) {
				var _addedLines_i_match5, _addedLines_i_match_5;
				const text = addedLines[i].replace(/^\s+/, '').replace(/,$/g, '');
				linesLeft.push({
					level,
					type: 'equal',
					text: '',
				});
				linesRight.push({
					level: level + (((_addedLines_i_match5 = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_5 = _addedLines_i_match5[0]) == null ? void 0 : _addedLines_i_match_5.length) || 0),
					type: 'add',
					text: i ? text : `"${keyRight}": ${text}`,
				});
			}
		}
		if (!keyLeft) {
			keysRight.shift();
		} else if (!keyRight) {
			keysLeft.shift();
		} else if (keyCmpResult === 0) {
			keysLeft.shift();
			keysRight.shift();
		} else if (keyCmpResult < 0) {
			keysLeft.shift();
		} else {
			keysRight.shift();
		}
	}
	if (linesLeft.length !== linesRight.length) {
		throw new Error('Diff error: length not match for left & right, please report a bug with your data.');
	}
	return [linesLeft, linesRight];
};

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */ function listCacheClear$1() {
	this.__data__ = [];
	this.size = 0;
}
var _listCacheClear = listCacheClear$1;

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */ function eq$2(value, other) {
	return value === other || (value !== value && other !== other);
}
var eq_1 = eq$2;

var eq$1 = eq_1;
/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */ function assocIndexOf$4(array, key) {
	var length = array.length;
	while (length--) {
		if (eq$1(array[length][0], key)) {
			return length;
		}
	}
	return -1;
}
var _assocIndexOf = assocIndexOf$4;

var assocIndexOf$3 = _assocIndexOf;
/** Used for built-in method references. */ var arrayProto = Array.prototype;
/** Built-in value references. */ var splice = arrayProto.splice;
/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */ function listCacheDelete$1(key) {
	var data = this.__data__,
		index = assocIndexOf$3(data, key);
	if (index < 0) {
		return false;
	}
	var lastIndex = data.length - 1;
	if (index == lastIndex) {
		data.pop();
	} else {
		splice.call(data, index, 1);
	}
	--this.size;
	return true;
}
var _listCacheDelete = listCacheDelete$1;

var assocIndexOf$2 = _assocIndexOf;
/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */ function listCacheGet$1(key) {
	var data = this.__data__,
		index = assocIndexOf$2(data, key);
	return index < 0 ? undefined : data[index][1];
}
var _listCacheGet = listCacheGet$1;

var assocIndexOf$1 = _assocIndexOf;
/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */ function listCacheHas$1(key) {
	return assocIndexOf$1(this.__data__, key) > -1;
}
var _listCacheHas = listCacheHas$1;

var assocIndexOf = _assocIndexOf;
/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */ function listCacheSet$1(key, value) {
	var data = this.__data__,
		index = assocIndexOf(data, key);
	if (index < 0) {
		++this.size;
		data.push([key, value]);
	} else {
		data[index][1] = value;
	}
	return this;
}
var _listCacheSet = listCacheSet$1;

var listCacheClear = _listCacheClear,
	listCacheDelete = _listCacheDelete,
	listCacheGet = _listCacheGet,
	listCacheHas = _listCacheHas,
	listCacheSet = _listCacheSet;
/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */ function ListCache$4(entries) {
	var index = -1,
		length = entries == null ? 0 : entries.length;
	this.clear();
	while (++index < length) {
		var entry = entries[index];
		this.set(entry[0], entry[1]);
	}
}
// Add methods to `ListCache`.
ListCache$4.prototype.clear = listCacheClear;
ListCache$4.prototype['delete'] = listCacheDelete;
ListCache$4.prototype.get = listCacheGet;
ListCache$4.prototype.has = listCacheHas;
ListCache$4.prototype.set = listCacheSet;
var _ListCache = ListCache$4;

var ListCache$3 = _ListCache;
/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */ function stackClear$1() {
	this.__data__ = new ListCache$3();
	this.size = 0;
}
var _stackClear = stackClear$1;

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */ function stackDelete$1(key) {
	var data = this.__data__,
		result = data['delete'](key);
	this.size = data.size;
	return result;
}
var _stackDelete = stackDelete$1;

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */ function stackGet$1(key) {
	return this.__data__.get(key);
}
var _stackGet = stackGet$1;

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */ function stackHas$1(key) {
	return this.__data__.has(key);
}
var _stackHas = stackHas$1;

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var freeGlobal$1 = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;
var _freeGlobal = freeGlobal$1;

var freeGlobal = _freeGlobal;
/** Detect free variable `self`. */ var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
/** Used as a reference to the global object. */ var root$8 = freeGlobal || freeSelf || Function('return this')();
var _root = root$8;

var root$7 = _root;
/** Built-in value references. */ var Symbol$3 = root$7.Symbol;
var _Symbol = Symbol$3;

var Symbol$2 = _Symbol;
/** Used for built-in method references. */ var objectProto$b = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$8 = objectProto$b.hasOwnProperty;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */ var nativeObjectToString$1 = objectProto$b.toString;
/** Built-in value references. */ var symToStringTag$1 = Symbol$2 ? Symbol$2.toStringTag : undefined;
/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */ function getRawTag$1(value) {
	var isOwn = hasOwnProperty$8.call(value, symToStringTag$1),
		tag = value[symToStringTag$1];
	try {
		value[symToStringTag$1] = undefined;
		var unmasked = true;
	} catch (e) {}
	var result = nativeObjectToString$1.call(value);
	if (unmasked) {
		if (isOwn) {
			value[symToStringTag$1] = tag;
		} else {
			delete value[symToStringTag$1];
		}
	}
	return result;
}
var _getRawTag = getRawTag$1;

/** Used for built-in method references. */ var objectProto$a = Object.prototype;
/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */ var nativeObjectToString = objectProto$a.toString;
/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */ function objectToString$1(value) {
	return nativeObjectToString.call(value);
}
var _objectToString = objectToString$1;

var Symbol$1 = _Symbol,
	getRawTag = _getRawTag,
	objectToString = _objectToString;
/** `Object#toString` result references. */ var nullTag = '[object Null]',
	undefinedTag = '[object Undefined]';
/** Built-in value references. */ var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;
/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */ function baseGetTag$4(value) {
	if (value == null) {
		return value === undefined ? undefinedTag : nullTag;
	}
	return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
}
var _baseGetTag = baseGetTag$4;

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */ function isObject$2(value) {
	var type = typeof value;
	return value != null && (type == 'object' || type == 'function');
}
var isObject_1 = isObject$2;

var baseGetTag$3 = _baseGetTag,
	isObject$1 = isObject_1;
/** `Object#toString` result references. */ var asyncTag = '[object AsyncFunction]',
	funcTag$1 = '[object Function]',
	genTag = '[object GeneratorFunction]',
	proxyTag = '[object Proxy]';
/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */ function isFunction$2(value) {
	if (!isObject$1(value)) {
		return false;
	}
	// The use of `Object#toString` avoids issues with the `typeof` operator
	// in Safari 9 which returns 'object' for typed arrays and other constructors.
	var tag = baseGetTag$3(value);
	return tag == funcTag$1 || tag == genTag || tag == asyncTag || tag == proxyTag;
}
var isFunction_1 = isFunction$2;

var root$6 = _root;
/** Used to detect overreaching core-js shims. */ var coreJsData$1 = root$6['__core-js_shared__'];
var _coreJsData = coreJsData$1;

var coreJsData = _coreJsData;
/** Used to detect methods masquerading as native. */ var maskSrcKey = (function () {
	var uid = /[^.]+$/.exec((coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO) || '');
	return uid ? 'Symbol(src)_1.' + uid : '';
})();
/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */ function isMasked$1(func) {
	return !!maskSrcKey && maskSrcKey in func;
}
var _isMasked = isMasked$1;

/** Used for built-in method references. */ var funcProto$1 = Function.prototype;
/** Used to resolve the decompiled source of functions. */ var funcToString$1 = funcProto$1.toString;
/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */ function toSource$2(func) {
	if (func != null) {
		try {
			return funcToString$1.call(func);
		} catch (e) {}
		try {
			return func + '';
		} catch (e) {}
	}
	return '';
}
var _toSource = toSource$2;

var isFunction$1 = isFunction_1,
	isMasked = _isMasked,
	isObject = isObject_1,
	toSource$1 = _toSource;
/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */ var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
/** Used to detect host constructors (Safari). */ var reIsHostCtor = /^\[object .+?Constructor\]$/;
/** Used for built-in method references. */ var funcProto = Function.prototype,
	objectProto$9 = Object.prototype;
/** Used to resolve the decompiled source of functions. */ var funcToString = funcProto.toString;
/** Used to check objects for own properties. */ var hasOwnProperty$7 = objectProto$9.hasOwnProperty;
/** Used to detect if a method is native. */ var reIsNative = RegExp(
	'^' +
		funcToString
			.call(hasOwnProperty$7)
			.replace(reRegExpChar, '\\$&')
			.replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') +
		'$',
);
/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */ function baseIsNative$1(value) {
	if (!isObject(value) || isMasked(value)) {
		return false;
	}
	var pattern = isFunction$1(value) ? reIsNative : reIsHostCtor;
	return pattern.test(toSource$1(value));
}
var _baseIsNative = baseIsNative$1;

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */ function getValue$1(object, key) {
	return object == null ? undefined : object[key];
}
var _getValue = getValue$1;

var baseIsNative = _baseIsNative,
	getValue = _getValue;
/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */ function getNative$6(object, key) {
	var value = getValue(object, key);
	return baseIsNative(value) ? value : undefined;
}
var _getNative = getNative$6;

var getNative$5 = _getNative,
	root$5 = _root;
/* Built-in method references that are verified to be native. */ var Map$4 = getNative$5(root$5, 'Map');
var _Map = Map$4;

var getNative$4 = _getNative;
/* Built-in method references that are verified to be native. */ var nativeCreate$4 = getNative$4(Object, 'create');
var _nativeCreate = nativeCreate$4;

var nativeCreate$3 = _nativeCreate;
/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */ function hashClear$1() {
	this.__data__ = nativeCreate$3 ? nativeCreate$3(null) : {};
	this.size = 0;
}
var _hashClear = hashClear$1;

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */ function hashDelete$1(key) {
	var result = this.has(key) && delete this.__data__[key];
	this.size -= result ? 1 : 0;
	return result;
}
var _hashDelete = hashDelete$1;

var nativeCreate$2 = _nativeCreate;
/** Used to stand-in for `undefined` hash values. */ var HASH_UNDEFINED$2 = '__lodash_hash_undefined__';
/** Used for built-in method references. */ var objectProto$8 = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$6 = objectProto$8.hasOwnProperty;
/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */ function hashGet$1(key) {
	var data = this.__data__;
	if (nativeCreate$2) {
		var result = data[key];
		return result === HASH_UNDEFINED$2 ? undefined : result;
	}
	return hasOwnProperty$6.call(data, key) ? data[key] : undefined;
}
var _hashGet = hashGet$1;

var nativeCreate$1 = _nativeCreate;
/** Used for built-in method references. */ var objectProto$7 = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$5 = objectProto$7.hasOwnProperty;
/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */ function hashHas$1(key) {
	var data = this.__data__;
	return nativeCreate$1 ? data[key] !== undefined : hasOwnProperty$5.call(data, key);
}
var _hashHas = hashHas$1;

var nativeCreate = _nativeCreate;
/** Used to stand-in for `undefined` hash values. */ var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';
/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */ function hashSet$1(key, value) {
	var data = this.__data__;
	this.size += this.has(key) ? 0 : 1;
	data[key] = nativeCreate && value === undefined ? HASH_UNDEFINED$1 : value;
	return this;
}
var _hashSet = hashSet$1;

var hashClear = _hashClear,
	hashDelete = _hashDelete,
	hashGet = _hashGet,
	hashHas = _hashHas,
	hashSet = _hashSet;
/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */ function Hash$1(entries) {
	var index = -1,
		length = entries == null ? 0 : entries.length;
	this.clear();
	while (++index < length) {
		var entry = entries[index];
		this.set(entry[0], entry[1]);
	}
}
// Add methods to `Hash`.
Hash$1.prototype.clear = hashClear;
Hash$1.prototype['delete'] = hashDelete;
Hash$1.prototype.get = hashGet;
Hash$1.prototype.has = hashHas;
Hash$1.prototype.set = hashSet;
var _Hash = Hash$1;

var Hash = _Hash,
	ListCache$2 = _ListCache,
	Map$3 = _Map;
/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */ function mapCacheClear$1() {
	this.size = 0;
	this.__data__ = {
		hash: new Hash(),
		map: new (Map$3 || ListCache$2)(),
		string: new Hash(),
	};
}
var _mapCacheClear = mapCacheClear$1;

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */ function isKeyable$1(value) {
	var type = typeof value;
	return type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean' ? value !== '__proto__' : value === null;
}
var _isKeyable = isKeyable$1;

var isKeyable = _isKeyable;
/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */ function getMapData$4(map, key) {
	var data = map.__data__;
	return isKeyable(key) ? data[typeof key == 'string' ? 'string' : 'hash'] : data.map;
}
var _getMapData = getMapData$4;

var getMapData$3 = _getMapData;
/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */ function mapCacheDelete$1(key) {
	var result = getMapData$3(this, key)['delete'](key);
	this.size -= result ? 1 : 0;
	return result;
}
var _mapCacheDelete = mapCacheDelete$1;

var getMapData$2 = _getMapData;
/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */ function mapCacheGet$1(key) {
	return getMapData$2(this, key).get(key);
}
var _mapCacheGet = mapCacheGet$1;

var getMapData$1 = _getMapData;
/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */ function mapCacheHas$1(key) {
	return getMapData$1(this, key).has(key);
}
var _mapCacheHas = mapCacheHas$1;

var getMapData = _getMapData;
/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */ function mapCacheSet$1(key, value) {
	var data = getMapData(this, key),
		size = data.size;
	data.set(key, value);
	this.size += data.size == size ? 0 : 1;
	return this;
}
var _mapCacheSet = mapCacheSet$1;

var mapCacheClear = _mapCacheClear,
	mapCacheDelete = _mapCacheDelete,
	mapCacheGet = _mapCacheGet,
	mapCacheHas = _mapCacheHas,
	mapCacheSet = _mapCacheSet;
/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */ function MapCache$2(entries) {
	var index = -1,
		length = entries == null ? 0 : entries.length;
	this.clear();
	while (++index < length) {
		var entry = entries[index];
		this.set(entry[0], entry[1]);
	}
}
// Add methods to `MapCache`.
MapCache$2.prototype.clear = mapCacheClear;
MapCache$2.prototype['delete'] = mapCacheDelete;
MapCache$2.prototype.get = mapCacheGet;
MapCache$2.prototype.has = mapCacheHas;
MapCache$2.prototype.set = mapCacheSet;
var _MapCache = MapCache$2;

var ListCache$1 = _ListCache,
	Map$2 = _Map,
	MapCache$1 = _MapCache;
/** Used as the size to enable large array optimizations. */ var LARGE_ARRAY_SIZE = 200;
/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */ function stackSet$1(key, value) {
	var data = this.__data__;
	if (data instanceof ListCache$1) {
		var pairs = data.__data__;
		if (!Map$2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
			pairs.push([key, value]);
			this.size = ++data.size;
			return this;
		}
		data = this.__data__ = new MapCache$1(pairs);
	}
	data.set(key, value);
	this.size = data.size;
	return this;
}
var _stackSet = stackSet$1;

var ListCache = _ListCache,
	stackClear = _stackClear,
	stackDelete = _stackDelete,
	stackGet = _stackGet,
	stackHas = _stackHas,
	stackSet = _stackSet;
/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */ function Stack$1(entries) {
	var data = (this.__data__ = new ListCache(entries));
	this.size = data.size;
}
// Add methods to `Stack`.
Stack$1.prototype.clear = stackClear;
Stack$1.prototype['delete'] = stackDelete;
Stack$1.prototype.get = stackGet;
Stack$1.prototype.has = stackHas;
Stack$1.prototype.set = stackSet;
var _Stack = Stack$1;

/** Used to stand-in for `undefined` hash values. */ var HASH_UNDEFINED = '__lodash_hash_undefined__';
/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */ function setCacheAdd$1(value) {
	this.__data__.set(value, HASH_UNDEFINED);
	return this;
}
var _setCacheAdd = setCacheAdd$1;

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */ function setCacheHas$1(value) {
	return this.__data__.has(value);
}
var _setCacheHas = setCacheHas$1;

var MapCache = _MapCache,
	setCacheAdd = _setCacheAdd,
	setCacheHas = _setCacheHas;
/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */ function SetCache$1(values) {
	var index = -1,
		length = values == null ? 0 : values.length;
	this.__data__ = new MapCache();
	while (++index < length) {
		this.add(values[index]);
	}
}
// Add methods to `SetCache`.
SetCache$1.prototype.add = SetCache$1.prototype.push = setCacheAdd;
SetCache$1.prototype.has = setCacheHas;
var _SetCache = SetCache$1;

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */ function arraySome$1(array, predicate) {
	var index = -1,
		length = array == null ? 0 : array.length;
	while (++index < length) {
		if (predicate(array[index], index, array)) {
			return true;
		}
	}
	return false;
}
var _arraySome = arraySome$1;

/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */ function cacheHas$1(cache, key) {
	return cache.has(key);
}
var _cacheHas = cacheHas$1;

var SetCache = _SetCache,
	arraySome = _arraySome,
	cacheHas = _cacheHas;
/** Used to compose bitmasks for value comparisons. */ var COMPARE_PARTIAL_FLAG$3 = 1,
	COMPARE_UNORDERED_FLAG$1 = 2;
/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */ function equalArrays$2(array, other, bitmask, customizer, equalFunc, stack) {
	var isPartial = bitmask & COMPARE_PARTIAL_FLAG$3,
		arrLength = array.length,
		othLength = other.length;
	if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
		return false;
	}
	// Check that cyclic values are equal.
	var arrStacked = stack.get(array);
	var othStacked = stack.get(other);
	if (arrStacked && othStacked) {
		return arrStacked == other && othStacked == array;
	}
	var index = -1,
		result = true,
		seen = bitmask & COMPARE_UNORDERED_FLAG$1 ? new SetCache() : undefined;
	stack.set(array, other);
	stack.set(other, array);
	// Ignore non-index properties.
	while (++index < arrLength) {
		var arrValue = array[index],
			othValue = other[index];
		if (customizer) {
			var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
		}
		if (compared !== undefined) {
			if (compared) {
				continue;
			}
			result = false;
			break;
		}
		// Recursively compare arrays (susceptible to call stack limits).
		if (seen) {
			if (
				!arraySome(other, function (othValue, othIndex) {
					if (!cacheHas(seen, othIndex) && (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
						return seen.push(othIndex);
					}
				})
			) {
				result = false;
				break;
			}
		} else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
			result = false;
			break;
		}
	}
	stack['delete'](array);
	stack['delete'](other);
	return result;
}
var _equalArrays = equalArrays$2;

var root$4 = _root;
/** Built-in value references. */ var Uint8Array$1 = root$4.Uint8Array;
var _Uint8Array = Uint8Array$1;

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */ function mapToArray$1(map) {
	var index = -1,
		result = Array(map.size);
	map.forEach(function (value, key) {
		result[++index] = [key, value];
	});
	return result;
}
var _mapToArray = mapToArray$1;

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */ function setToArray$1(set) {
	var index = -1,
		result = Array(set.size);
	set.forEach(function (value) {
		result[++index] = value;
	});
	return result;
}
var _setToArray = setToArray$1;

var Symbol = _Symbol,
	Uint8Array = _Uint8Array,
	eq = eq_1,
	equalArrays$1 = _equalArrays,
	mapToArray = _mapToArray,
	setToArray = _setToArray;
/** Used to compose bitmasks for value comparisons. */ var COMPARE_PARTIAL_FLAG$2 = 1,
	COMPARE_UNORDERED_FLAG = 2;
/** `Object#toString` result references. */ var boolTag$1 = '[object Boolean]',
	dateTag$1 = '[object Date]',
	errorTag$1 = '[object Error]',
	mapTag$2 = '[object Map]',
	numberTag$1 = '[object Number]',
	regexpTag$1 = '[object RegExp]',
	setTag$2 = '[object Set]',
	stringTag$1 = '[object String]',
	symbolTag = '[object Symbol]';
var arrayBufferTag$1 = '[object ArrayBuffer]',
	dataViewTag$2 = '[object DataView]';
/** Used to convert symbols to primitives and strings. */ var symbolProto = Symbol ? Symbol.prototype : undefined,
	symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */ function equalByTag$1(object, other, tag, bitmask, customizer, equalFunc, stack) {
	switch (tag) {
		case dataViewTag$2:
			if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
				return false;
			}
			object = object.buffer;
			other = other.buffer;
		case arrayBufferTag$1:
			if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
				return false;
			}
			return true;
		case boolTag$1:
		case dateTag$1:
		case numberTag$1:
			// Coerce booleans to `1` or `0` and dates to milliseconds.
			// Invalid dates are coerced to `NaN`.
			return eq(+object, +other);
		case errorTag$1:
			return object.name == other.name && object.message == other.message;
		case regexpTag$1:
		case stringTag$1:
			// Coerce regexes to strings and treat strings, primitives and objects,
			// as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
			// for more details.
			return object == other + '';
		case mapTag$2:
			var convert = mapToArray;
		case setTag$2:
			var isPartial = bitmask & COMPARE_PARTIAL_FLAG$2;
			convert || (convert = setToArray);
			if (object.size != other.size && !isPartial) {
				return false;
			}
			// Assume cyclic values are equal.
			var stacked = stack.get(object);
			if (stacked) {
				return stacked == other;
			}
			bitmask |= COMPARE_UNORDERED_FLAG;
			// Recursively compare objects (susceptible to call stack limits).
			stack.set(object, other);
			var result = equalArrays$1(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
			stack['delete'](object);
			return result;
		case symbolTag:
			if (symbolValueOf) {
				return symbolValueOf.call(object) == symbolValueOf.call(other);
			}
	}
	return false;
}
var _equalByTag = equalByTag$1;

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */ function arrayPush$1(array, values) {
	var index = -1,
		length = values.length,
		offset = array.length;
	while (++index < length) {
		array[offset + index] = values[index];
	}
	return array;
}
var _arrayPush = arrayPush$1;

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */ var isArray$3 = Array.isArray;
var isArray_1 = isArray$3;

var arrayPush = _arrayPush,
	isArray$2 = isArray_1;
/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */ function baseGetAllKeys$1(object, keysFunc, symbolsFunc) {
	var result = keysFunc(object);
	return isArray$2(object) ? result : arrayPush(result, symbolsFunc(object));
}
var _baseGetAllKeys = baseGetAllKeys$1;

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */ function arrayFilter$1(array, predicate) {
	var index = -1,
		length = array == null ? 0 : array.length,
		resIndex = 0,
		result = [];
	while (++index < length) {
		var value = array[index];
		if (predicate(value, index, array)) {
			result[resIndex++] = value;
		}
	}
	return result;
}
var _arrayFilter = arrayFilter$1;

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */ function stubArray$1() {
	return [];
}
var stubArray_1 = stubArray$1;

var arrayFilter = _arrayFilter,
	stubArray = stubArray_1;
/** Used for built-in method references. */ var objectProto$6 = Object.prototype;
/** Built-in value references. */ var propertyIsEnumerable$1 = objectProto$6.propertyIsEnumerable;
/* Built-in method references for those with the same name as other `lodash` methods. */ var nativeGetSymbols = Object.getOwnPropertySymbols;
/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */ var getSymbols$1 = !nativeGetSymbols
	? stubArray
	: function (object) {
			if (object == null) {
				return [];
			}
			object = Object(object);
			return arrayFilter(nativeGetSymbols(object), function (symbol) {
				return propertyIsEnumerable$1.call(object, symbol);
			});
	  };
var _getSymbols = getSymbols$1;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */ function baseTimes$1(n, iteratee) {
	var index = -1,
		result = Array(n);
	while (++index < n) {
		result[index] = iteratee(index);
	}
	return result;
}
var _baseTimes = baseTimes$1;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */ function isObjectLike$4(value) {
	return value != null && typeof value == 'object';
}
var isObjectLike_1 = isObjectLike$4;

var baseGetTag$2 = _baseGetTag,
	isObjectLike$3 = isObjectLike_1;
/** `Object#toString` result references. */ var argsTag$2 = '[object Arguments]';
/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */ function baseIsArguments$1(value) {
	return isObjectLike$3(value) && baseGetTag$2(value) == argsTag$2;
}
var _baseIsArguments = baseIsArguments$1;

var baseIsArguments = _baseIsArguments,
	isObjectLike$2 = isObjectLike_1;
/** Used for built-in method references. */ var objectProto$5 = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$4 = objectProto$5.hasOwnProperty;
/** Built-in value references. */ var propertyIsEnumerable = objectProto$5.propertyIsEnumerable;
/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */ var isArguments$1 = baseIsArguments(
	(function () {
		return arguments;
	})(),
)
	? baseIsArguments
	: function (value) {
			return isObjectLike$2(value) && hasOwnProperty$4.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
	  };
var isArguments_1 = isArguments$1;

var isBuffer$2 = { exports: {} };

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */ function stubFalse() {
	return false;
}
var stubFalse_1 = stubFalse;

(function (module, exports) {
	var root = _root,
		stubFalse = stubFalse_1;
	/** Detect free variable `exports`. */ var freeExports = exports && !exports.nodeType && exports;
	/** Detect free variable `module`. */ var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;
	/** Detect the popular CommonJS extension `module.exports`. */ var moduleExports = freeModule && freeModule.exports === freeExports;
	/** Built-in value references. */ var Buffer = moduleExports ? root.Buffer : undefined;
	/* Built-in method references for those with the same name as other `lodash` methods. */ var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;
	/**
	 * Checks if `value` is a buffer.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.3.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	 * @example
	 *
	 * _.isBuffer(new Buffer(2));
	 * // => true
	 *
	 * _.isBuffer(new Uint8Array(2));
	 * // => false
	 */ var isBuffer = nativeIsBuffer || stubFalse;
	module.exports = isBuffer;
})(isBuffer$2, isBuffer$2.exports);

/** Used as references for various `Number` constants. */ var MAX_SAFE_INTEGER$1 = 9007199254740991;
/** Used to detect unsigned integer values. */ var reIsUint = /^(?:0|[1-9]\d*)$/;
/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */ function isIndex$1(value, length) {
	var type = typeof value;
	length = length == null ? MAX_SAFE_INTEGER$1 : length;
	return !!length && (type == 'number' || (type != 'symbol' && reIsUint.test(value))) && value > -1 && value % 1 == 0 && value < length;
}
var _isIndex = isIndex$1;

/** Used as references for various `Number` constants. */ var MAX_SAFE_INTEGER = 9007199254740991;
/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */ function isLength$2(value) {
	return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}
var isLength_1 = isLength$2;

var baseGetTag$1 = _baseGetTag,
	isLength$1 = isLength_1,
	isObjectLike$1 = isObjectLike_1;
/** `Object#toString` result references. */ var argsTag$1 = '[object Arguments]',
	arrayTag$1 = '[object Array]',
	boolTag = '[object Boolean]',
	dateTag = '[object Date]',
	errorTag = '[object Error]',
	funcTag = '[object Function]',
	mapTag$1 = '[object Map]',
	numberTag = '[object Number]',
	objectTag$2 = '[object Object]',
	regexpTag = '[object RegExp]',
	setTag$1 = '[object Set]',
	stringTag = '[object String]',
	weakMapTag$1 = '[object WeakMap]';
var arrayBufferTag = '[object ArrayBuffer]',
	dataViewTag$1 = '[object DataView]',
	float32Tag = '[object Float32Array]',
	float64Tag = '[object Float64Array]',
	int8Tag = '[object Int8Array]',
	int16Tag = '[object Int16Array]',
	int32Tag = '[object Int32Array]',
	uint8Tag = '[object Uint8Array]',
	uint8ClampedTag = '[object Uint8ClampedArray]',
	uint16Tag = '[object Uint16Array]',
	uint32Tag = '[object Uint32Array]';
/** Used to identify `toStringTag` values of typed arrays. */ var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag$1] =
	typedArrayTags[arrayTag$1] =
	typedArrayTags[arrayBufferTag] =
	typedArrayTags[boolTag] =
	typedArrayTags[dataViewTag$1] =
	typedArrayTags[dateTag] =
	typedArrayTags[errorTag] =
	typedArrayTags[funcTag] =
	typedArrayTags[mapTag$1] =
	typedArrayTags[numberTag] =
	typedArrayTags[objectTag$2] =
	typedArrayTags[regexpTag] =
	typedArrayTags[setTag$1] =
	typedArrayTags[stringTag] =
	typedArrayTags[weakMapTag$1] =
		false;
/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */ function baseIsTypedArray$1(value) {
	return isObjectLike$1(value) && isLength$1(value.length) && !!typedArrayTags[baseGetTag$1(value)];
}
var _baseIsTypedArray = baseIsTypedArray$1;

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */ function baseUnary$1(func) {
	return function (value) {
		return func(value);
	};
}
var _baseUnary = baseUnary$1;

var _nodeUtil = { exports: {} };

(function (module, exports) {
	var freeGlobal = _freeGlobal;
	/** Detect free variable `exports`. */ var freeExports = exports && !exports.nodeType && exports;
	/** Detect free variable `module`. */ var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;
	/** Detect the popular CommonJS extension `module.exports`. */ var moduleExports = freeModule && freeModule.exports === freeExports;
	/** Detect free variable `process` from Node.js. */ var freeProcess = moduleExports && freeGlobal.process;
	/** Used to access faster Node.js helpers. */ var nodeUtil = (function () {
		try {
			// Use `util.types` for Node.js 10+.
			var types = freeModule && freeModule.require && freeModule.require('util').types;
			if (types) {
				return types;
			}
			// Legacy `process.binding('util')` for Node.js < 10.
			return freeProcess && freeProcess.binding && freeProcess.binding('util');
		} catch (e) {}
	})();
	module.exports = nodeUtil;
})(_nodeUtil, _nodeUtil.exports);

var baseIsTypedArray = _baseIsTypedArray,
	baseUnary = _baseUnary,
	nodeUtil = _nodeUtil.exports;
/* Node.js helper references. */ var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */ var isTypedArray$2 = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
var isTypedArray_1 = isTypedArray$2;

var baseTimes = _baseTimes,
	isArguments = isArguments_1,
	isArray$1 = isArray_1,
	isBuffer$1 = isBuffer$2.exports,
	isIndex = _isIndex,
	isTypedArray$1 = isTypedArray_1;
/** Used for built-in method references. */ var objectProto$4 = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$3 = objectProto$4.hasOwnProperty;
/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */ function arrayLikeKeys$1(value, inherited) {
	var isArr = isArray$1(value),
		isArg = !isArr && isArguments(value),
		isBuff = !isArr && !isArg && isBuffer$1(value),
		isType = !isArr && !isArg && !isBuff && isTypedArray$1(value),
		skipIndexes = isArr || isArg || isBuff || isType,
		result = skipIndexes ? baseTimes(value.length, String) : [],
		length = result.length;
	for (var key in value) {
		if (
			(inherited || hasOwnProperty$3.call(value, key)) &&
			!(
				skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
				(key == 'length' || // Node.js 0.10 has enumerable non-index properties on buffers.
					(isBuff && (key == 'offset' || key == 'parent')) || // PhantomJS 2 has enumerable non-index properties on typed arrays.
					(isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) || // Skip index properties.
					isIndex(key, length))
			)
		) {
			result.push(key);
		}
	}
	return result;
}
var _arrayLikeKeys = arrayLikeKeys$1;

/** Used for built-in method references. */ var objectProto$3 = Object.prototype;
/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */ function isPrototype$1(value) {
	var Ctor = value && value.constructor,
		proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$3;
	return value === proto;
}
var _isPrototype = isPrototype$1;

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */ function overArg$1(func, transform) {
	return function (arg) {
		return func(transform(arg));
	};
}
var _overArg = overArg$1;

var overArg = _overArg;
/* Built-in method references for those with the same name as other `lodash` methods. */ var nativeKeys$1 = overArg(Object.keys, Object);
var _nativeKeys = nativeKeys$1;

var isPrototype = _isPrototype,
	nativeKeys = _nativeKeys;
/** Used for built-in method references. */ var objectProto$2 = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$2 = objectProto$2.hasOwnProperty;
/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */ function baseKeys$1(object) {
	if (!isPrototype(object)) {
		return nativeKeys(object);
	}
	var result = [];
	for (var key in Object(object)) {
		if (hasOwnProperty$2.call(object, key) && key != 'constructor') {
			result.push(key);
		}
	}
	return result;
}
var _baseKeys = baseKeys$1;

var isFunction = isFunction_1,
	isLength = isLength_1;
/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */ function isArrayLike$1(value) {
	return value != null && isLength(value.length) && !isFunction(value);
}
var isArrayLike_1 = isArrayLike$1;

var arrayLikeKeys = _arrayLikeKeys,
	baseKeys = _baseKeys,
	isArrayLike = isArrayLike_1;
/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */ function keys$1(object) {
	return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}
var keys_1 = keys$1;

var baseGetAllKeys = _baseGetAllKeys,
	getSymbols = _getSymbols,
	keys = keys_1;
/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */ function getAllKeys$1(object) {
	return baseGetAllKeys(object, keys, getSymbols);
}
var _getAllKeys = getAllKeys$1;

var getAllKeys = _getAllKeys;
/** Used to compose bitmasks for value comparisons. */ var COMPARE_PARTIAL_FLAG$1 = 1;
/** Used for built-in method references. */ var objectProto$1 = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty$1 = objectProto$1.hasOwnProperty;
/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */ function equalObjects$1(object, other, bitmask, customizer, equalFunc, stack) {
	var isPartial = bitmask & COMPARE_PARTIAL_FLAG$1,
		objProps = getAllKeys(object),
		objLength = objProps.length,
		othProps = getAllKeys(other),
		othLength = othProps.length;
	if (objLength != othLength && !isPartial) {
		return false;
	}
	var index = objLength;
	while (index--) {
		var key = objProps[index];
		if (!(isPartial ? key in other : hasOwnProperty$1.call(other, key))) {
			return false;
		}
	}
	// Check that cyclic values are equal.
	var objStacked = stack.get(object);
	var othStacked = stack.get(other);
	if (objStacked && othStacked) {
		return objStacked == other && othStacked == object;
	}
	var result = true;
	stack.set(object, other);
	stack.set(other, object);
	var skipCtor = isPartial;
	while (++index < objLength) {
		key = objProps[index];
		var objValue = object[key],
			othValue = other[key];
		if (customizer) {
			var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
		}
		// Recursively compare objects (susceptible to call stack limits).
		if (!(compared === undefined ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
			result = false;
			break;
		}
		skipCtor || (skipCtor = key == 'constructor');
	}
	if (result && !skipCtor) {
		var objCtor = object.constructor,
			othCtor = other.constructor;
		// Non `Object` object instances with different constructors are not equal.
		if (objCtor != othCtor && 'constructor' in object && 'constructor' in other && !(typeof objCtor == 'function' && objCtor instanceof objCtor && typeof othCtor == 'function' && othCtor instanceof othCtor)) {
			result = false;
		}
	}
	stack['delete'](object);
	stack['delete'](other);
	return result;
}
var _equalObjects = equalObjects$1;

var getNative$3 = _getNative,
	root$3 = _root;
/* Built-in method references that are verified to be native. */ var DataView$1 = getNative$3(root$3, 'DataView');
var _DataView = DataView$1;

var getNative$2 = _getNative,
	root$2 = _root;
/* Built-in method references that are verified to be native. */ var Promise$2 = getNative$2(root$2, 'Promise');
var _Promise = Promise$2;

var getNative$1 = _getNative,
	root$1 = _root;
/* Built-in method references that are verified to be native. */ var Set$2 = getNative$1(root$1, 'Set');
var _Set = Set$2;

var getNative = _getNative,
	root = _root;
/* Built-in method references that are verified to be native. */ var WeakMap$1 = getNative(root, 'WeakMap');
var _WeakMap = WeakMap$1;

var DataView = _DataView,
	Map$1 = _Map,
	Promise$1 = _Promise,
	Set$1 = _Set,
	WeakMap = _WeakMap,
	baseGetTag = _baseGetTag,
	toSource = _toSource;
/** `Object#toString` result references. */ var mapTag = '[object Map]',
	objectTag$1 = '[object Object]',
	promiseTag = '[object Promise]',
	setTag = '[object Set]',
	weakMapTag = '[object WeakMap]';
var dataViewTag = '[object DataView]';
/** Used to detect maps, sets, and weakmaps. */ var dataViewCtorString = toSource(DataView),
	mapCtorString = toSource(Map$1),
	promiseCtorString = toSource(Promise$1),
	setCtorString = toSource(Set$1),
	weakMapCtorString = toSource(WeakMap);
/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */ var getTag$1 = baseGetTag;
// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if (
	(DataView && getTag$1(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
	(Map$1 && getTag$1(new Map$1()) != mapTag) ||
	(Promise$1 && getTag$1(Promise$1.resolve()) != promiseTag) ||
	(Set$1 && getTag$1(new Set$1()) != setTag) ||
	(WeakMap && getTag$1(new WeakMap()) != weakMapTag)
) {
	getTag$1 = function (value) {
		var result = baseGetTag(value),
			Ctor = result == objectTag$1 ? value.constructor : undefined,
			ctorString = Ctor ? toSource(Ctor) : '';
		if (ctorString) {
			switch (ctorString) {
				case dataViewCtorString:
					return dataViewTag;
				case mapCtorString:
					return mapTag;
				case promiseCtorString:
					return promiseTag;
				case setCtorString:
					return setTag;
				case weakMapCtorString:
					return weakMapTag;
			}
		}
		return result;
	};
}
var _getTag = getTag$1;

var Stack = _Stack,
	equalArrays = _equalArrays,
	equalByTag = _equalByTag,
	equalObjects = _equalObjects,
	getTag = _getTag,
	isArray = isArray_1,
	isBuffer = isBuffer$2.exports,
	isTypedArray = isTypedArray_1;
/** Used to compose bitmasks for value comparisons. */ var COMPARE_PARTIAL_FLAG = 1;
/** `Object#toString` result references. */ var argsTag = '[object Arguments]',
	arrayTag = '[object Array]',
	objectTag = '[object Object]';
/** Used for built-in method references. */ var objectProto = Object.prototype;
/** Used to check objects for own properties. */ var hasOwnProperty = objectProto.hasOwnProperty;
/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */ function baseIsEqualDeep$1(object, other, bitmask, customizer, equalFunc, stack) {
	var objIsArr = isArray(object),
		othIsArr = isArray(other),
		objTag = objIsArr ? arrayTag : getTag(object),
		othTag = othIsArr ? arrayTag : getTag(other);
	objTag = objTag == argsTag ? objectTag : objTag;
	othTag = othTag == argsTag ? objectTag : othTag;
	var objIsObj = objTag == objectTag,
		othIsObj = othTag == objectTag,
		isSameTag = objTag == othTag;
	if (isSameTag && isBuffer(object)) {
		if (!isBuffer(other)) {
			return false;
		}
		objIsArr = true;
		objIsObj = false;
	}
	if (isSameTag && !objIsObj) {
		stack || (stack = new Stack());
		return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
	}
	if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
		var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
			othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');
		if (objIsWrapped || othIsWrapped) {
			var objUnwrapped = objIsWrapped ? object.value() : object,
				othUnwrapped = othIsWrapped ? other.value() : other;
			stack || (stack = new Stack());
			return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
		}
	}
	if (!isSameTag) {
		return false;
	}
	stack || (stack = new Stack());
	return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}
var _baseIsEqualDeep = baseIsEqualDeep$1;

var baseIsEqualDeep = _baseIsEqualDeep,
	isObjectLike = isObjectLike_1;
/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */ function baseIsEqual$1(value, other, bitmask, customizer, stack) {
	if (value === other) {
		return true;
	}
	if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
		return value !== value && other !== other;
	}
	return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual$1, stack);
}
var _baseIsEqual = baseIsEqual$1;

var baseIsEqual = _baseIsEqual;
/**
 * This method is like `_.isEqual` except that it accepts `customizer` which
 * is invoked to compare values. If `customizer` returns `undefined`, comparisons
 * are handled by the method instead. The `customizer` is invoked with up to
 * six arguments: (objValue, othValue [, index|key, object, other, stack]).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * function isGreeting(value) {
 *   return /^h(?:i|ello)$/.test(value);
 * }
 *
 * function customizer(objValue, othValue) {
 *   if (isGreeting(objValue) && isGreeting(othValue)) {
 *     return true;
 *   }
 * }
 *
 * var array = ['hello', 'goodbye'];
 * var other = ['hi', 'goodbye'];
 *
 * _.isEqualWith(array, other, customizer);
 * // => true
 */ function isEqualWith(value, other, customizer) {
	customizer = typeof customizer == 'function' ? customizer : undefined;
	var result = customizer ? customizer(value, other) : undefined;
	return result === undefined ? baseIsEqual(value, other, undefined, customizer) : !!result;
}
var isEqualWith_1 = isEqualWith;

const isEqual = (a, b, options) => {
	if (options.ignoreCase) {
		return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
	}
	if (typeof a === 'symbol' && typeof b === 'symbol') {
		return a.toString() === b.toString();
	}
	if (options.recursiveEqual) {
		return isEqualWith_1(a, b, (a, b) => (options.ignoreCase ? (typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : undefined) : undefined));
	}
	return a === b;
};

const shallowSimilarity = (left, right) => {
	if (left === right) {
		return 1;
	}
	if (left === null || right === null) {
		return 0;
	}
	if (typeof left !== 'object' || typeof right !== 'object') {
		return 0;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	const leftKeysLength = leftKeys.length;
	const rightKeysLength = rightKeys.length;
	if (leftKeysLength === 0 || rightKeysLength === 0) {
		return 0;
	}
	const leftKeysSet = new Set(leftKeys);
	const rightKeysSet = new Set(rightKeys);
	const intersection = new Set([...leftKeysSet].filter(x => rightKeysSet.has(x)));
	if (intersection.size === 0) {
		return 0;
	}
	if (intersection.size === 1 && (leftKeysLength === 1 || rightKeysLength === 1) && left[leftKeys[0]] !== right[rightKeys[0]]) {
		return 0;
	}
	return Math.max(intersection.size / leftKeysLength, intersection.size / rightKeysLength);
};

const lcs = (arrLeft, arrRight, keyLeft, keyRight, level, options) => {
	const f = Array(arrLeft.length + 1)
		.fill(0)
		.map(() => Array(arrRight.length + 1).fill(0));
	const backtrack = Array(arrLeft.length + 1)
		.fill(0)
		.map(() => Array(arrRight.length + 1).fill(0));
	for (let i = 1; i <= arrLeft.length; i++) {
		backtrack[i][0] = 'up';
	}
	for (let j = 1; j <= arrRight.length; j++) {
		backtrack[0][j] = 'left';
	}
	for (let i = 1; i <= arrLeft.length; i++) {
		for (let j = 1; j <= arrRight.length; j++) {
			const typeI = getType(arrLeft[i - 1]);
			const typeJ = getType(arrRight[j - 1]);
			if (typeI === typeJ && (typeI === 'array' || typeI === 'object')) {
				if (options.recursiveEqual) {
					if (isEqual(arrLeft[i - 1], arrRight[j - 1], options) || shallowSimilarity(arrLeft[i - 1], arrRight[j - 1]) > 0.5) {
						f[i][j] = f[i - 1][j - 1] + 1;
						backtrack[i][j] = 'diag';
					} else if (f[i - 1][j] >= f[i][j - 1]) {
						f[i][j] = f[i - 1][j];
						backtrack[i][j] = 'up';
					} else {
						f[i][j] = f[i][j - 1];
						backtrack[i][j] = 'left';
					}
				} else {
					// this is a diff-specific logic, when 2 values are both arrays or both objects, the
					// algorithm should assume they are equal in order to diff recursively later
					f[i][j] = f[i - 1][j - 1] + 1;
					backtrack[i][j] = 'diag';
				}
			} else if (isEqual(arrLeft[i - 1], arrRight[j - 1], options)) {
				f[i][j] = f[i - 1][j - 1] + 1;
				backtrack[i][j] = 'diag';
			} else if (f[i - 1][j] >= f[i][j - 1]) {
				f[i][j] = f[i - 1][j];
				backtrack[i][j] = 'up';
			} else {
				f[i][j] = f[i][j - 1];
				backtrack[i][j] = 'left';
			}
		}
	}
	let i = arrLeft.length;
	let j = arrRight.length;
	let tLeft = [];
	let tRight = [];
	// this is a backtracking process, all new lines should be unshifted to the result, not
	// pushed to the result
	while (i > 0 || j > 0) {
		if (backtrack[i][j] === 'diag') {
			const type = getType(arrLeft[i - 1]);
			if (options.recursiveEqual && (type === 'array' || type === 'object') && isEqual(arrLeft[i - 1], arrRight[j - 1], options)) {
				const reversedLeft = [];
				const reversedRight = [];
				prettyAppendLines(reversedLeft, reversedRight, '', '', arrLeft[i - 1], arrRight[j - 1], level + 1, options);
				tLeft = concat(tLeft, reversedLeft.reverse(), true);
				tRight = concat(tRight, reversedRight.reverse(), true);
			} else if (type === 'array') {
				const [l, r] = diffArrayLCS(arrLeft[i - 1], arrRight[j - 1], keyLeft, keyRight, level + 1, options);
				tLeft = concat(tLeft, l.reverse(), true);
				tRight = concat(tRight, r.reverse(), true);
			} else if (type === 'object') {
				const [l, r] = diffObject(arrLeft[i - 1], arrRight[j - 1], level + 2, options, diffArrayLCS);
				tLeft.unshift({
					level: level + 1,
					type: 'equal',
					text: '}',
				});
				tRight.unshift({
					level: level + 1,
					type: 'equal',
					text: '}',
				});
				tLeft = concat(tLeft, l.reverse(), true);
				tRight = concat(tRight, r.reverse(), true);
				tLeft.unshift({
					level: level + 1,
					type: 'equal',
					text: '{',
				});
				tRight.unshift({
					level: level + 1,
					type: 'equal',
					text: '{',
				});
			} else {
				const reversedLeft = [];
				const reversedRight = [];
				prettyAppendLines(reversedLeft, reversedRight, '', '', arrLeft[i - 1], arrRight[j - 1], level + 1, options);
				tLeft = concat(tLeft, reversedLeft.reverse(), true);
				tRight = concat(tRight, reversedRight.reverse(), true);
			}
			i--;
			j--;
		} else if (backtrack[i][j] === 'up') {
			if (options.showModifications && i > 1 && backtrack[i - 1][j] === 'left') {
				const typeLeft = getType(arrLeft[i - 1]);
				const typeRight = getType(arrRight[j - 1]);
				if (typeLeft === typeRight) {
					if (typeLeft === 'array') {
						const [l, r] = diffArrayLCS(arrLeft[i - 1], arrRight[j - 1], keyLeft, keyRight, level + 1, options);
						tLeft = concat(tLeft, l.reverse(), true);
						tRight = concat(tRight, r.reverse(), true);
					} else if (typeLeft === 'object') {
						const [l, r] = diffObject(arrLeft[i - 1], arrRight[j - 1], level + 2, options, diffArrayLCS);
						tLeft.unshift({
							level: level + 1,
							type: 'equal',
							text: '}',
						});
						tRight.unshift({
							level: level + 1,
							type: 'equal',
							text: '}',
						});
						tLeft = concat(tLeft, l.reverse(), true);
						tRight = concat(tRight, r.reverse(), true);
						tLeft.unshift({
							level: level + 1,
							type: 'equal',
							text: '{',
						});
						tRight.unshift({
							level: level + 1,
							type: 'equal',
							text: '{',
						});
					} else {
						tLeft.unshift({
							level: level + 1,
							type: 'modify',
							text: formatValue(arrLeft[i - 1], undefined, undefined, options.undefinedBehavior),
						});
						tRight.unshift({
							level: level + 1,
							type: 'modify',
							text: formatValue(arrRight[j - 1], undefined, undefined, options.undefinedBehavior),
						});
					}
				} else {
					const reversedLeft = [];
					const reversedRight = [];
					prettyAppendLines(reversedLeft, reversedRight, '', '', arrLeft[i - 1], arrRight[j - 1], level + 1, options);
					tLeft = concat(tLeft, reversedLeft.reverse(), true);
					tRight = concat(tRight, reversedRight.reverse(), true);
				}
				i--;
				j--;
			} else {
				const removedLines = stringify(arrLeft[i - 1], undefined, 1, undefined, options.undefinedBehavior).split('\n');
				for (let i = removedLines.length - 1; i >= 0; i--) {
					var _removedLines_i_match, _removedLines_i_match_;
					tLeft.unshift({
						level: level + 1 + (((_removedLines_i_match = removedLines[i].match(/^\s+/)) == null ? void 0 : (_removedLines_i_match_ = _removedLines_i_match[0]) == null ? void 0 : _removedLines_i_match_.length) || 0),
						type: 'remove',
						text: removedLines[i].replace(/^\s+/, '').replace(/,$/g, ''),
					});
					tRight.unshift({
						level: level + 1,
						type: 'equal',
						text: '',
					});
				}
				i--;
			}
		} else {
			const addedLines = stringify(arrRight[j - 1], undefined, 1, undefined, options.undefinedBehavior).split('\n');
			for (let i = addedLines.length - 1; i >= 0; i--) {
				var _addedLines_i_match, _addedLines_i_match_;
				tLeft.unshift({
					level: level + 1,
					type: 'equal',
					text: '',
				});
				tRight.unshift({
					level: level + 1 + (((_addedLines_i_match = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_ = _addedLines_i_match[0]) == null ? void 0 : _addedLines_i_match_.length) || 0),
					type: 'add',
					text: addedLines[i].replace(/^\s+/, '').replace(/,$/g, ''),
				});
			}
			j--;
		}
	}
	return [tLeft, tRight];
};
const diffArrayLCS = (arrLeft, arrRight, keyLeft, keyRight, level, options, linesLeft = [], linesRight = []) => {
	if (keyLeft && keyRight) {
		linesLeft.push({
			level,
			type: 'equal',
			text: `"${keyLeft}": [`,
		});
		linesRight.push({
			level,
			type: 'equal',
			text: `"${keyRight}": [`,
		});
	} else {
		linesLeft.push({
			level,
			type: 'equal',
			text: '[',
		});
		linesRight.push({
			level,
			type: 'equal',
			text: '[',
		});
	}
	if (level >= (options.maxDepth || Infinity)) {
		linesLeft.push({
			level: level + 1,
			type: 'equal',
			text: '...',
		});
		linesRight.push({
			level: level + 1,
			type: 'equal',
			text: '...',
		});
	} else {
		const [tLeftReverse, tRightReverse] = lcs(arrLeft, arrRight, keyLeft, keyRight, level, options);
		linesLeft = concat(linesLeft, tLeftReverse);
		linesRight = concat(linesRight, tRightReverse);
	}
	linesLeft.push({
		level,
		type: 'equal',
		text: ']',
	});
	linesRight.push({
		level,
		type: 'equal',
		text: ']',
	});
	return [linesLeft, linesRight];
};

const diffArrayNormal = (arrLeft, arrRight, keyLeft, keyRight, level, options, linesLeft = [], linesRight = []) => {
	arrLeft = [...arrLeft];
	arrRight = [...arrRight];
	if (keyLeft && keyRight) {
		linesLeft.push({
			level,
			type: 'equal',
			text: `"${keyLeft}": [`,
		});
		linesRight.push({
			level,
			type: 'equal',
			text: `"${keyRight}": [`,
		});
	} else {
		linesLeft.push({
			level,
			type: 'equal',
			text: '[',
		});
		linesRight.push({
			level,
			type: 'equal',
			text: '[',
		});
	}
	if (level >= (options.maxDepth || Infinity)) {
		linesLeft.push({
			level: level + 1,
			type: 'equal',
			text: '...',
		});
		linesRight.push({
			level: level + 1,
			type: 'equal',
			text: '...',
		});
	} else {
		while (arrLeft.length || arrRight.length) {
			const itemLeft = arrLeft[0];
			const itemRight = arrRight[0];
			const leftType = getType(itemLeft);
			const rightType = getType(itemRight);
			if (arrLeft.length && arrRight.length) {
				if (leftType !== rightType) {
					prettyAppendLines(linesLeft, linesRight, '', '', itemLeft, itemRight, level + 1, options);
				} else if (options.recursiveEqual && ['object', 'array'].includes(leftType) && isEqual(itemLeft, itemRight, options)) {
					prettyAppendLines(linesLeft, linesRight, '', '', itemLeft, itemRight, level + 1, options);
				} else if (leftType === 'object') {
					linesLeft.push({
						level: level + 1,
						type: 'equal',
						text: '{',
					});
					linesRight.push({
						level: level + 1,
						type: 'equal',
						text: '{',
					});
					const [leftLines, rightLines] = diffObject(itemLeft, itemRight, level + 2, options, diffArrayNormal);
					linesLeft = concat(linesLeft, leftLines);
					linesRight = concat(linesRight, rightLines);
					linesLeft.push({
						level: level + 1,
						type: 'equal',
						text: '}',
					});
					linesRight.push({
						level: level + 1,
						type: 'equal',
						text: '}',
					});
				} else if (leftType === 'array') {
					const [resLeft, resRight] = diffArrayNormal(itemLeft, itemRight, '', '', level + 1, options, [], []);
					linesLeft = concat(linesLeft, resLeft);
					linesRight = concat(linesRight, resRight);
				} else if (
					cmp(itemLeft, itemRight, {
						ignoreCase: options.ignoreCase,
					}) === 0
				) {
					linesLeft.push({
						level: level + 1,
						type: 'equal',
						text: formatValue(itemLeft, undefined, undefined, options.undefinedBehavior),
					});
					linesRight.push({
						level: level + 1,
						type: 'equal',
						text: formatValue(itemRight, undefined, undefined, options.undefinedBehavior),
					});
				} else {
					if (options.showModifications) {
						linesLeft.push({
							level: level + 1,
							type: 'modify',
							text: formatValue(itemLeft, undefined, undefined, options.undefinedBehavior),
						});
						linesRight.push({
							level: level + 1,
							type: 'modify',
							text: formatValue(itemRight, undefined, undefined, options.undefinedBehavior),
						});
					} else {
						linesLeft.push({
							level: level + 1,
							type: 'remove',
							text: formatValue(itemLeft, undefined, undefined, options.undefinedBehavior),
						});
						linesLeft.push({
							level: level + 1,
							type: 'equal',
							text: '',
						});
						linesRight.push({
							level: level + 1,
							type: 'equal',
							text: '',
						});
						linesRight.push({
							level: level + 1,
							type: 'add',
							text: formatValue(itemRight, undefined, undefined, options.undefinedBehavior),
						});
					}
				}
				arrLeft.shift();
				arrRight.shift();
			} else if (arrLeft.length) {
				const removedLines = formatValue(itemLeft, undefined, true, options.undefinedBehavior).split('\n');
				for (let i = 0; i < removedLines.length; i++) {
					var _removedLines_i_match, _removedLines_i_match_;
					linesLeft.push({
						level: level + 1 + (((_removedLines_i_match = removedLines[i].match(/^\s+/)) == null ? void 0 : (_removedLines_i_match_ = _removedLines_i_match[0]) == null ? void 0 : _removedLines_i_match_.length) || 0),
						type: 'remove',
						text: removedLines[i].replace(/^\s+/, '').replace(/,$/g, ''),
					});
					linesRight.push({
						level: level + 1,
						type: 'equal',
						text: '',
					});
				}
				arrLeft.shift();
			} else if (arrRight.length) {
				const addedLines = formatValue(itemRight, undefined, true, options.undefinedBehavior).split('\n');
				for (let i = 0; i < addedLines.length; i++) {
					var _addedLines_i_match, _addedLines_i_match_;
					linesLeft.push({
						level: level + 1,
						type: 'equal',
						text: '',
					});
					linesRight.push({
						level: level + 1 + (((_addedLines_i_match = addedLines[i].match(/^\s+/)) == null ? void 0 : (_addedLines_i_match_ = _addedLines_i_match[0]) == null ? void 0 : _addedLines_i_match_.length) || 0),
						type: 'add',
						text: addedLines[i].replace(/^\s+/, '').replace(/,$/g, ''),
					});
				}
				arrRight.shift();
			}
		}
	}
	linesLeft.push({
		level,
		type: 'equal',
		text: ']',
	});
	linesRight.push({
		level,
		type: 'equal',
		text: ']',
	});
	return [linesLeft, linesRight];
};

function _extends$1() {
	_extends$1 =
		Object.assign ||
		function (target) {
			for (var i = 1; i < arguments.length; i++) {
				var source = arguments[i];
				for (var key in source) {
					if (Object.prototype.hasOwnProperty.call(source, key)) {
						target[key] = source[key];
					}
				}
			}
			return target;
		};
	return _extends$1.apply(this, arguments);
}
const sortInnerArrays = (source, options) => {
	if (!source || typeof source !== 'object') {
		return source;
	}
	if (Array.isArray(source)) {
		const result = [...source];
		result.sort((a, b) => {
			return cmp(a, b, {
				ignoreCase: options == null ? void 0 : options.ignoreCase,
			});
		});
		return result.map(item => sortInnerArrays(item, options));
	}
	const result = _extends$1({}, source);
	for (const key in result) {
		result[key] = sortInnerArrays(result[key], options);
	}
	return result;
};

function _extends() {
	_extends =
		Object.assign ||
		function (target) {
			for (var i = 1; i < arguments.length; i++) {
				var source = arguments[i];
				for (var key in source) {
					if (Object.prototype.hasOwnProperty.call(source, key)) {
						target[key] = source[key];
					}
				}
			}
			return target;
		};
	return _extends.apply(this, arguments);
}
var UndefinedBehavior;
(function (UndefinedBehavior) {
	UndefinedBehavior['stringify'] = 'stringify';
	UndefinedBehavior['ignore'] = 'ignore';
	UndefinedBehavior['throw'] = 'throw';
})(UndefinedBehavior || (UndefinedBehavior = {}));
const EQUAL_EMPTY_LINE = {
	level: 0,
	type: 'equal',
	text: '',
};
const EQUAL_LEFT_BRACKET_LINE = {
	level: 0,
	type: 'equal',
	text: '{',
};
const EQUAL_RIGHT_BRACKET_LINE = {
	level: 0,
	type: 'equal',
	text: '}',
};
let Differ = class Differ {
	detectCircular(source) {
		if (this.options.detectCircular) {
			if (detectCircular(source)) {
				throw new Error(
					`Circular reference detected in object (with keys ${Object.keys(source)
						.map(t => `"${t}"`)
						.join(', ')})`,
				);
			}
		}
	}
	sortResultLines(left, right) {
		for (let k = 0; k < left.length; k++) {
			let changed = false;
			for (let i = 1; i < left.length; i++) {
				if (left[i].type === 'remove' && left[i - 1].type === 'equal' && right[i].type === 'equal' && right[i - 1].type === 'add') {
					const t1 = left[i - 1];
					left[i - 1] = left[i];
					left[i] = t1;
					const t2 = right[i - 1];
					right[i - 1] = right[i];
					right[i] = t2;
					changed = true;
				}
			}
			if (!changed) {
				break;
			}
		}
	}
	calculateLineNumbers(result) {
		let lineNumber = 0;
		for (const item of result) {
			if (!item.text) {
				continue;
			}
			item.lineNumber = ++lineNumber;
		}
	}
	calculateCommas(result) {
		const nextLine = Array(result.length).fill(0);
		for (let i = result.length - 1; i > 0; i--) {
			if (result[i].text) {
				nextLine[i - 1] = i;
			} else {
				nextLine[i - 1] = nextLine[i];
			}
		}
		for (let i = 0; i < result.length; i++) {
			if (!result[i].text.endsWith('{') && !result[i].text.endsWith('[') && result[i].text && nextLine[i] && result[i].level <= result[nextLine[i]].level) {
				result[i].comma = true;
			}
		}
	}
	diff(sourceLeft, sourceRight) {
		this.detectCircular(sourceLeft);
		this.detectCircular(sourceRight);
		if (this.options.arrayDiffMethod === 'unorder-normal' || this.options.arrayDiffMethod === 'unorder-lcs') {
			sourceLeft = sortInnerArrays(sourceLeft, this.options);
			sourceRight = sortInnerArrays(sourceRight, this.options);
		}
		if (this.options.undefinedBehavior === 'ignore') {
			var _cleanFields;
			sourceLeft = (_cleanFields = cleanFields(sourceLeft)) != null ? _cleanFields : null;
			var _cleanFields1;
			sourceRight = (_cleanFields1 = cleanFields(sourceRight)) != null ? _cleanFields1 : null;
		}
		let resultLeft = [];
		let resultRight = [];
		const typeLeft = getType(sourceLeft);
		const typeRight = getType(sourceRight);
		if (typeLeft !== typeRight) {
			resultLeft = stringify(sourceLeft, undefined, 1, this.options.maxDepth, this.options.undefinedBehavior)
				.split('\n')
				.map(line => {
					var _line_match, _line_match_;
					return {
						level: ((_line_match = line.match(/^\s+/)) == null ? void 0 : (_line_match_ = _line_match[0]) == null ? void 0 : _line_match_.length) || 0,
						type: 'remove',
						text: line.replace(/^\s+/, '').replace(/,$/g, ''),
						comma: line.endsWith(','),
					};
				});
			resultRight = stringify(sourceRight, undefined, 1, this.options.maxDepth, this.options.undefinedBehavior)
				.split('\n')
				.map(line => {
					var _line_match, _line_match_;
					return {
						level: ((_line_match = line.match(/^\s+/)) == null ? void 0 : (_line_match_ = _line_match[0]) == null ? void 0 : _line_match_.length) || 0,
						type: 'add',
						text: line.replace(/^\s+/, '').replace(/,$/g, ''),
						comma: line.endsWith(','),
					};
				});
			const lLength = resultLeft.length;
			const rLength = resultRight.length;
			resultLeft = concat(
				resultLeft,
				Array(rLength)
					.fill(0)
					.map(() => _extends({}, EQUAL_EMPTY_LINE)),
			);
			resultRight = concat(
				resultRight,
				Array(lLength)
					.fill(0)
					.map(() => _extends({}, EQUAL_EMPTY_LINE)),
				true,
			);
		} else if (typeLeft === 'object') {
			[resultLeft, resultRight] = diffObject(sourceLeft, sourceRight, 1, this.options, this.arrayDiffFunc);
			resultLeft.unshift(_extends({}, EQUAL_LEFT_BRACKET_LINE));
			resultLeft.push(_extends({}, EQUAL_RIGHT_BRACKET_LINE));
			resultRight.unshift(_extends({}, EQUAL_LEFT_BRACKET_LINE));
			resultRight.push(_extends({}, EQUAL_RIGHT_BRACKET_LINE));
		} else if (typeLeft === 'array') {
			[resultLeft, resultRight] = this.arrayDiffFunc(sourceLeft, sourceRight, '', '', 0, this.options);
		} else if (sourceLeft !== sourceRight) {
			if (this.options.ignoreCase) {
				if (typeof sourceLeft === 'string' && typeof sourceRight === 'string' && sourceLeft.toLowerCase() === sourceRight.toLowerCase()) {
					resultLeft = [
						{
							level: 0,
							type: 'equal',
							text: sourceLeft,
						},
					];
					resultRight = [
						{
							level: 0,
							type: 'equal',
							text: sourceRight,
						},
					];
				}
			} else if (this.options.showModifications) {
				resultLeft = [
					{
						level: 0,
						type: 'modify',
						text: stringify(sourceLeft, undefined, undefined, this.options.maxDepth, this.options.undefinedBehavior),
					},
				];
				resultRight = [
					{
						level: 0,
						type: 'modify',
						text: stringify(sourceRight, undefined, undefined, this.options.maxDepth, this.options.undefinedBehavior),
					},
				];
			} else {
				resultLeft = [
					{
						level: 0,
						type: 'remove',
						text: stringify(sourceLeft, undefined, undefined, this.options.maxDepth, this.options.undefinedBehavior),
					},
					_extends({}, EQUAL_EMPTY_LINE),
				];
				resultRight = [
					_extends({}, EQUAL_EMPTY_LINE),
					{
						level: 0,
						type: 'add',
						text: stringify(sourceRight, undefined, undefined, this.options.maxDepth, this.options.undefinedBehavior),
					},
				];
			}
		} else {
			resultLeft = [
				{
					level: 0,
					type: 'equal',
					text: stringify(sourceLeft, undefined, undefined, this.options.maxDepth, this.options.undefinedBehavior),
				},
			];
			resultRight = [
				{
					level: 0,
					type: 'equal',
					text: stringify(sourceRight, undefined, undefined, this.options.maxDepth, this.options.undefinedBehavior),
				},
			];
		}
		this.sortResultLines(resultLeft, resultRight);
		this.calculateLineNumbers(resultLeft);
		this.calculateLineNumbers(resultRight);
		this.calculateCommas(resultLeft);
		this.calculateCommas(resultRight);
		return [resultLeft, resultRight];
	}
	constructor({ detectCircular = true, maxDepth = Infinity, showModifications = true, arrayDiffMethod = 'normal', ignoreCase = false, ignoreCaseForKey = false, recursiveEqual = false, preserveKeyOrder, undefinedBehavior = 'stringify' } = {}) {
		this.options = {
			detectCircular,
			maxDepth,
			showModifications,
			arrayDiffMethod,
			ignoreCase,
			ignoreCaseForKey,
			recursiveEqual,
			preserveKeyOrder,
			undefinedBehavior,
		};
		this.arrayDiffFunc = arrayDiffMethod === 'lcs' || arrayDiffMethod === 'unorder-lcs' ? diffArrayLCS : diffArrayNormal;
	}
};

export default Differ as unknown as typeof DifferT;
