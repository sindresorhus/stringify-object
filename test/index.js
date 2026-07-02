import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import stringifyObject from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('stringify an object', () => {
	/* eslint-disable object-shorthand -- Testing shorthand-incompatible keys alongside plain ones */
	const object = {
		foo: 'bar \'bar\'',
		foo2: [
			'foo',
			'bar',
			{
				foo: 'bar \'bar\'',
			},
		],
		'foo-foo': 'bar',
		'2foo': 'bar',
		'@#': 'bar',
		$el: 'bar',
		_private: 'bar',
		number: 1,
		boolean: true,
		date: new Date('2014-01-29T22:41:05.665Z'),
		escapedString: '""',
		null: null,
		undefined: undefined,
		fn: function fn() {}, // eslint-disable-line func-names
		regexp: /./, // eslint-disable-line require-unicode-regexp -- Fixture data, must stringify as `/./`
		NaN: NaN,
		Infinity: Infinity,
		newlines: 'foo\nbar\r\nbaz',
		[Symbol()]: Symbol(), // eslint-disable-line symbol-description
		[Symbol('foo')]: Symbol('foo'),
		[Symbol.for('foo')]: Symbol.for('foo'),
	};
	/* eslint-enable */

	object.circular = object;

	const actual = stringifyObject(object, {
		indent: '  ',
		singleQuotes: false,
	});

	assert.equal(actual + '\n', fs.readFileSync(path.resolve(__dirname, 'fixtures/object.js'), 'utf8'));
	assert.equal(
		stringifyObject({foo: String.raw`a ' b ' c \' d`}, {singleQuotes: true}),
		'{\n\tfoo: \'a \\\' b \\\' c \\\\\\\' d\'\n}',
	);
});

test('string escaping works properly', () => {
	assert.equal(stringifyObject('\\', {singleQuotes: true}), String.raw`'\\'`); // \
	assert.equal(stringifyObject(String.raw`\'`, {singleQuotes: true}), String.raw`'\\\''`); // \'
	assert.equal(stringifyObject(String.raw`\"`, {singleQuotes: true}), String.raw`'\\"'`); // \"
	assert.equal(stringifyObject('\\', {singleQuotes: false}), String.raw`"\\"`); // \
	assert.equal(stringifyObject(String.raw`\'`, {singleQuotes: false}), String.raw`"\\'"`); // \'
	assert.equal(stringifyObject(String.raw`\"`, {singleQuotes: false}), String.raw`"\\\""`); // \"
	/* eslint-disable no-eval -- Verifying the stringified output is valid, evaluable JS */
	assert.equal(eval(stringifyObject(String.raw`\'`)), String.raw`\'`);
	assert.equal(eval(stringifyObject(String.raw`\'`, {singleQuotes: false})), String.raw`\'`);
	/* eslint-enable */
	// Regression test for #40
	assert.equal(stringifyObject('a\'a'), String.raw`'a\'a'`);
});

test('detect reused object values as circular reference', () => {
	const value = {val: 10};
	const object = {foo: value, bar: value};
	assert.equal(stringifyObject(object), '{\n\tfoo: {\n\t\tval: 10\n\t},\n\tbar: {\n\t\tval: 10\n\t}\n}');
});

test('detect reused array values as false circular references', () => {
	const value = [10];
	const object = {foo: value, bar: value};
	assert.equal(stringifyObject(object), '{\n\tfoo: [\n\t\t10\n\t],\n\tbar: [\n\t\t10\n\t]\n}');
});

test('considering filter option to stringify an object', () => {
	const value = {val: 10};
	const object = {foo: value, bar: value};
	const actual = stringifyObject(object, {
		filter: (currentObject, prop) => prop !== 'foo',
	});
	assert.equal(actual, '{\n\tbar: {\n\t\tval: 10\n\t}\n}');

	const actual2 = stringifyObject(object, {
		filter: (currentObject, prop) => prop !== 'bar',
	});
	assert.equal(actual2, '{\n\tfoo: {\n\t\tval: 10\n\t}\n}');

	const actual3 = stringifyObject(object, {
		filter: (currentObject, prop) => prop !== 'val' && prop !== 'bar',
	});
	assert.equal(actual3, '{\n\tfoo: {}\n}');
});

