import { describe, it, expect } from 'vitest';
import { between, mergeUint8Arrays } from './helpers';

describe('Helper functions', () => {
	describe('between', () => {
		it('Works with regular numbers', () => {
			expect(between(10, 5, 15)).toBeTruthy();
			expect(between(100, 100, 300)).toBeTruthy();
		});
		it('Works with BigInts in any parameter', () => {
			expect(between(30, 5n, 10n)).toBeFalsy();
			expect(between(30n, 10, 45)).toBeTruthy();
			expect(between(120, 10n, 50n)).toBeFalsy();
		});
		it('Corrects the order of the limits when necessary', () => {
			expect(between(10, 30n, -5n)).toBeTruthy();
			expect(between(5, 15, 0)).toBeTruthy();
			expect(between(7, 5, 0)).toBeFalsy();
		});
	});

	describe('mergeUint8Arrays', () => {
		it('Works with two empty arrays', () => {
			expect(
				mergeUint8Arrays(new Uint8Array(), new Uint8Array()),
			).toStrictEqual(new Uint8Array());
		});
		it('Works with two arrays', () => {
			expect(
				mergeUint8Arrays(Uint8Array.from([0, 0, 0]), Uint8Array.from([1, 1])),
			).toStrictEqual(Uint8Array.from([0, 0, 0, 1, 1]));
			expect(
				mergeUint8Arrays(
					Uint8Array.from(Array.from({ length: 5 }, (_, i) => i)),
					Uint8Array.from(Array.from({ length: 7 }, (_, i) => (i + 5) * 3)),
				),
			).toStrictEqual(
				Uint8Array.from([0, 1, 2, 3, 4, 15, 18, 21, 24, 27, 30, 33]),
			);
		});
		it('Works with multiple arrays', () => {
			expect(
				mergeUint8Arrays(
					Uint8Array.from([1]),
					Uint8Array.from([2]),
					Uint8Array.from([3]),
				),
			).toStrictEqual(Uint8Array.from([1, 2, 3]));
		});
	});
});
