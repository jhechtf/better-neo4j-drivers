export const HANDSHAKE = Uint8Array.from([0x60, 0x60, 0xb0, 0x17]);
export const VERSIONS = Uint8Array.from([
	0x0,
	0x0,
	0x0,
	0x4,
	...Array.from({ length: 12 }, () => 0),
]);
