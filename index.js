import isRegexp from 'is-regexp';
import isObject from 'is-obj';
import getOwnEnumerableKeys from 'get-own-enumerable-keys';
import isIdentifier from 'is-identifier';

const CHARACTER_ESCAPES = {
	'\n': String.raw`\n`,
	'\r': String.raw`\r`,
	'\t': String.raw`\t`,
	'\b': String.raw`\b`,
	'\f': String.raw`\f`,
	'\v': String.raw`\v`,
	'\0': String.raw`\0`,
};

export default function stringifyObject(input, options, pad) {
	const seen = [];

	return (function stringify(input, options = {}, pad = '') {
		const indent = options.indent || '\t';

		let tokens;
		if (options.inlineCharacterLimit === undefined) {
			tokens = {
				newline: '\n',
				newlineOrSpace: '\n',
				pad,
				indent: pad + indent,
			};
		} else {
			tokens = {
				newline: '@@__STRINGIFY_OBJECT_NEW_LINE__@@',
				newlineOrSpace: '@@__STRINGIFY_OBJECT_NEW_LINE_OR_SPACE__@@',
				pad: '@@__STRINGIFY_OBJECT_PAD__@@',
				indent: '@@__STRINGIFY_OBJECT_INDENT__@@',
			};
		}

		const expandWhiteSpace = string => {
			if (options.inlineCharacterLimit === undefined) {
				return string;
			}

			const oneLined = string
				.replaceAll(tokens.newline, '')
				.replaceAll(tokens.newlineOrSpace, ' ')
				.replaceAll(tokens.pad, '')
				.replaceAll(tokens.indent, '');

			if (oneLined.length <= options.inlineCharacterLimit) {
				return oneLined;
			}

			return string
				.replaceAll(tokens.newline, '\n')
				.replaceAll(tokens.newlineOrSpace, '\n')
				.replaceAll(tokens.pad, pad)
				.replaceAll(tokens.indent, pad + indent);
		};

		if (seen.includes(input)) {
			return '"[Circular]"';
		}

		const type = typeof input;

		if (
			input === null
			|| input === undefined
			|| type === 'number'
			|| type === 'boolean'
			|| type === 'function'
			|| isRegexp(input)
		) {
			return String(input);
		}

		if (type === 'bigint') {
			return String(input) + 'n';
		}

		if (type === 'symbol') {
			const {description} = input;

			if (description === undefined) {
				return 'Symbol()';
			}

			// Check for well-known symbols first
			if (description?.startsWith('Symbol.') && Symbol[description.slice(7)] === input) {
				return description;
			}

			// Check if it's a global registry symbol
			const globalKey = Symbol.keyFor(input);
			if (globalKey !== undefined) {
				return `Symbol.for(${stringify(globalKey, options)})`;
			}

			return `Symbol(${stringify(description, options)})`;
		}

		if (input instanceof Date) {
			return Number.isNaN(input.getTime())
				? 'new Date(\'Invalid Date\')'
				: `new Date('${input.toISOString()}')`;
		}

		if (input instanceof Map || input instanceof Set) {
			const isMap = input instanceof Map;
			const name = isMap ? 'Map' : 'Set';

			if (input.size === 0) {
				return `new ${name}()`;
			}

			seen.push(input);

			const items = [...input].map(item => {
				if (isMap) {
					const [key, value] = item;
					return tokens.indent + `[${stringify(key, options, pad + indent)}, ${stringify(value, options, pad + indent)}]`;
				}

				return tokens.indent + stringify(item, options, pad + indent);
			}).join(',' + tokens.newlineOrSpace);

			seen.pop();

			return expandWhiteSpace(`new ${name}([${tokens.newline}${items}${tokens.newline}${tokens.pad}])`);
		}

		if (Array.isArray(input)) {
			if (input.length === 0) {
				return '[]';
			}

			seen.push(input);

			const items = input.map((element, index) => {
				let value = stringify(element, options, pad + indent);
				if (options.transform) {
					value = options.transform(input, index, value);
				}

				return tokens.indent + value;
			}).join(',' + tokens.newlineOrSpace);

			seen.pop();

			return expandWhiteSpace(`[${tokens.newline}${items}${tokens.newline}${tokens.pad}]`);
		}

		if (isObject(input)) {
			let objectKeys = getOwnEnumerableKeys(input);

			if (options.filter) {
				// eslint-disable-next-line unicorn/no-array-callback-reference, unicorn/no-array-method-this-argument
				objectKeys = objectKeys.filter(element => options.filter(input, element));
			}

			if (objectKeys.length === 0) {
				return '{}';
			}

			seen.push(input);

			const pairs = objectKeys.map(element => {
				const isSymbol = typeof element === 'symbol';

				let key;
				if (isSymbol) {
					key = `[${stringify(element, options)}]`;
				} else if (isIdentifier(element)) {
					key = element;
				} else {
					key = stringify(element, options);
				}

				let value = stringify(input[element], options, pad + indent);
				if (options.transform) {
					value = options.transform(input, element, value);
				}

				return tokens.indent + key + ': ' + value;
			}).join(',' + tokens.newlineOrSpace);

			seen.pop();

			return expandWhiteSpace(`{${tokens.newline}${pairs}${tokens.newline}${tokens.pad}}`);
		}

		// String escaping
		const stringified = String(input)
			.replaceAll('\\', '\\\\')
			// eslint-disable-next-line no-control-regex
			.replaceAll(/[\u0000-\u001F\u007F]/g, x =>
				CHARACTER_ESCAPES[x] ?? `\\u${x.codePointAt(0).toString(16).padStart(4, '0')}`);

		if (options.singleQuotes === false) {
			return `"${stringified.replaceAll('"', String.raw`\"`)}"`;
		}

		return `'${stringified.replaceAll('\'', String.raw`\'`)}'`;
	})(input, options, pad);
}