test('allows an object to be transformed', () => {
	const object = {
		foo: {
			val: 10,
		},
		bar: 9,
		baz: [8],
	};

	const actual = stringifyObject(object, {
		transform(currentObject, prop, result) {
			if (prop === 'val') {
				return String(currentObject[prop] + 1);
			}

			if (prop === 'bar') {
				return '\'' + result + 'L\'';
			}

			if (currentObject[prop] === 8) {
				return 'LOL';
			}

			return result;
		},
	});

	assert.equal(actual, '{\n\tfoo: {\n\t\tval: 11\n\t},\n\tbar: \'9L\',\n\tbaz: [\n\t\tLOL\n\t]\n}');
});

test('doesn\'t crash with circular references in arrays', () => {
	const array = [];
	array.push(array);
	assert.doesNotThrow(() => {
		stringifyObject(array);
	});

	const nestedArray = [[]];
	nestedArray[0][0] = nestedArray;
	assert.doesNotThrow(() => {
		stringifyObject(nestedArray);
	});
});

test('handle circular references in arrays', () => {
	const array2 = [];
	const array = [array2];
	array2[0] = array2;

	assert.doesNotThrow(() => {
		stringifyObject(array);
	});
});

test('stringify complex circular arrays', () => {
	const array = [[[]]];
	array[0].push(array);
	array[0][0].push(array, 10);
	array[0][0][0] = array;
	assert.equal(stringifyObject(array), '[\n\t[\n\t\t[\n\t\t\t"[Circular]",\n\t\t\t10\n\t\t],\n\t\t"[Circular]"\n\t]\n]');
});

test('allows short objects to be one-lined', () => {
	const object = {id: 8, name: 'Jane'};

	assert.equal(stringifyObject(object), '{\n\tid: 8,\n\tname: \'Jane\'\n}');
	assert.equal(stringifyObject(object, {inlineCharacterLimit: 21}), '{id: 8, name: \'Jane\'}');
	assert.equal(stringifyObject(object, {inlineCharacterLimit: 20}), '{\n\tid: 8,\n\tname: \'Jane\'\n}');
});

test('allows short arrays to be one-lined', () => {
	const array = ['foo', {id: 8, name: 'Jane'}, 42];

	assert.equal(stringifyObject(array), '[\n\t\'foo\',\n\t{\n\t\tid: 8,\n\t\tname: \'Jane\'\n\t},\n\t42\n]');
	assert.equal(stringifyObject(array, {inlineCharacterLimit: 34}), '[\'foo\', {id: 8, name: \'Jane\'}, 42]');
	assert.equal(stringifyObject(array, {inlineCharacterLimit: 33}), '[\n\t\'foo\',\n\t{id: 8, name: \'Jane\'},\n\t42\n]');
});

test('does not mess up indents for complex objects', () => {
	const object = {
		arr: [1, 2, 3],
		nested: {hello: 'world'},
	};

	assert.equal(stringifyObject(object), '{\n\tarr: [\n\t\t1,\n\t\t2,\n\t\t3\n\t],\n\tnested: {\n\t\thello: \'world\'\n\t}\n}');
	assert.equal(stringifyObject(object, {inlineCharacterLimit: 12}), '{\n\tarr: [1, 2, 3],\n\tnested: {\n\t\thello: \'world\'\n\t}\n}');
});

test('handles non-plain object', () => {
	const stats = fs.statSync(new URL(import.meta.url));
	assert.notEqual(stringifyObject(stats), '[object Object]');
});

test('don\'t stringify non-enumerable symbols', () => {
	const object = {
		[Symbol('for enumerable key')]: undefined,
	};
	const symbol = Symbol('for non-enumerable key');
	Object.defineProperty(object, symbol, {enumerable: false});

	assert.equal(stringifyObject(object), '{\n\t[Symbol(\'for enumerable key\')]: undefined\n}');
});

