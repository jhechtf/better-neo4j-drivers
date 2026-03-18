import { MESSAGES } from './markers';
import { Packstream, SHARED_HEADERS } from './packstream';
import { mergeUint8Arrays } from './util/helpers';

const ps = new Packstream();

function buildBoltMessage(tag: MESSAGES, ...fields: unknown[]): Uint8Array {
	const markerByte = 0xb0 + fields.length;
	const encodedFields = fields.map((f) => ps.package(f as never));
	return mergeUint8Arrays(Uint8Array.from([markerByte, tag]), ...encodedFields);
}

export function chunkMessage(data: Uint8Array): Uint8Array {
	const MAX_CHUNK = 65535;
	const parts: Uint8Array[] = [];
	let offset = 0;
	while (offset < data.length) {
		const size = Math.min(MAX_CHUNK, data.length - offset);
		parts.push(
			Uint8Array.from([size >> 8, size & 0xff]),
			data.slice(offset, offset + size),
		);
		offset += size;
	}
	parts.push(Uint8Array.from([0x00, 0x00]));
	return mergeUint8Arrays(...parts);
}

export function dechunkMessage(data: Uint8Array): Uint8Array {
	const parts: Uint8Array[] = [];
	let offset = 0;
	while (offset + 2 <= data.length) {
		const size = (data[offset] << 8) | data[offset + 1];
		offset += 2;
		if (size === 0) break;
		parts.push(data.slice(offset, offset + size));
		offset += size;
	}
	return mergeUint8Arrays(...parts);
}

export type BoltResponseType = 'SUCCESS' | 'FAILURE' | 'RECORD' | 'IGNORED';

export interface BoltMessage {
	type: BoltResponseType;
	data: Record<string, unknown> | unknown[];
}

export function parseResponse(raw: Uint8Array): BoltMessage {
	const [, tagByte] = raw;
	const fieldData = raw.slice(2);
	switch (tagByte) {
		case MESSAGES.SUCCESS:
			return { type: 'SUCCESS', data: ps.unpackageDict(fieldData) };
		case MESSAGES.FAILURE:
			return { type: 'FAILURE', data: ps.unpackageDict(fieldData) };
		case MESSAGES.RECORD:
			return { type: 'RECORD', data: ps.unpackageList(fieldData) };
		case MESSAGES.IGNORED:
			return { type: 'IGNORED', data: {} };
		default:
			throw new Error(`Unknown response tag: 0x${tagByte.toString(16)}`);
	}
}

export interface AuthConfig {
	username: string;
	password: string;
}

export function createHelloMessage(auth: AuthConfig): Uint8Array {
	return chunkMessage(
		buildBoltMessage(MESSAGES.HELLO, {
			user_agent: SHARED_HEADERS.user_agent,
			scheme: 'basic',
			principal: auth.username,
			credentials: auth.password,
		}),
	);
}

export function createRunMessage(
	query: string,
	params: Record<string, unknown> = {},
	extra: Record<string, unknown> = {},
): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.RUN, query, params, extra));
}

export function createPullMessage(n = -1): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.PULL, { n }));
}

export function createBeginMessage(
	extra: Record<string, unknown> = {},
): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.BEGIN, extra));
}

export function createCommitMessage(): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.COMMIT));
}

export function createRollbackMessage(): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.ROLLBACK));
}

export function createGoodbyeMessage(): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.GOODBYE));
}

export function createResetMessage(): Uint8Array {
	return chunkMessage(buildBoltMessage(MESSAGES.RESET));
}
