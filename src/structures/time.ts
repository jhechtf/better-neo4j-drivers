import { BaseStructure } from './base';

export class LocalTime extends BaseStructure {
	constructor(public nanoseconds: number) {
		super();
	}
}

export class Time extends LocalTime {
	constructor(
		public nanoseconds,
		public tz_offset_seconds: number,
	) {
		super(nanoseconds);
	}
}

// export interface Time {
// 	nanoseconds: number;
// 	tz_offset_seconds: number;
// }

// export interface LocalTime {
// 	nanoseconds: number;
// }
