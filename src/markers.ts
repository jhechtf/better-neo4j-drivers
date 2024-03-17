export const NULL_MARKER = 0xc0;

export enum INT_TYPES {
	INT_8 = 0xc8,
	INT_16 = 0xc9,
	INT_32 = 0xca,
	INT_64 = 0xcb,
}

export enum BYTE_TYPES {
	BYTE_8 = 0xcc,
	BYTE_16 = 0xcd,
	BYTE_32 = 0xce,
}

export enum DICT_TYPES {
	TINY_DICT = 0xa0,
	DICT_8 = 0xd8,
	DICT_16 = 0xd9,
	DICT_32 = 0xda,
}

export enum BOOLEAN_TYPES {
	FALSE = 0xc2,
	TRUE = 0xc3,
}

export const FLOAT_MARKER = 0xc1;

export enum STRING_TYPES {
	// Strings > 15 bytes
	STRING_8 = 0xd0,
	STRING_16 = 0xd1,
	STRING_32 = 0xd2,
	// Strings < 15 bytes
	TINY_STRING = 0x80,
}

export enum LIST_TYPES {
	LIST_BASE = 0x90,
	LIST_8 = 0xd4,
	LIST_16 = 0xd5,
	LIST_32 = 0xd6,
}

export enum MESSAGES {
	HELLO = 0x1,
	GOODBYE = 0x2,
	RESET = 0xf,
	RUN = 0x10,
	DISCARD = 0x2f,
	PULL = 0x3f,
	BEGIN = 0x11,
	COMMIT = 0x12,
	ROLLBACK = 0x13,
	SUCCESS = 0x70,
	RECORD = 0x71,
	IGNORED = 0x7e,
	FAILURE = 0x7f,
}

export enum STRUCTURES {
	TINY_STRUCT = 0xb0,
	NODE = 0x4e,
	RELATIONSHIP = 0x52,
	UNBOUND_RELATIONSHIP = 0x72,
	PATH = 0x50,
	DATE = 0x44,
	TIME = 0x54,
	LOCAL_TIME = 0x74,
	DATE_TIME = 0x49,
	DATE_TIME_ZONE_ID = 0x69,
	LOCAL_DATE_TIME = 0x64,
	DURATION = 0x45,
	POINT_2D = 0x58,
	POINT_3D = 0x59,
}
