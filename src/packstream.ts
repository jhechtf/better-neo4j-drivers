import {
	BOOLEAN_TYPES,
	BYTE_TYPES,
	DICT_TYPES,
	FLOAT_MARKER,
	INT_TYPES,
	LIST_TYPES,
	NULL_MARKER,
	STRING_TYPES,
	STRUCTURES,
	STRUCTURE_MARKER,
} from './markers';
import { between, mergeUint8Arrays } from './util/helpers';
import {
	PackstreamDate,
	PackstreamNode,
	Time,
	LocalTime,
	Path,
	Relationship,
	StructureType,
	UnboundRelationship,
	DateTime,
	DateTimeZoneId,
	LocalDateTime,
	Duration,
	Point2D,
	Point3D,
} from './structures';
import { BaseStructure } from './structures/base';

export const SHARED_HEADERS = {
	user_agent: 'BetterDrivers/1.0.0',
};

export class Packstream {
	encoder: TextEncoder;
	decoder: TextDecoder;

	constructor() {
		this.encoder = new TextEncoder();
		this.decoder = new TextDecoder();
	}

	package<T>(message: T): Uint8Array {
		const messageType = 0xc0;
		const encodedMessage: Uint8Array = Uint8Array.from([messageType]);
		// get the null
		if (message == null) return this.packageNull();
		// if string...
		if (typeof message === 'string') {
			return this.packageString(message);
		}
		// if boolean, do some stuff
		if (typeof message === 'boolean') {
			return this.packageBoolean(message);
		}

		if (message instanceof Uint8Array) {
			return this.packageBytes(message);
		}

		if (message instanceof BaseStructure) {
			return this.packageStructure(message);
		}

		if (typeof message === 'number') {
			return this.packageNumber(message);
		}

		if (Array.isArray(message)) {
			return this.packageList(message);
		}

		if (typeof message === 'object') {
			return this.packageDict(message as Record<string, unknown>);
		}

		return encodedMessage;
	}

	unpackage(arr: Uint8Array): unknown {
		const [marker] = arr;
		const byteHigh = arr[0] & 0xf0;
		const byteLow = arr[0] & 0xf;

		if (marker === NULL_MARKER) return null;

		if (marker in BOOLEAN_TYPES) return marker === BOOLEAN_TYPES.TRUE;

		if (between(arr[0], 0xf0, 0xff)) {
			return -16 + byteLow;
		}

		if (between(arr[0], 0, 128)) {
			return arr[0];
		}

		if (byteHigh in LIST_TYPES || marker in LIST_TYPES)
			return this.unpackageList(arr);

		if (byteHigh === DICT_TYPES.TINY_DICT || marker in DICT_TYPES) {
			return this.unpackageDict(arr);
		}

		if (byteHigh === STRING_TYPES.TINY_STRING) return this.unpackageString(arr);

		if (byteHigh === STRUCTURE_MARKER) return this.unpackageStructure(arr);

		switch (marker) {
			case INT_TYPES.INT_8:
			case INT_TYPES.INT_16:
			case INT_TYPES.INT_32:
			case INT_TYPES.INT_64:
				return this.unpackageNumber(arr);

			case STRING_TYPES.STRING_8:
			case STRING_TYPES.STRING_16:
			case STRING_TYPES.STRING_32:
				return this.unpackageString(arr);

			case FLOAT_MARKER:
				return this.unpackageFloat(arr);

			case BYTE_TYPES.BYTE_8:
			case BYTE_TYPES.BYTE_16:
			case BYTE_TYPES.BYTE_32:
				return this.unpackageBytes(arr);
		}

		return {};
	}

	packageStructure<T extends BaseStructure = BaseStructure>(
		value: T,
	): Uint8Array {
		// Stub for now
		const marker = STRUCTURES.TINY_STRUCT;
		const tagByte = this.getStructureMarker(value);

		return Uint8Array.from([
			marker + Object.keys(value).length,
			tagByte,
			...this.packageDict(value as Record<string, unknown>),
		]);
	}

