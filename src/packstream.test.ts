import { describe, expect, it} from 'vitest';
import { Packstream } from './packstream';
import { BYTE_TYPES, INT_TYPES, LIST_TYPES, STRING_TYPES, NULL_MARKER, DICT_BASE, FLOAT_MARKER } from './markers';

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
    expect(p.unpackageString(p.packageString('a'.repeat(15)))).toBe('a'.repeat(15));
    expect(p.unpackageString(p.packageString('ABCDEFGHIJKLMNOPQRSTUVWXYZ'))).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(p.unpackageString(p.packageString('Größenmaßstäbe'))).toBe('Größenmaßstäbe');
    expect(p.packageString('a')).toStrictEqual(Uint8Array.from([
      STRING_TYPES.TINY_STRING + 1, 97
    ]));
    expect(p.getByteLength(p.package('a'.repeat(65_536)))).toBe(65_536);
    expect(p.getByteLength(p.packageString('a'.repeat(256)))).toBe(256);
  });

  it('Works with integers', () => {
    const tinyInts = Array.from({ length: 143 }, (_,i) => i - 16);

    for(const ti of tinyInts) {
      expect(p.unpackageNumber(p.packageNumber(ti))).toBe(ti);
    }

    expect(p.packageNumber(42, INT_TYPES.INT_8)).toStrictEqual(Uint8Array.from([0xc8,0x2a]));
    expect(p.packageNumber(42, INT_TYPES.INT_16)).toStrictEqual(Uint8Array.from([INT_TYPES.INT_16, 0, 42]));
    expect(p.packageNumber(42, INT_TYPES.INT_32)).toStrictEqual(Uint8Array.from([INT_TYPES.INT_32, 0, 0, 0, 42]))

    expect(
      p.packageNumber(42, INT_TYPES.INT_64)
    )
      .toStrictEqual(Uint8Array.from([INT_TYPES.INT_64, ...Array.from({ length: 7}, () => 0), 42]));

    expect(p.unpackageNumber(p.packageNumber(42))).toBe(42);
    expect(p.unpackageNumber(p.packageNumber(-16))).toBe(-16);

    expect(p.packageNumber(0b1111111)).toStrictEqual(Uint8Array.from([0b1111111]));
    expect(p.unpackageNumber(p.packageNumber(128))).toBe(128);

    expect(p.unpackageNumber(p.packageNumber(32767))).toBe(32767);
    expect(p.unpackageNumber(p.packageNumber(32768))).toBe(32768);

    expect(p.packageNumber(-9223372036854775808n)).toStrictEqual(Uint8Array.from([0xcb, 0x80, 0, 0, 0, 0, 0, 0, 0]));
    expect(p.packageNumber(9223372036854775807n)).toStrictEqual(Uint8Array.from([0xcb, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]));

    expect(p.packageNumber(-2_147_483_649n)).toStrictEqual(Uint8Array.from([0xcb, 255, 255, 255, 255, 127, 255, 255, 255]));
    expect(p.unpackageNumber(p.packageNumber(-2_147_483_649n))).toBe(-2_147_483_649n);
    expect(p.unpackageNumber(p.packageNumber(9223372036854775807n))).toBe(9223372036854775807n);
    expect(p.unpackageNumber(p.packageNumber(2_147_483_648n))).toBe(2_147_483_648n);
    expect(p.unpackageNumber(p.packageNumber(2_147_483_648), 'string')).toBe('2147483648n');
  });

  it('Works with floats', () => {
    describe('Packaging works as expected', () => {
      expect(p.packageFloat(1.23)).toStrictEqual(Uint8Array.from([0xc1, 0x3f, 0xf3, 0xae, 0x14, 0x7a, 0xe1, 0x47, 0xae]));
    });

    expect(p.unpackageFloat(p.packageFloat(1.23))).toBe(1.23);
    expect(p.unpackageFloat(p.packageFloat(5.10))).toBe(5.10);
  });

  it('Works with raw bytes', () => {
    const muchBytes = Array.from({ length: 256 }, () => 0);
    expect(p.packageBytes(Uint8Array.from([1,2,3]))).toStrictEqual(Uint8Array.from(
      [BYTE_TYPES.BYTE_8, 0x3, 1, 2, 3]
    ));

    expect(p.packageBytes(Uint8Array.from(muchBytes))).toStrictEqual(
      Uint8Array.from([
        BYTE_TYPES.BYTE_16, 1, 0, ...muchBytes
      ])
    );
    expect(p.getByteLength(p.packageBytes(Uint8Array.from(muchBytes)))).toBe(256);
    expect(p.unpackageBytes(p.packageBytes(Uint8Array.from([1,2,3])))).toStrictEqual(Uint8Array.from([1,2,3]));
    expect(p.unpackageBytes(p.packageBytes(Uint8Array.from(muchBytes)))).toStrictEqual(Uint8Array.from(muchBytes));
  });

  it('Works with lists', () => {
    // Empty list
    expect(p.packageList([])).toStrictEqual(Uint8Array.from([LIST_TYPES.LIST_BASE]));
    // List with a few items
    expect(p.getByteLength(p.packageList([]))).toBe(0);

    expect(p.packageList([1, 2.1, 'three', 4n])).toStrictEqual(Uint8Array.from([
      LIST_TYPES.LIST_BASE + 4, 1, 193, 64, 0, 204, 204, 204, 204,
      204, 205, 133, 116, 104, 114, 101, 101, 203, 0, 0, 0, 0, 0, 0,
      0, 4
    ]));
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
    expect(p.unpackageList(p.packageList([1, 2.1, 'three']))).toStrictEqual([1,2.1, 'three']);

    // list with a bob

    expect(p.unpackageList(p.packageList([Uint8Array.from([0])]))).toStrictEqual([Uint8Array.from([0])])
    expect(p.unpackageList(p.packageList([1, 2.1, Uint8Array.from([])]))).toStrictEqual([
      1,
      2.1,
      Uint8Array.from([])
    ])

    // TODO: Add tests for dicts / structures 

  });
});
