import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import stringifyObject from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('stringify an object', t => {
	/* eslint-disable object-shorthand */
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
		regexp: /./,
		NaN: Number.NaN,
		Infinity: Number.POSITIVE_INFINITY,
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

	t.is(actual + '\n', fs.readFileSync(path.resolve(__dirname, 'fixtures/object.js'), 'utf8'));
	t.is(
		stringifyObject({foo: String.raw`a ' b ' c \' d`}, {singleQuotes: true}),
		'{\n\tfoo: \'a \\\' b \\\' c \\\\\\\' d\'\n}',
	);
});

test('string escaping works properly', t => {
	t.is(stringifyObject('\\', {singleQuotes: true}), String.raw`'\\'`); // \
	t.is(stringifyObject(String.raw`\'`, {singleQuotes: true}), String.raw`'\\\''`); // \'
	t.is(stringifyObject(String.raw`\"`, {singleQuotes: true}), String.raw`'\\"'`); // \"
	t.is(stringifyObject('\\', {singleQuotes: false}), String.raw`"\\"`); // \
	t.is(stringifyObject(String.raw`\'`, {singleQuotes: false}), String.raw`"\\'"`); // \'
	t.is(stringifyObject(String.raw`\"`, {singleQuotes: false}), String.raw`"\\\""`); // \"
	/* eslint-disable no-eval */
	t.is(eval(stringifyObject(String.raw`\'`)), String.raw`\'`);
	t.is(eval(stringifyObject(String.raw`\'`, {singleQuotes: false})), String.raw`\'`);
	/* eslint-enable */
	// Regression test for #40
	t.is(stringifyObject('a\'a'), String.raw`'a\'a'`);
});

test('detect reused object values as circular reference', t => {
	const value = {val: 10};
	const object = {foo: value, bar: value};
	t.is(stringifyObject(object), '{\n\tfoo: {\n\t\tval: 10\n\t},\n\tbar: {\n\t\tval: 10\n\t}\n}');
});

test('detect reused array values as false circular references', t => {
	const value = [10];
	const object = {foo: value, bar: value};
	t.is(stringifyObject(object), '{\n\tfoo: [\n\t\t10\n\t],\n\tbar: [\n\t\t10\n\t]\n}');
});

test('considering filter option to stringify an object', t => {
	const value = {val: 10};
	const object = {foo: value, bar: value};
	const actual = stringifyObject(object, {
		filter: (object, prop) => prop !== 'foo',
	});
	t.is(actual, '{\n\tbar: {\n\t\tval: 10\n\t}\n}');

	const actual2 = stringifyObject(object, {
		filter: (object, prop) => prop !== 'bar',
	});
	t.is(actual2, '{\n\tfoo: {\n\t\tval: 10\n\t}\n}');

	const actual3 = stringifyObject(object, {
		filter: (object, prop) => prop !== 'val' && prop !== 'bar',
	});
	t.is(actual3, '{\n\tfoo: {}\n}');
});

test('allows an object to be transformed', t => {
	const object = {
		foo: {
			val: 10,
		},
		bar: 9,
		baz: [8],
	};

	const actual = stringifyObject(object, {
		transform(object, prop, result) {
			if (prop === 'val') {
				return String(object[prop] + 1);
			}

			if (prop === 'bar') {
				return '\'' + result + 'L\'';
			}

			if (object[prop] === 8) {
				return 'LOL';
			}

			return result;
		},
	});

	t.is(actual, '{\n\tfoo: {\n\t\tval: 11\n\t},\n\tbar: \'9L\',\n\tbaz: [\n\t\tLOL\n\t]\n}');
});

test('doesn\'t  crash with circular references in arrays', t => {
	const array = [];
	array.push(array);
	t.notThrows(() => {
		stringifyObject(array);
	});

	const nestedArray = [[]];
	nestedArray[0][0] = nestedArray;
	t.notThrows(() => {
		stringifyObject(nestedArray);
	});
});

test('handle circular references in arrays', t => {
	const array2 = [];
	const array = [array2];
	array2[0] = array2;

	t.notThrows(() => {
		stringifyObject(array);
	});
});

test('stringify complex circular arrays', t => {
	const array = [[[]]];
	array[0].push(array);
	array[0][0].push(array, 10);
	array[0][0][0] = array;
	t.is(stringifyObject(array), '[\n\t[\n\t\t[\n\t\t\t"[Circular]",\n\t\t\t10\n\t\t],\n\t\t"[Circular]"\n\t]\n]');
});