	getStructureMarker<T extends BaseStructure>(value: T) {
		if (value instanceof PackstreamNode) return STRUCTURES.NODE;

		if (value instanceof UnboundRelationship)
			return STRUCTURES.UNBOUND_RELATIONSHIP;

		if (value instanceof Relationship) return STRUCTURES.RELATIONSHIP;

		if (value instanceof Path) return STRUCTURES.PATH;

		if (value instanceof PackstreamDate) return STRUCTURES.DATE;

		if (value instanceof Time) return STRUCTURES.TIME;

		if (value instanceof LocalTime) return STRUCTURES.LOCAL_TIME;

		if (value instanceof DateTime) return STRUCTURES.DATE_TIME;

		if (value instanceof DateTimeZoneId) return STRUCTURES.DATE_TIME_ZONE_ID;

		if (value instanceof LocalDateTime) return STRUCTURES.LOCAL_DATE_TIME;

		if (value instanceof Duration) return STRUCTURES.DURATION;

		if (value instanceof Point2D) return STRUCTURES.POINT_2D;

		if (value instanceof Point3D) return STRUCTURES.POINT_3D;

		return 0;
	}

	unpackageStructure<T extends StructureType>(value: Uint8Array): T {
		const [, marker] = value;

		switch (marker) {
			case STRUCTURES.NODE: {
				const v = this.unpackageDict<PackstreamNode>(value.slice(2));
				return new PackstreamNode(v.id, v.properties, v.labels, v.element_id);
			}
			case STRUCTURES.DATE: {
				const v = this.unpackageDict<PackstreamDate>(value.slice(2));
				return new PackstreamDate(v.days);
			}
			case STRUCTURES.DATE_TIME: {
				const v = this.unpackageDict<DateTime>(value.slice(2));
				return new DateTime(v.seconds, v.nanoseconds, v.tz_offset_seconds);
			}
			case STRUCTURES.DATE_TIME_ZONE_ID: {
				const v = this.unpackageDict<DateTimeZoneId>(value.slice(2));
				return new DateTimeZoneId(v.seconds, v.nanoseconds, v.tz_id);
			}
			case STRUCTURES.DURATION: {
				const v = this.unpackageDict<Duration>(value.slice(2));
				return new Duration(v.months, v.days, v.seconds, v.nanoseconds);
			}
			default:
				return {} as T;
		}
	}

	unpackageNumber(
		value: Uint8Array,
		bigIntMode: 'string' | 'bigint' = 'bigint',
	): number | bigint | string {
		const dv = new DataView(value.buffer);

		const [marker] = value;

		switch (marker) {
			case INT_TYPES.INT_8: {
				return dv.getUint8(1);
			}
			case INT_TYPES.INT_16: {
				return dv.getUint16(1);
			}
			case INT_TYPES.INT_32: {
				return dv.getUint32(1);
			}
			case INT_TYPES.INT_64: {
				const value = dv.getBigInt64(1);
				if (bigIntMode === 'string') return `${value.toString()}n`;
				return value;
			}
			default: {
				const [marker] = value;
				if (!between(marker, 0, 0x7f) && !between(marker, 0xf0, 0x100))
					throw new Error(`Invalid TINY_INT: ${marker}`);
				return between(marker, 0, 0x7f) ? marker : -16 + (marker & 0xf);
			}
		}
	}

	packageNumber(value: number | bigint, type?: INT_TYPES): Uint8Array {
		let byteMarker = type || 0;
		let arrayBufferSize = 1;
		let method: keyof DataView = 'setUint8';

		if (type) {
			switch (type) {
				case INT_TYPES.INT_8:
					arrayBufferSize = 1;
					method = 'setUint8';
					break;

				case INT_TYPES.INT_16:
					byteMarker = INT_TYPES.INT_16;
					arrayBufferSize = 2;
					method = 'setUint16';
					break;

				case INT_TYPES.INT_32:
					arrayBufferSize = 4;
					method = 'setUint32';
					break;

				case INT_TYPES.INT_64:
					arrayBufferSize = 8;
					method = 'setBigUint64';
					break;

				default:
					if (!type && typeof value === 'number' && between(value, -16, 128))
						return Uint8Array.from([value < 0 ? 0xf0 + value + 16 : value]);
					break;
			}
		} else {
			if (typeof value === 'number' && between(value, -16, 128))
				return Uint8Array.from([value < 0 ? 0xf0 + value + 16 : value]);

			if (between(value, -128, -16)) {
				byteMarker = INT_TYPES.INT_8;
				method = 'setUint8';
				arrayBufferSize = 1;
			} else if (between(value, -32_768, -128) || between(value, 128, 32_768)) {
				byteMarker = INT_TYPES.INT_16;
				method = 'setUint16';
				arrayBufferSize = 2;
			} else if (
				between(value, -2_147_483_648, -32_768) ||
				between(value, 32_768, 2_147_483_648)
			) {
				byteMarker = INT_TYPES.INT_32;
				method = 'setUint32';
				arrayBufferSize = 4;
			} else if (
				typeof value === 'bigint' ||
				between(value, -9_223_372_036_854_775_808n, -2_147_483_648n) ||
				between(value, 2_147_483_648n, 9_223_372_036_854_775_808n)
			) {
				byteMarker = INT_TYPES.INT_64;
				method = 'setBigUint64';
				arrayBufferSize = 8;
			} else {
				throw new Error('Wrong');
			}
		}

		const dv = new DataView(new ArrayBuffer(arrayBufferSize));

		if (!(method in dv)) throw new Error(`Could not package number:${value}`);

		if (method === 'setBigUint64' || typeof value === 'bigint') {
			dv.setBigUint64(0, typeof value === 'bigint' ? value : BigInt(value));
			return Uint8Array.from([byteMarker, ...new Uint8Array(dv.buffer)]);
		}

		dv[method](0, value as never);
		return Uint8Array.from([byteMarker, ...new Uint8Array(dv.buffer)]);
	}

