export const HANDSHAKE = Uint8Array.from([0x60, 0x60, 0xb0, 0x17]);
export const VERSIONS = Uint8Array.from([
	0x0,
	0x0,
	0x0,
	0x4,
	...Array.from({ length: 12 }, () => 0),
]);

export const BOLT_AGENT = 'BetterN4J/0.1.0';
export const BOLT_AGENT_DICT = {
	product: BOLT_AGENT,
	platofrm: null,
	language: 'Javascript/2020',
	language_details: null,
};
