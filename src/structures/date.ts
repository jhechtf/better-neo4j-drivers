export interface PackstreamDate {
	days: number;
}

export interface DateTime {
	seconds: number;
	nanoseconds: number;
	tz_offset_seconds: number;
}

export type DateTimeZoneId = Omit<DateTime, 'tz_offset_seconds'> & {
	tz_id: string;
};

export type LocalDateTime = Omit<DateTime, 'tz_offset_seconds'>;

export interface Duration {
	months: number;
	days: number;
	seconds: number;
	nanoseconds: number;
}
