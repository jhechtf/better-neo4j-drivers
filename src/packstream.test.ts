import { describe, expect, it} from 'vitest';
import { INT_TYPES, LIST_TYPES, Packstream } from './packstream';
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
    expect(p.unpackageNumber(p.packageNumber(9223372036854775807n))).toBe(9223372036854775807n);
    expect(p.unpackageNumber(p.packageNumber(2_147_483_648))).toBe(2_147_483_648n);
    expect(p.unpackageNumber(p.packageNumber(2_147_483_648), 'string')).toBe('2147483648n');
  });

  it('Works with floats', () => {
    describe('Packaging works as expected', () => {
      expect(p.packageFloat(1.23)).toStrictEqual(Uint8Array.from([0xc1, 0x3f, 0xf3, 0xae, 0x14, 0x7a, 0xe1, 0x47, 0xae]));
    });

    expect(p.unpackageFloat(p.packageFloat(1.23))).toBe(1.23);
    expect(p.unpackageFloat(p.packageFloat(5.10))).toBe(5.10);
  });

  it('Works with lists', () => {
    // Empty list
    expect(p.packageList([])).toStrictEqual(Uint8Array.from([LIST_TYPES.LIST_BASE]));
    // List with a few items
    expect(p.packageList([1, 2.1, 'three', 4n])).toStrictEqual(Uint8Array.from([
      LIST_TYPES.LIST_BASE + 4, 1, 193, 64, 0, 204, 204, 204, 204,
      204, 205, 133, 5, 116, 104, 114, 101,
      101, 203, 0, 0, 0, 0, 0, 0,
      0, 4
    ]));

    expect(p.unpackageList(p.packageList([]))).toStrictEqual([]);
    expect(p.unpackageList(p.packageList([1, 2.1, 'three']))).toHaveLength(3);
  });
});