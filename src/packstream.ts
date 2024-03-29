import { between } from "./util/helpers";

export const HELLO = 0x01;
export const GOODBYE = 0x02;
export const RESET = 0x0F;
export const RUN = 0x10;
export const DISCARD = 0x2F;
export const PULL = 0x3F;
export const BEGIN = 0x11;
export const COMMIT = 0x12;
export const ROLLBACK = 0x13;
export const SUCCESS = 0x70;
export const IGNORED = 0x7E;
export const FAILURE = 0x7F;
export const RECORD = 0x71;

export enum INT_TYPES {
  INT_8 = 0xC8,
  INT_16 = 0xC9,
  INT_32 = 0xCA,
  INT_64 = 0xCB,
}

export enum BYTE_TYPES {
  BYTE_8 = 0xcc,
  BYTE_16 = 0xcd,
  BYTE_32 = 0xce,
}

export const DICT_BASE = 0xA0;

export const FLOAT_MARKER = 0xc1;

export enum STRING_TYPES {
  // Strings > 15 bytes
  STRING_255 = 0xD0,
  STRING_65535 = 0xD1,
  STRING_2147483647 = 0xD2,
  // Strings < 15 bytes
  STRING_0 = 0x80,
  STRING_1 = 0x81,
  STRING_2 = 0x82,
  STRING_3 = 0x83,
  STRING_4 = 0x84,
  STRING_5 = 0x85,
  STRING_6 = 0x86,
  STRING_7 = 0x87,
  STRING_8 = 0x88,
  STRING_9 = 0x89,
  STRING_10 = 0x8A,
  STRING_11 = 0x8B,
  STRING_12 = 0x8C,
  STRING_13 = 0x8D,
  STRING_14 = 0x8E,
  STRING_15 = 0x8F
}

export enum LIST_TYPES {
  LIST_BASE = 0x90,
  LIST_8 = 0xd4,
  LIST_16 = 0xd5,
  LIST_32 = 0xd6,
}

export const SHARED_HEADERS = {
  user_agent: "BetterDrivers/1.0.0"
};

export class Packstream {
  encoder: TextEncoder;
  decoder: TextDecoder;

  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  package<T extends boolean | null | string | Record<string, unknown> | number>(message: T): Uint8Array {
    let messageType = 0xC0;
    let encodedMessage: Uint8Array = Uint8Array.from([messageType]);
    // get the null
    if (message == null) return Uint8Array.from([0xC0]);
    // if string...
    if (typeof message == 'string') {
      return this.packageString(message);
    }
    // if boolean, do some stuff
    if (typeof message === 'boolean') {
      return this.packageBoolean(message);
    }

    // if(typeof message === 'object' && message !== null) {
    //   const keySize = Object.keys(message).length;
    //   let byteMarker = DICT_BASE;
    //   if(keySize <= 15) {
    //     byteMarker = DICT_BASE + keySize;
    //   } else if (keySize <= 255) {
    //     byteMarker = 0xD8;
    //   } else if (keySize <=65535) {
    //     byteMarker = 0xD9;
    //   } else if (keySize <= 2147483647) {
    //     byteMarker = 0xDA;
    //   }
    //   return Uint8Array.from([
    //     byteMarker
    //   ]);
    // }

    return encodedMessage;
  }

