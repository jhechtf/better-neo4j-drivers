import { BaseStructure } from './base';

export class PackstreamDate extends BaseStructure {
	constructor(public days: number) {
		super();
	}
}

export class Duration extends BaseStructure {
	constructor(
		public months: number,
		public days: number,
		public seconds: number,
		public nanoseconds: number,
	) {
		super();
	}
}

export class LocalDateTime extends BaseStructure {
	constructor(
		public seconds: number,
		public nanoseconds: number,
	) {
		super();
	}
}

export class DateTimeZoneId extends LocalDateTime {
	constructor(
		public seconds: number,
		public nanoseconds: number,
		public tz_id: string,
	) {
		super(seconds, nanoseconds);
	}
}

export class DateTime extends LocalDateTime {
	constructor(
		public seconds: number,
		public nanoseconds: number,
		public tz_offset_seconds: number,
	) {
		super(seconds, nanoseconds);
	}
}