test('allows short objects to be one-lined', t => {
	const object = {id: 8, name: 'Jane'};

	t.is(stringifyObject(object), '{\n\tid: 8,\n\tname: \'Jane\'\n}');
	t.is(stringifyObject(object, {inlineCharacterLimit: 21}), '{id: 8, name: \'Jane\'}');
	t.is(stringifyObject(object, {inlineCharacterLimit: 20}), '{\n\tid: 8,\n\tname: \'Jane\'\n}');
});

test('allows short arrays to be one-lined', t => {
	const array = ['foo', {id: 8, name: 'Jane'}, 42];

	t.is(stringifyObject(array), '[\n\t\'foo\',\n\t{\n\t\tid: 8,\n\t\tname: \'Jane\'\n\t},\n\t42\n]');
	t.is(stringifyObject(array, {inlineCharacterLimit: 34}), '[\'foo\', {id: 8, name: \'Jane\'}, 42]');
	t.is(stringifyObject(array, {inlineCharacterLimit: 33}), '[\n\t\'foo\',\n\t{id: 8, name: \'Jane\'},\n\t42\n]');
});

test('does not mess up indents for complex objects', t => {
	const object = {
		arr: [1, 2, 3],
		nested: {hello: 'world'},
	};

	t.is(stringifyObject(object), '{\n\tarr: [\n\t\t1,\n\t\t2,\n\t\t3\n\t],\n\tnested: {\n\t\thello: \'world\'\n\t}\n}');
	t.is(stringifyObject(object, {inlineCharacterLimit: 12}), '{\n\tarr: [1, 2, 3],\n\tnested: {\n\t\thello: \'world\'\n\t}\n}');
});

test('handles non-plain object', t => {
	// TODO: It should work without `fileURLToPath` but currently it throws for an unknown reason.
	t.not(stringifyObject(fs.statSync(fileURLToPath(import.meta.url))), '[object Object]');
});

test('don\'t stringify non-enumerable symbols', t => {
	const object = {
		[Symbol('for enumerable key')]: undefined,
	};
	const symbol = Symbol('for non-enumerable key');
	Object.defineProperty(object, symbol, {enumerable: false});

	t.is(stringifyObject(object), '{\n\t[Symbol(\'for enumerable key\')]: undefined\n}');
});

test('handle symbols', t => {
	const object = {
		[Symbol('unique')]: Symbol('unique'),
		[Symbol.for('registry')]: [Symbol.for('registry'), 2],
		[Symbol.iterator]: {k: Symbol.iterator},
		[Symbol()]: 'undef', // eslint-disable-line symbol-description
	};
	t.is(stringifyObject(object), '{\n\t[Symbol(\'unique\')]: Symbol(\'unique\'),\n\t[Symbol.for(\'registry\')]: [\n\t\tSymbol.for(\'registry\'),\n\t\t2\n\t],\n\t[Symbol.iterator]: {\n\t\tk: Symbol.iterator\n\t},\n\t[Symbol()]: \'undef\'\n}');

	// Anonymous symbol (no description)
	t.is(stringifyObject(Symbol()), 'Symbol()'); // eslint-disable-line symbol-description

	// Symbol with empty string description
	t.is(stringifyObject(Symbol('')), 'Symbol(\'\')');

	// Symbol.for with empty string
	t.is(stringifyObject(Symbol.for('')), 'Symbol.for(\'\')');

	// Test as object keys
	const emptySymbolKeys = {
		[Symbol()]: 'anonymous', // eslint-disable-line symbol-description
		[Symbol('')]: 'empty string',
		[Symbol.for('')]: 'empty for',
	};
	t.regex(stringifyObject(emptySymbolKeys), /\[Symbol\(\)]/);
	t.regex(stringifyObject(emptySymbolKeys), /\[Symbol\(''\)]/);
	t.regex(stringifyObject(emptySymbolKeys), /\[Symbol\.for\(''\)]/);

	// Symbol escaping with special characters
	const symbolWithSpecialChars = Symbol('a"b\\c\n');
	t.is(stringifyObject(symbolWithSpecialChars), String.raw`Symbol('a"b\\c\n')`);
	t.is(stringifyObject(symbolWithSpecialChars, {singleQuotes: false}), String.raw`Symbol("a\"b\\c\n")`);

	const specialCharKey = {
		[Symbol('a"b\\c\n')]: 'value',
	};
	t.regex(stringifyObject(specialCharKey), /\[Symbol\('a"b\\\\c\\n'\)]/);

	// Well-known symbols
	t.is(stringifyObject(Symbol.iterator), 'Symbol.iterator');
	t.is(stringifyObject(Symbol.hasInstance), 'Symbol.hasInstance');
	t.is(stringifyObject(Symbol.toStringTag), 'Symbol.toStringTag');

	// Look-alike symbols (not real well-known symbols)
	t.is(stringifyObject(Symbol('Symbol.iterator')), 'Symbol(\'Symbol.iterator\')');
	t.is(stringifyObject(Symbol('Symbol.hasInstance')), 'Symbol(\'Symbol.hasInstance\')');
	t.is(stringifyObject(Symbol('Symbol.toStringTag')), 'Symbol(\'Symbol.toStringTag\')');
});

