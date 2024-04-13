/**
 *
 * @param value The value you are testing
 * @param min the minimum value
 * @param max the maximum value
 * @description returns true if the value is greater than or equal the minimum and STRICTLY LESS THAN the maximum
 * @returns
 */
export function between(
	value: number | bigint,
	min: number | bigint,
	max: number | bigint,
): boolean {
	let [umin, umax] = [min, max];
	if (umax < umin) [umin, umax] = [umax, umin];
	return value >= umin && value < umax;
}

/**
 *
 * @param values an array of Uint8Arrays to be merged into a single Uint8Array
 * @returns a single merged Uint8Array
 */
export function mergeUint8Arrays(...values: Uint8Array[]): Uint8Array {
	return values.reduce((all, cur) => {
		const full = new Uint8Array(all.byteLength + cur.byteLength);
		full.set(all);
		full.set(cur, all.length);
		return full;
	}, new Uint8Array());
}
