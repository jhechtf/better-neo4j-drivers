import { describe, expect, it } from 'vitest';
import { Packstream } from './packstream';
import {
	BYTE_TYPES,
	INT_TYPES,
	LIST_TYPES,
	STRING_TYPES,
	NULL_MARKER,
	FLOAT_MARKER,
	DICT_TYPES,
	STRUCTURES,
} from './markers';
import {
	DateTime,
	Duration,
	PackstreamDate,
	PackstreamNode,
} from './structures';

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

		expect(p.unpackageNumber(p.packageNumber(9000))).toBe(9000);

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

		expect(p.unpackageBytes(p.packageBytes(Uint8Array.from([])))).toStrictEqual(
			Uint8Array.from([]),
		);
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
		const mixedLists = [1, 2.1, ['three']];
		expect(p.unpackageList(p.packageList(mixedLists))).toStrictEqual(
			mixedLists,
		);

		const listsWithDicts = [{ a: 1, b: 'three' }, 2.1, null];
		expect(p.unpackageList(p.packageList(listsWithDicts))).toStrictEqual(
			listsWithDicts,
		);
	});

	describe('Dictionaries', () => {
		it('Works with empty dictionaries', () => {
			// Basic ones
			expect(p.packageDict({})).toStrictEqual(
				Uint8Array.from([DICT_TYPES.TINY_DICT]),
			);
		});

		it('Works with small dictionaries', () => {
			expect(p.packageDict({ one: 'eins' })).toStrictEqual(
				Uint8Array.from([
					0xa1, 0x83, 0x6f, 0x6e, 0x65, 0x84, 0x65, 0x69, 0x6e, 0x73,
				]),
			);
		});

		it('Works with 8-bit dictionaries of the same type', () => {
			const alphaBetNumbers = Array.from({ length: 26 }, (_, i) => i + 1);
			const alphabetObj = Object.fromEntries(
				alphaBetNumbers.map((v) => [String.fromCharCode(v + 64), v]),
			);
			expect(p.packageDict({ A: 1 })).toStrictEqual(
				Uint8Array.from([161, 0x81, 0x41, 0x01]),
			);
			expect(p.packageDict(alphabetObj)).toStrictEqual(
				Uint8Array.from([
					0xd8, 0x1a, 0x81, 0x41, 0x01, 0x81, 0x42, 0x02, 0x81, 0x43, 0x03,
					0x81, 0x44, 0x04, 0x81, 0x45, 0x05, 0x81, 0x46, 0x06, 0x81, 0x47,
					0x07, 0x81, 0x48, 0x08, 0x81, 0x49, 0x09, 0x81, 0x4a, 0x0a, 0x81,
					0x4b, 0x0b, 0x81, 0x4c, 0x0c, 0x81, 0x4d, 0x0d, 0x81, 0x4e, 0x0e,
					0x81, 0x4f, 0x0f, 0x81, 0x50, 0x10, 0x81, 0x51, 0x11, 0x81, 0x52,
					0x12, 0x81, 0x53, 0x13, 0x81, 0x54, 0x14, 0x81, 0x55, 0x15, 0x81,
					0x56, 0x16, 0x81, 0x57, 0x17, 0x81, 0x58, 0x18, 0x81, 0x59, 0x19,
					0x81, 0x5a, 0x1a,
				]),
			);
			expect(p.unpackageDict(p.packageDict({ A: 1 }))).toStrictEqual({ A: 1 });
			expect(p.unpackageDict(p.packageDict(alphabetObj))).toStrictEqual(
				alphabetObj,
			);
		});

		it('Works with more complicated dictionaries', () => {
			const nestedObj = {
				a: 1,
				b: 2,
				c: [1, 2, 3],
			};

			expect(p.unpackageDict(p.packageDict(nestedObj))).toStrictEqual(
				nestedObj,
			);

			const dictsWithDict = {
				a: 'a',
				b: 'hello',
				c: {
					d: 'music',
					e: 'era',
				},
			};

			expect(p.unpackageDict(p.packageDict(dictsWithDict))).toStrictEqual(
				dictsWithDict,
			);
		});

		it('Works with large dictionaries', () => {
			const largeDictEntries = Array.from({ length: 256 }, (_, i) => [
				i.toString(),
				i,
			]);
			const obj = Object.fromEntries(largeDictEntries);
			expect(p.unpackageDict(p.packageDict(obj))).toStrictEqual(obj);
		});

		it('Works with dictionaries that have booleans', () => {
			const obj = {
				a: true,
			};
			expect(p.unpackageDict(p.packageDict(obj))).toStrictEqual(obj);
		});

		it('Works with dictionaries that have mixed types', () => {
			const obj = {
				list: [1, 2, 3.4],
				name: 'string',
				age: 24,
				what: null,
				dead: false,
				date: '2020-04-50T00:00:01',
			};

			expect(p.unpackageDict(p.packageDict(obj))).toStrictEqual(obj);
		});

		it('Works with nested dictionaries', () => {
			const obj = {
				a: {
					b: 1,
				},
				c: '2',
				d: {
					e: ['f'],
				},
			};
			expect(p.unpackageDict(p.packageDict(obj))).toStrictEqual(obj);
		});

		it('Works with dictionaries that have a raw Uint8Array', () => {
			const obj = {
				raw: Uint8Array.from([1, 2, 3]),
			};
			expect(p.unpackageDict(p.packageDict(obj))).toStrictEqual(obj);
		});
	});

	describe('Structures', () => {
		describe('Nodes', () => {
			it('Packages Nodes correctly', () => {
				const b = new PackstreamNode(1, {}, ['User'], '1');
				const node = p.packageStructure(b);
				const dict = p.packageDict(b as unknown as Record<string, unknown>);
				const raw = Uint8Array.from([0xb4, 0x4e, ...dict]);

				expect(node).toStrictEqual(raw);
			});

			it('Unpackages Nodes correctly', () => {
				const node = new PackstreamNode(1, {}, ['Test'], '1');
				const packaged = p.packageStructure(node);
				const unpackaged = p.unpackageStructure(packaged);
				expect(unpackaged).toHaveProperty('id');
				expect(unpackaged).toStrictEqual(node);

				const otherNode = new PackstreamNode(
					10,
					{
						a: 'something',
						b: 3,
						c: [null, 'three'],
					},
					['Test', 'Bob'],
					'abcdef',
				);
				const otherPackaged = p.packageStructure(otherNode);
				const unpackagedOther = p.unpackageStructure(otherPackaged);
				expect(unpackagedOther).toStrictEqual(otherNode);
			});
		});
		describe('Dates', () => {
			it('Packages dates correctly', () => {
				const dateObj = new PackstreamDate(1);
				const dateDict = p.packageDict({ days: 1 });
				const packagedDate = p.packageStructure(dateObj);
				const rawBytes = Uint8Array.from([
					STRUCTURES.TINY_STRUCT + 1,
					STRUCTURES.DATE,
					...dateDict,
				]);

				expect(packagedDate).toStrictEqual(rawBytes);
			});

			it('Unpackages dates correctly', () => {
				const packstreamDate = new PackstreamDate(1);
				const packagedDate = p.packageStructure(packstreamDate);
				expect(p.unpackageStructure(packagedDate)).toStrictEqual(
					packstreamDate,
				);
			});
		});

		describe('DateTime', () => {
			it('Packages DateTimes correctly', () => {
				const datetime = new DateTime(0, 0, 3600);
				const packagedDt = p.packageStructure(datetime);
				const packagedDtDict = p.packageDict({
					seconds: 0,
					nanoseconds: 0,
					tz_offset_seconds: 3600,
				} satisfies DateTime);

				const rawBytes = Uint8Array.from([
					STRUCTURES.TINY_STRUCT + 3,
					STRUCTURES.DATE_TIME,
					...packagedDtDict,
				]);

				expect(packagedDt).toStrictEqual(rawBytes);
			});
		});

		describe('Duration', () => {
			it('Packages durations correctly', () => {
				const duration = new Duration(0, 0, 0, 0);
				const packagedDuration = p.packageStructure(duration);
				const packagedDict = p.packageDict(
					duration as unknown as Record<string, unknown>,
				);

				const raw = Uint8Array.from([
					STRUCTURES.TINY_STRUCT + 4,
					STRUCTURES.DURATION,
					...packagedDict,
				]);

				expect(packagedDuration).toStrictEqual(raw);
			});
			it('Unpackages durations correctly', () => {
				const duration = new Duration(1, 2, 3, 4);
				const packagedDuration = p.packageStructure(duration);
				expect(p.unpackageStructure(packagedDuration)).toStrictEqual(duration);
			});
		});
	});

	describe('getTotalBytes', () => {
		describe('Numbers', () => {
			it('gets the correct amount of bytes for positive numbers', () => {
				expect(p.getTotalBytes(p.packageNumber(15))).toBe(1);
				expect(p.getTotalBytes(p.packageNumber(200))).toBe(3);
				expect(p.getTotalBytes(p.packageNumber(32_767))).toBe(3);
				expect(p.getTotalBytes(p.packageNumber(32_768))).toBe(5);
				expect(p.getTotalBytes(p.packageNumber(2_147_483_648))).toBe(9);
			});
			it('gets the correct amount of bytes for negative numbers', () => {
				expect(p.getTotalBytes(p.packageNumber(-16))).toBe(1);
				expect(
					p.getTotalBytes(p.packageNumber(-9_223_372_036_854_775_80n)),
				).toBe(9);
				expect(p.getTotalBytes(p.packageNumber(-2_147_483_648))).toBe(5);
				expect(p.getTotalBytes(p.packageNumber(-32_768))).toBe(3);
				expect(p.getTotalBytes(p.packageNumber(-128))).toBe(2);
			});
		});

		describe('Strings', () => {
			it('Works for tiny strings', () => {
				const strings = Array.from({ length: 16 }, (_, i) => 'a'.repeat(i));

				for (
					let i = 0, s = strings[i];
					strings[i] !== undefined;
					s = strings[++i]
				) {
					expect(p.getTotalBytes(p.packageString(s))).toBe(i + 1);
				}
			});

			it('Works with 8 bit strings', () => {
				const a26 = p.packageString('a'.repeat(26));
				expect(p.getTotalBytes(a26)).toBe(a26.byteLength);
				expect(p.getTotalBytes(p.packageString('a'.repeat(255)))).toBe(257);
			});

			it('Works with 16 bit strings', () => {
				expect(p.getTotalBytes(p.packageString('a'.repeat(256)))).toBe(259);
				expect(p.getTotalBytes(p.packageString('a'.repeat(65_535)))).toBe(
					65_538,
				);
			});

			it('Works with 32 bit strings', () => {
				expect(p.getTotalBytes(p.packageString('a'.repeat(65_536)))).toBe(
					65_541,
				);
			});
		});

		describe('Floats', () => {
			it('Works for floats', () => {
				expect(p.getTotalBytes(p.packageFloat(2.1))).toBe(9);
			});
		});

		describe('Bytes', () => {
			it('Works for empty byte arrays', () => {
				expect(p.getTotalBytes(p.packageBytes(Uint8Array.from([])))).toBe(2);
			});

			it('Works for 8-bit byte arrays', () => {
				expect(
					p.getTotalBytes(
						p.packageBytes(Uint8Array.from(Array.from({ length: 1 }, () => 0))),
					),
				).toBe(3);
				expect(
					p.getTotalBytes(
						p.packageBytes(
							Uint8Array.from(Array.from({ length: 255 }, () => 0)),
						),
					),
				).toBe(257);
			});

			it('Works for 16-bit byte arrays', () => {
				expect(
					p.getTotalBytes(
						p.packageBytes(
							Uint8Array.from(Array.from({ length: 256 }, () => 0)),
						),
					),
				).toBe(259);
				expect(
					p.getTotalBytes(
						p.packageBytes(
							Uint8Array.from(Array.from({ length: 65535 }, () => 0)),
						),
					),
				).toBe(65538);
			});

			it('Works for 32-bit byte arrays', () => {
				expect(
					p.getTotalBytes(
						p.packageBytes(
							Uint8Array.from(Array.from({ length: 65536 }, () => 0)),
						),
					),
				).toBe(65541);
			});
		});

		describe('Booleans', () => {
			it('Works for booleans', () => {
				expect(p.getTotalBytes(p.packageBoolean(true))).toBe(1);
				expect(p.getTotalBytes(p.packageBoolean(false))).toBe(1);
			});
		});

		it('Works for null', () => {
			expect(p.getTotalBytes(p.packageNull())).toBe(1);
		});

		describe('Works for lists', () => {
			it('Works for small lists', () => {
				expect(p.getTotalBytes(p.packageList([1]))).toBe(2);
				expect(p.getTotalBytes(p.packageList([1, 2, 3]))).toBe(4);
				expect(p.getTotalBytes(p.packageList(['a', 'b', 'c']))).toBe(7);
				expect(p.getTotalBytes(p.packageList(['one', 'two', 'three']))).toBe(
					15,
				);
			});

			it('Works for 8-bit sized lists', () => {
				expect(
					p.getTotalBytes(p.packageList(Array.from({ length: 16 }, () => 0))),
				).toBe(18);
				expect(
					p.getTotalBytes(p.packageList(Array.from({ length: 255 }, () => 0))),
				).toBe(257);
				const stringArr = Array.from({ length: 100 }, () => 'a');
				const packagedString = p.packageList(stringArr);
				expect(p.getTotalBytes(packagedString)).toBe(packagedString.byteLength);
			});

			it('Works for 16-bit sized lists', () => {
				expect(
					p.getTotalBytes(p.packageList(Array.from({ length: 256 }, () => 0))),
				).toBe(259);
				expect(
					p.getTotalBytes(
						p.packageList(Array.from({ length: 65_535 }, () => 0)),
					),
				).toBe(65_538);
			});

			it('Works for 32-bit sized lists', () => {
				expect(
					p.getTotalBytes(
						p.packageList(Array.from({ length: 65_536 }, () => 0)),
					),
				).toBe(65_541);
			});

			it('Works for lists of varying types', () => {
				const list = ['hello', { a: 1 }, null];
				expect(p.unpackageList(p.packageList(list))).toStrictEqual(list);
			});

			it('Works on dumbass lists', () => {
				const list = p.packageList([1, { a: 2 }, null]);
				expect(p.getTotalBytes(list)).toBe(list.byteLength);
			});
		});

		describe('Works for dicts', () => {
			it('Works for small dictionaries', () => {
				expect(p.getTotalBytes(p.packageDict({ a: 1 }))).toBe(
					p.packageDict({ a: 1 }).byteLength,
				);
			});

			it('Works for 8-bit dictionaries', () => {
				const obj = Object.fromEntries(
					Array.from({ length: 255 }, (_, i) => [`${i}`, i]),
				);
				const packedObj = p.packageDict(obj);
				expect(p.getTotalBytes(packedObj)).toBe(packedObj.byteLength);
			});

			it('Works for 16-bit dictionaries', () => {
				const obj = Object.fromEntries(
					Array.from({ length: 256 }, (_, i) => [`${i}`, i]),
				);
				const packed = p.packageDict(obj);
				expect(p.getTotalBytes(packed)).toBe(packed.byteLength);
			});

			it('Works for 32-bit dictionaries', () => {
				const obj = Object.fromEntries(
					Array.from({ length: 65_536 }, (_, i) => [`${i}`, i]),
				);
				const packed = p.packageDict(obj);
				expect(p.getTotalBytes(packed)).toBe(packed.byteLength);
			});

			// const largeObj = Object.fromEntries(

			// )
		});
	});
});