	packageFloat(value: number): Uint8Array {
		const dv = new DataView(new ArrayBuffer(9));
		dv.setInt8(0, FLOAT_MARKER);
		dv.setFloat64(1, value);
		return new Uint8Array(dv.buffer);
	}

	unpackageFloat(value: Uint8Array): number {
		const dv = new DataView(value.buffer);
		const marker = value[0];
		if (marker !== FLOAT_MARKER)
			throw new Error(`invalid float encoding! \n\t${value}`);
		return dv.getFloat64(1);
	}

	packageBytes(value: Uint8Array): Uint8Array {
		let reserveBytes = 2;
		let bufferLength = value.byteLength + reserveBytes;
		let byteMarker = BYTE_TYPES.BYTE_8;
		if (between(value.byteLength, 256, 65_536)) {
			reserveBytes = 3;
			bufferLength = value.byteLength + reserveBytes;
			byteMarker = BYTE_TYPES.BYTE_16;
		} else if (between(value.byteLength, 65_356, 2_147_483_648)) {
			reserveBytes = 5;
			bufferLength = value.byteLength + reserveBytes;
			byteMarker = BYTE_TYPES.BYTE_32;
		}
		const dv = new DataView(new ArrayBuffer(bufferLength));

		switch (byteMarker) {
			case BYTE_TYPES.BYTE_8:
				dv.setUint8(0, byteMarker);
				dv.setUint8(1, value.byteLength);
				break;
			case BYTE_TYPES.BYTE_16:
				dv.setUint8(0, byteMarker);
				dv.setUint16(1, value.byteLength);
				break;
			case BYTE_TYPES.BYTE_32:
				dv.setUint8(0, byteMarker);
				dv.setUint32(1, value.byteLength);
		}
		for (let i = reserveBytes; i < bufferLength; i++) {
			dv.setUint8(i, value[i - reserveBytes]);
		}

		return new Uint8Array(dv.buffer);
	}

	unpackageBytes(value: Uint8Array): Uint8Array {
		// TODO: write this out later
		const [marker] = value;
		const dv = new DataView(value.slice(1).buffer);
		let size = 1;

		switch (marker) {
			case BYTE_TYPES.BYTE_16:
				size = 2;
				break;
			case BYTE_TYPES.BYTE_32:
				size = 4;
				break;
		}

		return value.slice(1 + size);
	}

	unpackageList(value: Uint8Array): unknown[] {
		const returned: unknown[] = [];
		const [marker] = value;
		let byteLength = 1;
		const count = this.getByteLength(value);
		let sub = value.slice(0);

		if (between(count, 16, 256)) {
			byteLength = 2;
		} else if (between(count, 256, 65_536)) {
			byteLength = 3;
		} else if (between(count, 65_536, 2_147_483_647)) {
			byteLength = 5;
		}

		if (count === 0) return [];

		let i = 0;
		sub = value.slice(byteLength);

		while (returned.length < count) {
			++i;

			const b = this.unpackage(sub);

			returned.push(b);

			const totalBytes = this.getTotalBytes(sub);

			sub = sub.slice(totalBytes);

			if (returned.length === count) break;

			// In case we don't ever fill this up somehow, break after 100 iterations.
			if (i === 100) break;
		}

		return returned;
	}