test('handle symbols', () => {
	const object = {
		[Symbol('unique')]: Symbol('unique'),
		[Symbol.for('registry')]: [Symbol.for('registry'), 2],
		[Symbol.iterator]: {k: Symbol.iterator},
		[Symbol()]: 'undef', // eslint-disable-line symbol-description
	};
	assert.equal(stringifyObject(object), '{\n\t[Symbol(\'unique\')]: Symbol(\'unique\'),\n\t[Symbol.for(\'registry\')]: [\n\t\tSymbol.for(\'registry\'),\n\t\t2\n\t],\n\t[Symbol.iterator]: {\n\t\tk: Symbol.iterator\n\t},\n\t[Symbol()]: \'undef\'\n}');

	// Anonymous symbol (no description)
	assert.equal(stringifyObject(Symbol()), 'Symbol()'); // eslint-disable-line symbol-description

	// Symbol with empty string description
	assert.equal(stringifyObject(Symbol('')), 'Symbol(\'\')');

	// Symbol.for with empty string
	assert.equal(stringifyObject(Symbol.for('')), 'Symbol.for(\'\')');

	// Test as object keys
	const emptySymbolKeys = {
		[Symbol()]: 'anonymous', // eslint-disable-line symbol-description
		[Symbol('')]: 'empty string',
		[Symbol.for('')]: 'empty for',
	};
	assert.match(stringifyObject(emptySymbolKeys), /\[Symbol\(\)\]/v);
	assert.match(stringifyObject(emptySymbolKeys), /\[Symbol\(''\)\]/v);
	assert.match(stringifyObject(emptySymbolKeys), /\[Symbol\.for\(''\)\]/v);

	// Symbol escaping with special characters
	const symbolWithSpecialChars = Symbol('a"b\\c\n');
	assert.equal(stringifyObject(symbolWithSpecialChars), String.raw`Symbol('a"b\\c\n')`);
	assert.equal(stringifyObject(symbolWithSpecialChars, {singleQuotes: false}), String.raw`Symbol("a\"b\\c\n")`);

	const specialCharKey = {
		[Symbol('a"b\\c\n')]: 'value',
	};
	assert.match(stringifyObject(specialCharKey), /\[Symbol\('a"b\\\\c\\n'\)\]/v);

	// Well-known symbols
	assert.equal(stringifyObject(Symbol.iterator), 'Symbol.iterator');
	assert.equal(stringifyObject(Symbol.hasInstance), 'Symbol.hasInstance');
	assert.equal(stringifyObject(Symbol.toStringTag), 'Symbol.toStringTag');

	// Look-alike symbols (not real well-known symbols)
	assert.equal(stringifyObject(Symbol('Symbol.iterator')), 'Symbol(\'Symbol.iterator\')');
	assert.equal(stringifyObject(Symbol('Symbol.hasInstance')), 'Symbol(\'Symbol.hasInstance\')');
	assert.equal(stringifyObject(Symbol('Symbol.toStringTag')), 'Symbol(\'Symbol.toStringTag\')');
});

test('should properly escape special characters', () => {
	const s = 'tab: \t newline: \n backslash: \\';
	assert.equal(stringifyObject(s), String.raw`'tab: \t newline: \n backslash: \\'`);

	const s2 = 'carriage return: \r tab: \t';
	assert.equal(stringifyObject(s2), String.raw`'carriage return: \r tab: \t'`);

	// Test other escape sequences
	assert.equal(stringifyObject('\f'), String.raw`'\f'`); // Form feed
	assert.equal(stringifyObject('\v'), String.raw`'\v'`); // Vertical tab
	assert.equal(stringifyObject('\b'), String.raw`'\b'`); // Backspace
	assert.equal(stringifyObject('\0'), String.raw`'\u{0}'`); // Null character

	// Test control characters that need unicode escape
	assert.equal(stringifyObject(String.fromCodePoint(1)), String.raw`'\u{1}'`); // Start of heading
	assert.equal(stringifyObject(String.fromCodePoint(7)), String.raw`'\u{7}'`); // Bell
	assert.equal(stringifyObject(String.fromCodePoint(27)), String.raw`'\u{1b}'`); // Escape
	assert.equal(stringifyObject(String.fromCodePoint(31)), String.raw`'\u{1f}'`); // Unit separator
	assert.equal(stringifyObject(String.fromCodePoint(127)), String.raw`'\u{7f}'`); // Delete

	// Test a string with multiple special characters
	const mixed = 'a\tb\nc\rd\fe\vf\bg\0h' + String.fromCodePoint(1) + 'i';
	assert.equal(stringifyObject(mixed), String.raw`'a\tb\nc\rd\fe\vf\bg\u{0}h\u{1}i'`);
});