  unpackageNumber(value: Uint8Array, bigIntMode: 'string'| 'bigint' = 'bigint'): number | BigInt | string {
    
    const dv = new DataView(value.buffer);

    const [marker] = value;
    
    switch(marker) {
      
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
        const value = dv.getBigUint64(1);
        if(bigIntMode === 'string') return value.toString()+'n';
        return value;
      }
      default: {
        const [marker] = value;
        if(!between(marker,0, 0x7f) && !(between(marker, 0xf0, 0x100))) throw new Error('Invalid TINY_INT: '+marker);
        return between(marker, 0, 0x7f) ? marker : -16 + (marker & 0xf);
      }
        
    }
  }

  packageNumber(value: number | bigint, type?: INT_TYPES): Uint8Array {

    let byteMarker = type || 0;
    let arrayBufferSize = 1;
    let method: keyof DataView = 'setUint8';

    if(type) {

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
          if (!type && typeof value === 'number' && between(value, -16, 128)) return Uint8Array.from([value < 0 ? 0xf0 + value + 16 : value]);
          break;
      }
    } else {

      if (typeof value === 'number' && between(value, -16, 128)) return Uint8Array.from([value < 0 ? 0xf0 + value + 16 : value ])
  
      if(between(value, 128, 32_767) || between(value, -128, -16)) {
        byteMarker = INT_TYPES.INT_8;
        method = 'setUint8';
        arrayBufferSize = 1;
      } else if (between(value, -32_768, -128) || between(value, 128, 32_768)) {
        byteMarker = INT_TYPES.INT_16;
        method = 'setUint16';
        arrayBufferSize = 2;
      } else if(between(value, -2_147_483_648, -32_768) || between(value, 32_768, 2_147_483_648)) {
        byteMarker = INT_TYPES.INT_32;
        method = 'setUint32';
        arrayBufferSize = 4;
      } else if (typeof value === 'bigint' || between(value, -9_223_372_036_854_775_808n, -2_147_483_648n) || between(value, 2_147_483_648n, 9_223_372_036_854_775_808n)) {
        byteMarker = INT_TYPES.INT_64;
        method = 'setBigUint64';
        arrayBufferSize = 8;
      } else {
        throw new Error('Wrong');
      }
      
    }

    const dv = new DataView(new ArrayBuffer(arrayBufferSize));

    if (!(method in dv))
      throw new Error('Could not package number:' + value);

    if(method === 'setBigUint64' || typeof value === 'bigint') {
      dv.setBigUint64(0, typeof value === 'bigint' ? value : BigInt(value));
      return Uint8Array.from([byteMarker, ... new Uint8Array(dv.buffer)]);
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
    if(marker !== FLOAT_MARKER) throw new Error('invalid float encoding! \n\t'+value);
    return dv.getFloat64(1);
  }

  packageBytes(value: Uint8Array): Uint8Array {

    let bufferLength = value.length + 2;
    const dv = new DataView(new ArrayBuffer(bufferLength));

    dv.setUint8(0, BYTE_TYPES.BYTE_8);
    dv.setUint8(1, value.length);

    return new Uint8Array(dv.buffer);
  }

  unpackageBytes(value: Uint8Array): Uint8Array {
    // TODO: write this out later
    return Uint8Array.from([0]);
  }

  unpackageList(value: Uint8Array): unknown[] {
    const returned:unknown[] = [];
    const [marker] = value;
    let count = 0;
    let sub = value.slice(0);
    if(between(marker, 0x90, 0x9f)) {
      count = marker & 0xf;
      sub = value.slice(1);
    } else {
      count = value[1];
      sub = value.slice(2);
    }
    if(count === 0) return [];

    console.info('bob', count, sub);

    for(let i = 0; i < count; i++) {
      console.info(i);
      if((sub[i] & 0xf0) === 0xf0) {
        returned.push((sub[i] & 0xf) - 16 )
      } else if(between(sub[i], 0, 128)) returned.push(sub[i]);
    }
    console.info('RETURNED', returned);
    return returned;
  }

  packageList<T extends unknown>(values: T[] ): Uint8Array {
    let byteMarker = LIST_TYPES.LIST_BASE;
    if(values.length <= 16) byteMarker = byteMarker + values.length;
    const packagedValues = values.map(v => {
      switch(typeof v) {
        case 'number':
          if(v % 1 !== 0) return this.packageFloat(v);
          return this.packageNumber(v);
        case 'bigint':
          return this.packageNumber(v);
        case 'string':
          return this.packageString(v);
        case 'boolean':
          return this.packageBoolean(v);
        default:
          return Uint8Array.from([0]);
      }
    });

    const flattened = packagedValues.reduce((all, current) => {
      const n = new Uint8Array(all.byteLength + current.byteLength);
      n.set(all);
      n.set(current, all.length);
      return n;
    }, Uint8Array.from([byteMarker]));

    return flattened;
  }

  packageBoolean(value: boolean): Uint8Array {
    return Uint8Array.from([0xC2 + Number(value)]);
  }

  unpackageBoolean(value: Uint8Array) {
    // This is one of few instances where if we receive anything else back in this data, something is wrong
    if (value.length !== 1) throw new Error('invalid boolean encoding');
    return value[0] === 0xc3;
  }

  packageString(message: string): Uint8Array {
    const encodedMessage = this.encoder.encode(message);
    let byteMarker = 0x80,
      byteLength = new Uint8Array(1);
    if (encodedMessage.byteLength <= 15) {
      byteMarker += encodedMessage.byteLength;
      byteLength = Uint8Array.from([encodedMessage.byteLength]);
    } else if (encodedMessage.byteLength <= 255) {
      byteMarker = STRING_TYPES.STRING_255;
      byteLength = Uint8Array.from([encodedMessage.byteLength]);
    } else if (encodedMessage.byteLength <= Math.pow(16, 4)) {
      byteMarker = STRING_TYPES.STRING_65535;
      const dataview = new DataView(new Uint8Array(2).buffer)
      dataview.setUint16(0, encodedMessage.byteLength);
      byteLength = new Uint8Array(dataview.buffer);
    } else if (encodedMessage.byteLength < 2_147_483_647) {
      byteMarker = STRING_TYPES.STRING_2147483647;
      const dataview = new DataView(new Uint8Array(4).buffer);
      dataview.setUint32(0, encodedMessage.byteLength);
      byteLength = new Uint8Array(dataview.buffer)
    }
    return Uint8Array.from([byteMarker, ...byteLength, ...encodedMessage]);
  }

  unpackageString(message: Uint8Array): string {
    const marker = message[0];
    // No point in decoding an empty string
    if (marker === 0x80) return '';
    // this values before we get into wild shit
    if (marker > 0x80 && marker <= 0x8f) return this.decoder.decode(message.slice(2))

    if (marker === 0xD0) {
      return this.decoder.decode(message.slice(2));
    } else if (marker === 0xD1) {
      return this.decoder.decode(message.slice(4));
    } else if (marker === 0xD2) {
      return this.decoder.decode(message.slice(6));
    }

    return '';
  }

  hello(): Uint8Array {
    return Uint8Array.from([HELLO]);
  }

  goodbye(): Uint8Array {
    return Uint8Array.from([GOODBYE]);
  }

  failure(): Uint8Array {
    return Uint8Array.from([FAILURE]);
  }
}