test('should properly escape special characters', t => {
	const s = 'tab: \t newline: \n backslash: \\';
	t.is(stringifyObject(s), String.raw`'tab: \t newline: \n backslash: \\'`);

	const s2 = 'carriage return: \r tab: \t';
	t.is(stringifyObject(s2), String.raw`'carriage return: \r tab: \t'`);

	// Test other escape sequences
	t.is(stringifyObject('\f'), String.raw`'\f'`); // Form feed
	t.is(stringifyObject('\v'), String.raw`'\v'`); // Vertical tab
	t.is(stringifyObject('\b'), String.raw`'\b'`); // Backspace
	t.is(stringifyObject('\0'), String.raw`'\0'`); // Null character

	// Test control characters that need unicode escape
	t.is(stringifyObject(String.fromCodePoint(1)), String.raw`'\u0001'`); // Start of heading
	t.is(stringifyObject(String.fromCodePoint(7)), String.raw`'\u0007'`); // Bell
	t.is(stringifyObject(String.fromCodePoint(27)), String.raw`'\u001b'`); // Escape
	t.is(stringifyObject(String.fromCodePoint(31)), String.raw`'\u001f'`); // Unit separator
	t.is(stringifyObject(String.fromCodePoint(127)), String.raw`'\u007f'`); // Delete

	// Test a string with multiple special characters
	const mixed = 'a\tb\nc\rd\fe\vf\bg\0h' + String.fromCodePoint(1) + 'i';
	t.is(stringifyObject(mixed), String.raw`'a\tb\nc\rd\fe\vf\bg\0h\u0001i'`);
});

test('handle Map objects', t => {
	// Empty Map
	const emptyMap = new Map();
	t.is(stringifyObject(emptyMap), 'new Map()');

	// Map with various types
	const map = new Map([
		['string', 'value'],
		[42, 'number key'],
		[true, 'boolean key'],
		[null, 'null key'],
		[undefined, 'undefined key'],
	]);
	t.is(stringifyObject(map), `new Map([
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
	t.is(stringifyObject(objectMap), `new Map([
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
	t.is(stringifyObject(symbolMap), `new Map([
	[Symbol('test'), 'symbol key'],
	[Symbol.iterator, 'well-known symbol']
])`);

	// Nested Map
	const nestedMap = new Map([
		['inner', new Map([['deep', 'value']])],
	]);
	t.is(stringifyObject(nestedMap), `new Map([
	['inner', new Map([
		['deep', 'value']
	])]
])`);
});

test('handle Set objects', t => {
	// Empty Set
	const emptySet = new Set();
	t.is(stringifyObject(emptySet), 'new Set()');

	// Set with various types
	const set = new Set(['string', 42, true, null, undefined]);
	t.is(stringifyObject(set), `new Set([
	'string',
	42,
	true,
	null,
	undefined
])`);

	// Set with objects
	const objectSet = new Set([{foo: 'bar'}, [1, 2, 3]]);
	t.is(stringifyObject(objectSet), `new Set([
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
	t.is(stringifyObject(nestedSet), `new Set([
	new Set([
		'inner'
	])
])`);
});

test('handle Map and Set with circular references', t => {
	// Circular Map
	const circularMap = new Map();
	circularMap.set('self', circularMap);
	t.regex(stringifyObject(circularMap), /\[Circular]/);

	// Circular Set
	const circularSet = new Set();
	circularSet.add(circularSet);
	t.regex(stringifyObject(circularSet), /\[Circular]/);
});

test('handle edge cases', t => {
	// BigInt
	t.is(stringifyObject(BigInt(123)), '123n');

	// Invalid Date
	const invalidDate = new Date('invalid');
	t.is(stringifyObject(invalidDate), 'new Date(\'Invalid Date\')');

	// Object with numeric keys
	const numericKeys = {};
	numericKeys[123] = 'numeric';
	numericKeys[456] = 'string numeric';
	t.is(stringifyObject(numericKeys), '{\n\t\'123\': \'numeric\',\n\t\'456\': \'string numeric\'\n}');

	// Reserved keywords as keys - quoted for safety
	const reserved = {};
	reserved.class = 'reserved';
	reserved.const = 'keyword';
	reserved.return = 'statement';
	t.is(stringifyObject(reserved), '{\n\t\'class\': \'reserved\',\n\t\'const\': \'keyword\',\n\t\'return\': \'statement\'\n}');
});
