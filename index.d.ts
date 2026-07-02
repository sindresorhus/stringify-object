export type StringifyObjectContext = Record<PropertyKey, unknown>;

export type StringifyObjectTransformContext =
	| StringifyObjectContext
	| readonly unknown[]
	| ReadonlyMap<unknown, unknown>
	| ReadonlySet<unknown>;

export type Options = {
	/**
	Preferred indentation.

	@default '\t'
	*/
	readonly indent?: string;

	/**
	Set to `false` to get double-quoted strings.

	@default true
	*/
	readonly singleQuotes?: boolean;

	/**
	Filter properties from the output.

	Expected to return whether to include the property of the object in the output.
	*/
	readonly filter?: (object: StringifyObjectContext, property: PropertyKey) => boolean;

	/**
	Transform the string that resulted from stringifying `object[property]`.

	This can be used to detect special types of objects that need to be stringified in a particular way.
	*/
	readonly transform?: (
		object: StringifyObjectTransformContext,
		property: unknown,
		originalResult: string,
	) => string;

	/**
	When set, will inline values up to `inlineCharacterLimit` length for the sake of more terse output.
	*/
	readonly inlineCharacterLimit?: number;
};

/**
Stringify an object/array like JSON.stringify just without all the double-quotes.

Circular references will be replaced with `"[Circular]"`.

Object keys are only quoted when necessary, for example, `{'foo-bar': true}`.

An own `__proto__` key is never included in the output, as emitting it would set the prototype instead of creating a property when the output is evaluated.

@example
```
import stringifyObject from 'stringify-object';

const object = {
	foo: 'bar',
	'arr': [1, 2, 3],
	nested: {
		hello: 'world'
	}
};

const pretty = stringifyObject(object, {
	indent: '  ',
	singleQuotes: false
});

console.log(pretty);
//=> '{\\n  foo: "bar",\\n  arr: [\\n    1,\\n    2,\\n    3\\n  ],\\n  nested: {\\n    hello: "world"\\n  }\\n}'
```
*/
export default function stringifyObject(input: unknown, options?: Options): string;