	packageList<T>(values: T[]): Uint8Array {
		let byteMarker = LIST_TYPES.LIST_BASE;
		let sizeMarker = new Uint8Array();

		if (values.length <= 15) byteMarker = byteMarker + values.length;
		else if (between(values.length, 16, 256)) {
			byteMarker = LIST_TYPES.LIST_8;
			sizeMarker = new Uint8Array(1);
			const dv = new DataView(sizeMarker.buffer);
			dv.setUint8(0, values.length);
		} else if (between(values.length, 256, 65_536)) {
			byteMarker = LIST_TYPES.LIST_16;
			sizeMarker = new Uint8Array(2);
			const dv = new DataView(sizeMarker.buffer);
			dv.setUint16(0, values.length);
		} else if (between(values.length, 65_536, 2_147_483_648)) {
			byteMarker = LIST_TYPES.LIST_32;
			sizeMarker = new Uint8Array(4);
			const dv = new DataView(sizeMarker.buffer);
			dv.setUint32(0, values.length);
		}

		const packagedValues = values.map((v) => {
			if (v instanceof Uint8Array) return this.packageBytes(v);
			if (Array.isArray(v)) return this.packageList(v);
			if (v === null) return Uint8Array.from([NULL_MARKER]);
			switch (typeof v) {
				case 'number':
					if (v % 1 !== 0) return this.packageFloat(v);
					return this.packageNumber(v);
				case 'bigint':
					return this.packageNumber(v);
				case 'string':
					return this.packageString(v);
				case 'boolean':
					return this.packageBoolean(v);
				case 'object':
					return this.packageDict(v as Record<string, unknown>);
				default:
					return Uint8Array.from([NULL_MARKER]);
			}
		});

		const flattened = mergeUint8Arrays(
			Uint8Array.from([byteMarker]),
			sizeMarker,
			...packagedValues,
		);

		return flattened;
	}

	packageBoolean(value: boolean): Uint8Array {
		return Uint8Array.from([0xc2 + Number(value)]);
	}

	unpackageBoolean(value: Uint8Array) {
		// This is one of few instances where if we receive anything else back in this data, something is wrong
		if (value.length !== 1) throw new Error('invalid boolean encoding');
		return value[0] === 0xc3;
	}

	packageString(message: string): Uint8Array {
		const encodedMessage = this.encoder.encode(message);

		let byteMarker = STRING_TYPES.TINY_STRING;
		let byteLength = new Uint8Array();

		if (encodedMessage.byteLength <= 15) {
			byteMarker += encodedMessage.byteLength;
		} else if (encodedMessage.byteLength < 256) {
			byteMarker = STRING_TYPES.STRING_8;
			byteLength = new Uint8Array(1);
			const dv = new DataView(byteLength.buffer);
			dv.setUint8(0, encodedMessage.byteLength);
		} else if (encodedMessage.byteLength < 65_536) {
			byteMarker = STRING_TYPES.STRING_16;
			byteLength = new Uint8Array(2);
			const dv = new DataView(byteLength.buffer);
			dv.setUint16(0, encodedMessage.byteLength);
		} else if (encodedMessage.length < 2_147_483_648) {
			byteMarker = STRING_TYPES.STRING_32;
			byteLength = new Uint8Array(4);
			const dv = new DataView(byteLength.buffer);
			dv.setUint32(0, encodedMessage.byteLength);
		}

		return Uint8Array.from([byteMarker, ...byteLength, ...encodedMessage]);
	}

	unpackageString(message: Uint8Array): string {
		const marker = message[0];
		// No point in decoding an empty string
		if (marker === 0x80) return '';
		// this values before we get into wild shit
		if (marker > 0x80 && marker <= 0x8f) {
			const length = marker & 0xf;
			return this.decoder.decode(message.slice(1, length + 1));
		}

		const dv = new DataView(message.buffer);

		if (marker === STRING_TYPES.STRING_8) {
			return this.decoder.decode(message.slice(2, dv.getUint8(1) + 3));
			// biome-ignore lint/style/noUselessElse: <explanation>
		} else if (marker === STRING_TYPES.STRING_16) {
			return this.decoder.decode(message.slice(4, dv.getUint16(1) + 5));
			// biome-ignore lint/style/noUselessElse: <explanation>
		} else if (marker === STRING_TYPES.STRING_32) {
			return this.decoder.decode(message.slice(6, dv.getUint32(1) + 7));
		}

		return '';
	}