test('handle Map objects', () => {
	// Empty Map
	const emptyMap = new Map();
	assert.equal(stringifyObject(emptyMap), 'new Map()');

	// Map with various types
	const map = new Map([
		['string', 'value'],
		[42, 'number key'],
		[true, 'boolean key'],
		[null, 'null key'],
		[undefined, 'undefined key'],
	]);
	assert.equal(stringifyObject(map), `new Map([
	['string', 'value'],
	[42, 'number key'],
	[true, 'boolean key'],
	[null, 'null key'],
	[undefined, 'undefined key']
])`);

	// Map with object values
	const objectMap = new Map([
		['a', {foo: 'bar'}],
		['b', [1, 2, 3]],
	]);
	assert.equal(stringifyObject(objectMap), `new Map([
	['a', {
		foo: 'bar'
	}],
	['b', [
		1,
		2,
		3
	]]
])`);

	// Map with symbol keys
	const symbolMap = new Map([
		[Symbol('test'), 'symbol key'],
		[Symbol.iterator, 'well-known symbol'],
	]);
	assert.equal(stringifyObject(symbolMap), `new Map([
	[Symbol('test'), 'symbol key'],
	[Symbol.iterator, 'well-known symbol']
])`);

	// Nested Map
	const nestedMap = new Map([
		['inner', new Map([['deep', 'value']])],
	]);
	assert.equal(stringifyObject(nestedMap), `new Map([
	['inner', new Map([
		['deep', 'value']
	])]
])`);
});

test('handle Set objects', () => {
	// Empty Set
	const emptySet = new Set();
	assert.equal(stringifyObject(emptySet), 'new Set()');

	// Set with various types
	const set = new Set(['string', 42, true, null, undefined]);
	assert.equal(stringifyObject(set), `new Set([
	'string',
	42,
	true,
	null,
	undefined
])`);

	// Set with objects
	const objectSet = new Set([{foo: 'bar'}, [1, 2, 3]]);
	assert.equal(stringifyObject(objectSet), `new Set([
	{
		foo: 'bar'
	},
	[
		1,
		2,
		3
	]
])`);

	// Nested Set
	const nestedSet = new Set([new Set(['inner'])]);
	assert.equal(stringifyObject(nestedSet), `new Set([
	new Set([
		'inner'
	])
])`);
});

test('handle Map and Set with circular references', () => {
	// Circular Map
	const circularMap = new Map();
	circularMap.set('self', circularMap);
	assert.match(stringifyObject(circularMap), /\[Circular\]/v);

	// Circular Set
	const circularSet = new Set();
	circularSet.add(circularSet);
	assert.match(stringifyObject(circularSet), /\[Circular\]/v);
});

test('handle edge cases', () => {
	// BigInt
	assert.equal(stringifyObject(123n), '123n');

	// Invalid Date
	const invalidDate = new Date('invalid');
	assert.equal(stringifyObject(invalidDate), 'new Date(\'Invalid Date\')');

	// Date honors the `singleQuotes` option
	const date = new Date('2014-01-29T22:41:05.665Z');
	assert.equal(stringifyObject(date), 'new Date(\'2014-01-29T22:41:05.665Z\')');
	assert.equal(stringifyObject(date, {singleQuotes: false}), 'new Date("2014-01-29T22:41:05.665Z")');
	assert.equal(stringifyObject(invalidDate, {singleQuotes: false}), 'new Date("Invalid Date")');

	// Object with numeric keys
	const numericKeys = {123: 'numeric', 456: 'string numeric'};
	assert.equal(stringifyObject(numericKeys), '{\n\t\'123\': \'numeric\',\n\t\'456\': \'string numeric\'\n}');

	// Reserved keywords as keys - quoted for safety
	const reserved = {class: 'reserved', const: 'keyword', return: 'statement'};
	assert.equal(stringifyObject(reserved), '{\n\t\'class\': \'reserved\',\n\t\'const\': \'keyword\',\n\t\'return\': \'statement\'\n}');

	// `__proto__` as an own enumerable key is never emitted, since it would set the
	// prototype instead of creating a property when the output is evaluated
	const protoKey = Object.defineProperty({other: 'kept'}, '__proto__', {value: 'value', enumerable: true});
	assert.equal(stringifyObject(protoKey), '{\n\tother: \'kept\'\n}');
});

test('empty indent option is respected', () => {
	assert.equal(stringifyObject({a: 1, b: 2}, {indent: ''}), '{\na: 1,\nb: 2\n}');
});

test('transform option works on Map and Set entries', () => {
	// For Map entries, transform receives the stringified *value* only, matching
	// how it receives the stringified value for object properties and array elements
	const map = new Map([['a', 1], ['b', 2]]);
	const mapActual = stringifyObject(map, {
		transform: (object, key, result) => key === 'a' ? 'REDACTED' : result,
	});
	assert.equal(mapActual, 'new Map([\n\t[\'a\', REDACTED],\n\t[\'b\', 2]\n])');

	const set = new Set(['a', 'b']);
	const setActual = stringifyObject(set, {
		transform: (object, item, result) => item === 'a' ? 'REDACTED' : result,
	});
	assert.equal(setActual, 'new Set([\n\tREDACTED,\n\t\'b\'\n])');
});
