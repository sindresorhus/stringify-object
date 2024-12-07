import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import stringifyObject from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('stringify an object', t => {
	/* eslint-disable quotes, object-shorthand */
	const object = {
		foo: 'bar \'bar\'',
		foo2: [
			'foo',
			'bar',
			{
				foo: "bar 'bar'",
			},
		],
		'foo-foo': 'bar',
		'2foo': 'bar',
		'@#': "bar",
		$el: 'bar',
		_private: 'bar',
		number: 1,
		boolean: true,
		date: new Date("2014-01-29T22:41:05.665Z"),
		escapedString: "\"\"",
		null: null,
		undefined: undefined,
		fn: function fn() {}, // eslint-disable-line func-names
		regexp: /./,
		NaN: Number.NaN,
		Infinity: Number.POSITIVE_INFINITY,
		newlines: "foo\nbar\r\nbaz",
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
		stringifyObject({foo: 'a \' b \' c \\\' d'}, {singleQuotes: true}),
		'{\n\tfoo: \'a \\\' b \\\' c \\\\\\\' d\'\n}',
	);
});

test('string escaping works properly', t => {
	t.is(stringifyObject('\\', {singleQuotes: true}), '\'\\\\\''); // \
	t.is(stringifyObject('\\\'', {singleQuotes: true}), '\'\\\\\\\'\''); // \'
	t.is(stringifyObject('\\"', {singleQuotes: true}), '\'\\\\"\''); // \"
	t.is(stringifyObject('\\', {singleQuotes: false}), '"\\\\"'); // \
	t.is(stringifyObject('\\\'', {singleQuotes: false}), '"\\\\\'"'); // \'
	t.is(stringifyObject('\\"', {singleQuotes: false}), '"\\\\\\""'); // \"
	/* eslint-disable no-eval */
	t.is(eval(stringifyObject('\\\'')), '\\\'');
	t.is(eval(stringifyObject('\\\'', {singleQuotes: false})), '\\\'');
	/* eslint-enable */
	// Regression test for #40
	t.is(stringifyObject("a'a"), '\'a\\\'a\''); // eslint-disable-line quotes
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
		[Symbol()]: 'undef'
	};
	t.is(stringifyObject(object), '{\n\t[Symbol(\'unique\')]: Symbol(\'unique\'),\n\t[Symbol.for(\'registry\')]: [\n\t\tSymbol.for(\'registry\'),\n\t\t2\n\t],\n\t[Symbol.iterator]: {\n\t\tk: Symbol.iterator\n\t},\n\t[Symbol()]: \'undef\'\n}');
});