	packageNull(): Uint8Array {
		return Uint8Array.from([0xc0]);
	}

	unpackageNull(value: Uint8Array) {
		const [marker] = value;
		if (marker === 0xc0) return null;
		throw new Error('Invalid Uint8Array');
	}

	/**
	 * @description returns the number lead bytes (byte marker + optional size)
	 * which can range from 1 to 5 in most cases.
	 * @param value
	 * @returns
	 */
	getLeadByteLength(value: Uint8Array): number {
		const [marker] = value;
		const markerHigh = marker & 0xf0;
		let totalExtra = 0;
		if (
			[
				DICT_TYPES.TINY_DICT,
				LIST_TYPES.LIST_BASE,
				STRING_TYPES.TINY_STRING,
			].includes(markerHigh)
		)
			return 1;

		switch (marker) {
			case INT_TYPES.INT_8:
			case INT_TYPES.INT_16:
			case INT_TYPES.INT_32:
			case INT_TYPES.INT_64:
				totalExtra = 1;
				break;
			case STRING_TYPES.STRING_8:
			case LIST_TYPES.LIST_8:
			case BYTE_TYPES.BYTE_8:
			case DICT_TYPES.DICT_8:
				totalExtra = 2;
				break;
			case STRING_TYPES.STRING_16:
			case LIST_TYPES.LIST_16:
			case BYTE_TYPES.BYTE_16:
			case DICT_TYPES.DICT_16:
				totalExtra = 3;
				break;
			case STRING_TYPES.STRING_32:
			case LIST_TYPES.LIST_32:
			case BYTE_TYPES.BYTE_32:
			case DICT_TYPES.DICT_32:
				totalExtra = 5;
				break;
			case FLOAT_MARKER:
				totalExtra = 1;
		}

		return totalExtra;
	}

	/**
	 *
	 * @description When generically unpacking something, you will occasionally need to know the length of the current item
	 * in order to properly progress the stream forward. __NOTE__: this does **not** include
	 * the marker bytes, or any size bytes. This is simply the size of the entry itself
	 * @param value The Uint8 encoded values we are looking at.
	 * @returns the number of entries in the Uint8Array that the value at the current `marker` takes up
	 */
	getByteLength(value: Uint8Array): number {
		const [marker] = value;
		const markerHigh = marker & 0xf0;
		const markerLow = marker & 0xf;

		switch (markerHigh) {
			case STRING_TYPES.TINY_STRING:
				return markerLow;
			case LIST_TYPES.LIST_BASE:
				return markerLow;
		}

		if (between(marker, 0xf0, 0xff) || between(marker, 0, 16)) return 1;

		if (marker === FLOAT_MARKER) return 8;

		switch (marker) {
			case NULL_MARKER:
			case 0xc2:
			case 0xc3:
			case INT_TYPES.INT_8:
				return 1;
			case INT_TYPES.INT_16:
				return 2;
			case INT_TYPES.INT_32:
				return 4;
			case INT_TYPES.INT_64:
				return 8;
			case STRING_TYPES.STRING_8:
			case LIST_TYPES.LIST_8:
			case BYTE_TYPES.BYTE_8:
				return value[1];
			case STRING_TYPES.STRING_16:
			case LIST_TYPES.LIST_16:
			case BYTE_TYPES.BYTE_16: {
				const dv = new DataView(value.buffer, 1);
				return dv.getUint16(0);
			}
			case STRING_TYPES.STRING_32:
			case LIST_TYPES.LIST_32:
			case BYTE_TYPES.BYTE_32: {
				const dv = new DataView(value.buffer, 1);
				return dv.getUint32(0);
			}
		}

		return 1;
	}

