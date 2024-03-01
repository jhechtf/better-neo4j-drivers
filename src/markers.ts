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

export const DICT_BASE = 0xa0;

export const FLOAT_MARKER = 0xc1;

export enum STRING_TYPES {
  // Strings > 15 bytes
  STRING_255 = 0xd0,
  STRING_65535 = 0xd1,
  STRING_2147483647 = 0xd2,
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
  DISCARD = 0X2f,
  PULL = 0x3f,
  BEGIN = 0x11,
  COMMIT = 0x12,
  ROLLBACK = 0x13,
  SUCCESS = 0x70,
  RECORD = 0x71,
  IGNORED = 0x7e,
  FAILURE = 0x7f,
}