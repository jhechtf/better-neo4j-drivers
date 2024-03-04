import { describe, expect, it } from 'vitest';
import { Packstream } from './packstream';
import {
	BYTE_TYPES,
	INT_TYPES,
	LIST_TYPES,
	STRING_TYPES,
	NULL_MARKER,
	DICT_BASE,
	FLOAT_MARKER,
	DICT_TYPES,
} from './markers';

describe('Packstream class', () => {
	const p = new Packstream();
	it('Works with booleans', () => {
		expect(p.packageBoolean(true)).toStrictEqual(Uint8Array.from([0xc3]));
		expect(p.packageBoolean(false)).toStrictEqual(Uint8Array.from([0xc2]));
		expect(p.unpackageBoolean(p.packageBoolean(true))).toBe(true);
		expect(p.unpackageBoolean(p.packageBoolean(false))).toBe(false);
		expect(() => p.unpackageBoolean(Uint8Array.from([0xc3, 0]))).toThrow();
	});

	it('Works with strings', () => {
		expect(p.unpackageString(p.packageString('hello'))).toBe('hello');
		expect(p.unpackageString(p.packageString('a'.repeat(15)))).toBe(
			'a'.repeat(15),
		);
		expect(
			p.unpackageString(p.packageString('ABCDEFGHIJKLMNOPQRSTUVWXYZ')),
		).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
		expect(p.unpackageString(p.packageString('Größenmaßstäbe'))).toBe(
			'Größenmaßstäbe',
		);
		expect(p.packageString('a')).toStrictEqual(
			Uint8Array.from([STRING_TYPES.TINY_STRING + 1, 97]),
		);
		expect(p.getByteLength(p.package('a'.repeat(65_536)))).toBe(65_536);
		expect(p.getByteLength(p.packageString('a'.repeat(256)))).toBe(256);
	});

	it('Works with integers', () => {
		const tinyInts = Array.from({ length: 143 }, (_, i) => i - 16);

		for (const ti of tinyInts) {
			expect(p.unpackageNumber(p.packageNumber(ti))).toBe(ti);
		}

		expect(p.packageNumber(42, INT_TYPES.INT_8)).toStrictEqual(
			Uint8Array.from([0xc8, 0x2a]),
		);
		expect(p.packageNumber(42, INT_TYPES.INT_16)).toStrictEqual(
			Uint8Array.from([INT_TYPES.INT_16, 0, 42]),
		);
		expect(p.packageNumber(42, INT_TYPES.INT_32)).toStrictEqual(
			Uint8Array.from([INT_TYPES.INT_32, 0, 0, 0, 42]),
		);

		expect(p.packageNumber(42, INT_TYPES.INT_64)).toStrictEqual(
			Uint8Array.from([
				INT_TYPES.INT_64,
				...Array.from({ length: 7 }, () => 0),
				42,
			]),
		);

		expect(p.unpackageNumber(p.packageNumber(42))).toBe(42);
		expect(p.unpackageNumber(p.packageNumber(-16))).toBe(-16);

		expect(p.packageNumber(0b1111111)).toStrictEqual(
			Uint8Array.from([0b1111111]),
		);
		expect(p.unpackageNumber(p.packageNumber(128))).toBe(128);

		expect(p.unpackageNumber(p.packageNumber(32767))).toBe(32767);
		expect(p.unpackageNumber(p.packageNumber(32768))).toBe(32768);

		expect(p.packageNumber(-9223372036854775808n)).toStrictEqual(
			Uint8Array.from([0xcb, 0x80, 0, 0, 0, 0, 0, 0, 0]),
		);
		expect(p.packageNumber(9223372036854775807n)).toStrictEqual(
			Uint8Array.from([0xcb, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
		);

		expect(p.packageNumber(-2_147_483_649n)).toStrictEqual(
			Uint8Array.from([0xcb, 255, 255, 255, 255, 127, 255, 255, 255]),
		);
		expect(p.unpackageNumber(p.packageNumber(-2_147_483_649n))).toBe(
			-2_147_483_649n,
		);
		expect(p.unpackageNumber(p.packageNumber(9223372036854775807n))).toBe(
			9223372036854775807n,
		);
		expect(p.unpackageNumber(p.packageNumber(2_147_483_648n))).toBe(
			2_147_483_648n,
		);
		expect(p.unpackageNumber(p.packageNumber(2_147_483_648), 'string')).toBe(
			'2147483648n',
		);
	});

	it('Works with floats', () => {
		describe('Packaging works as expected', () => {
			expect(p.packageFloat(1.23)).toStrictEqual(
				Uint8Array.from([0xc1, 0x3f, 0xf3, 0xae, 0x14, 0x7a, 0xe1, 0x47, 0xae]),
			);
		});

		expect(p.unpackageFloat(p.packageFloat(1.23))).toBe(1.23);
		expect(p.unpackageFloat(p.packageFloat(5.1))).toBe(5.1);
	});

	it('Works with raw bytes', () => {
		const muchBytes = Array.from({ length: 256 }, () => 0);
		expect(p.packageBytes(Uint8Array.from([1, 2, 3]))).toStrictEqual(
			Uint8Array.from([BYTE_TYPES.BYTE_8, 0x3, 1, 2, 3]),
		);

		expect(p.packageBytes(Uint8Array.from(muchBytes))).toStrictEqual(
			Uint8Array.from([BYTE_TYPES.BYTE_16, 1, 0, ...muchBytes]),
		);

		expect(p.getByteLength(p.packageBytes(Uint8Array.from(muchBytes)))).toBe(
			256,
		);
		expect(
			p.unpackageBytes(p.packageBytes(Uint8Array.from([1, 2, 3]))),
		).toStrictEqual(Uint8Array.from([1, 2, 3]));
		expect(
			p.unpackageBytes(p.packageBytes(Uint8Array.from(muchBytes))),
		).toStrictEqual(Uint8Array.from(muchBytes));

		expect(
			p.unpackageBytes(p.packageBytes(Uint8Array.from([])))
		).toStrictEqual(Uint8Array.from([]));
	});

	it('Works with lists', () => {
		// Empty list
		expect(p.packageList([])).toStrictEqual(
			Uint8Array.from([LIST_TYPES.LIST_BASE]),
		);
		// List with a few items
		expect(p.getByteLength(p.packageList([]))).toBe(0);

		expect(p.packageList([1, 2.1, 'three', 4n])).toStrictEqual(
			Uint8Array.from([
				LIST_TYPES.LIST_BASE + 4,
				1,
				193,
				64,
				0,
				204,
				204,
				204,
				204,
				204,
				205,
				133,
				116,
				104,
				114,
				101,
				101,
				203,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				4,
			]),
		);
		// Empty list
		expect(p.unpackageList(p.packageList([]))).toStrictEqual([]);
		// List with a few items
		expect(p.unpackageList(p.packageList([1, 2, 3]))).toStrictEqual([1, 2, 3]);
		// List with a single item
		expect(p.unpackageList(p.packageList([128]))).toStrictEqual([128]);
		// TODO: move this to the correct space
		expect(p.unpackage(p.packageNumber(-2_147_483_649n))).toBe(-2_147_483_649n);
		// list with 3 items of different types
		expect(p.unpackageList(p.packageList([1, 2.1, 'three']))).toHaveLength(3);
		expect(p.unpackageList(p.packageList([1, 2.1, 'three']))).toStrictEqual([
			1,
			2.1,
			'three',
		]);

		// list with raw byte entries

		expect(
			p.unpackageList(p.packageList([Uint8Array.from([0])])),
		).toStrictEqual([Uint8Array.from([0])]);
		expect(
			p.unpackageList(p.packageList([1, 2.1, Uint8Array.from([])])),
		).toStrictEqual([1, 2.1, Uint8Array.from([])]);

		// Lists with null
		expect(p.unpackageList(p.packageList([null, 1]))).toStrictEqual([null, 1]);

		// TODO: Add tests for dicts / structures
	});

	it('Dictionaries', () => {
		// Basic ones
		expect(p.packageDict({})).toStrictEqual(Uint8Array.from([DICT_TYPES.TINY_DICT]));
		expect(p.packageDict({ one: 'eins'})).toStrictEqual(Uint8Array.from([0xA1, 0x83, 0x6F, 0x6E, 0x65, 0x84, 0x65, 0x69, 0x6E, 0x73]));
		// Something something
		const alphaBetNumbers = Array.from({ length: 26 }, (_, i) => i + 1);
		const alphabetObj = Object.fromEntries(
			alphaBetNumbers.map(v => [String.fromCharCode(v + 64), v])
		);
		expect(p.packageDict({A: 1})).toStrictEqual(Uint8Array.from([
			161, 0x81, 0x41, 0x01
		]))
		expect(p.packageDict(alphabetObj)).toStrictEqual(Uint8Array.from([
			0xD8, 0x1A,
			0x81, 0x41, 0x01, 0x81, 0x42, 0x02, 0x81, 0x43, 0x03, 0x81, 0x44, 0x04,
			0x81, 0x45, 0x05, 0x81, 0x46, 0x06, 0x81, 0x47, 0x07, 0x81, 0x48, 0x08,
			0x81, 0x49, 0x09, 0x81, 0x4A, 0x0A, 0x81, 0x4B, 0x0B, 0x81, 0x4C, 0x0C,
			0x81, 0x4D, 0x0D, 0x81, 0x4E, 0x0E, 0x81, 0x4F, 0x0F, 0x81, 0x50, 0x10,
			0x81, 0x51, 0x11, 0x81, 0x52, 0x12, 0x81, 0x53, 0x13, 0x81, 0x54, 0x14,
			0x81, 0x55, 0x15, 0x81, 0x56, 0x16, 0x81, 0x57, 0x17, 0x81, 0x58, 0x18,
			0x81, 0x59, 0x19, 0x81, 0x5A, 0x1A
		]));

		expect(p.unpackage(Uint8Array.from([1]))).toBe(1);

		// expect(p.unpackageDict(p.packageDict({ A: 1 }))).toStrictEqual({ A: 1 });
		expect(p.unpackageDict(p.packageDict(alphabetObj))).toStrictEqual(alphabetObj);
	});
});