	packageDict<T extends Record<string, unknown>>(value: T): Uint8Array {
		const keys = Object.keys(value).filter((k) => typeof k === 'string');
		let byteMaker = DICT_TYPES.TINY_DICT;
		let sizeBytes: Uint8Array;

		if (keys.length <= 15) {
			byteMaker += keys.length;
			sizeBytes = new Uint8Array();
		} else if (between(keys.length, 16, 256)) {
			byteMaker = DICT_TYPES.DICT_8;
			sizeBytes = new Uint8Array(1);
			const dv = new DataView(sizeBytes.buffer);
			dv.setUint8(0, keys.length);
		} else if (between(keys.length, 256, 65_536)) {
			byteMaker = DICT_TYPES.DICT_16;
			sizeBytes = new Uint8Array(2);
			const dv = new DataView(sizeBytes.buffer);
			dv.setUint16(0, keys.length);
		} else if (between(keys.length, 65_536, 2_147_483_648)) {
			byteMaker = DICT_TYPES.DICT_32;
			sizeBytes = new Uint8Array(4);
			const dv = new DataView(sizeBytes.buffer);
			dv.setUint32(0, keys.length);
		} else sizeBytes = new Uint8Array();

		const baseThingies = mergeUint8Arrays(
			...keys.flatMap((k) => [this.package(k), this.package(value[k])]),
		);

		return Uint8Array.from([byteMaker, ...sizeBytes, ...baseThingies]);
	}

	unpackageDict<T = Record<string, unknown>>(value: Uint8Array): T {
		const [marker] = value;
		const markerHigh = marker & 0xf0;
		const markerLow = marker & 0xf;
		let entriesCount = 0;

		let sub = value.slice(1);

		if (markerHigh === DICT_TYPES.TINY_DICT) {
			entriesCount = markerLow;
		}

		switch (marker) {
			case DICT_TYPES.DICT_8: {
				const dv = new DataView(sub.buffer);
				entriesCount = dv.getUint8(0);
				sub = sub.slice(1);
				break;
			}
			case DICT_TYPES.DICT_16: {
				const dv = new DataView(sub.buffer);
				entriesCount = dv.getUint16(0);
				sub = sub.slice(2);
				break;
			}

			case DICT_TYPES.DICT_32: {
				const dv = new DataView(sub.buffer);
				entriesCount = dv.getUint32(0);
				sub = sub.slice(4);
				break;
			}
		}

		const entries: [string, unknown][] = [];

		while (entries.length < entriesCount && sub.length > 0) {
			let totalByteLength = this.getTotalBytes(sub);
			const key = this.unpackage(sub);
			if (typeof key !== 'string')
				throw new Error(`Key is not the correct type: ${key}`);
			sub = sub.slice(totalByteLength);
			const value = this.unpackage(sub);
			totalByteLength = this.getTotalBytes(sub);
			entries.push([key, value]);
			sub = sub.slice(totalByteLength);
		}

		return Object.fromEntries(entries) as T;
	}

	/**
	 * @description Returns all of the bytes taken up by a structure
	 * @param value
	 * @returns
	 */
	getTotalBytes(value: Uint8Array): number {
		const [marker] = value;
		const leadBytes = this.getLeadByteLength(value);
		const regularBytes = this.getByteLength(value);

		const markerHigh = marker & 0xf0;
		const markerLow = marker & 0xf;

		// if we do not have a list or dict type, which have weirder rules about
		// sizes, we can just put out the leadBytes + the regular bytes and be done
		if (
			!(
				markerHigh in LIST_TYPES ||
				markerHigh in DICT_TYPES ||
				marker in LIST_TYPES ||
				marker in DICT_TYPES
			)
		)
			return leadBytes + regularBytes;

		// Otherwise, we needt to deal with lists / dicts requiring stupid shit
		let totalBytes = leadBytes;
		let expectedCount = markerLow;
		const dv = new DataView(value.buffer);

		switch (marker) {
			case LIST_TYPES.LIST_8:
			case DICT_TYPES.DICT_8:
				expectedCount = dv.getUint8(1);
				break;
			case LIST_TYPES.LIST_16:
			case DICT_TYPES.DICT_16:
				expectedCount = dv.getUint16(1);
				break;
			case LIST_TYPES.LIST_32:
			case DICT_TYPES.DICT_32:
				expectedCount = dv.getUint32(1);
				break;
		}

		if (marker in DICT_TYPES || markerHigh in DICT_TYPES) expectedCount *= 2;

		let count = 0;
		let arr = value.slice(leadBytes);
		// Todo: Fix this in cases where the array isn't necessary all belonging to one item
		while (count < expectedCount && arr.length > 0) {
			const tmpBytes = this.getTotalBytes(arr);
			totalBytes += tmpBytes;

			arr = arr.slice(tmpBytes);
			count++;
		}

		return totalBytes;
	}
}
