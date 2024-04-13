// Placeholder
export * from './node';
export * from './date';
export * from './path';
export * from './point';
export * from './relationship';
export * from './time';

import {
	DateTime,
	DateTimeZoneId,
	Duration,
	LocalDateTime,
	PackstreamDate,
} from './date';
import { PackstreamNode } from './node';
import { Path } from './path';
import { Point2D, Point3D } from './point';
import { Relationship, UnboundRelationship } from './relationship';
import { LocalTime, Time } from './time';

export type StructureType =
	| PackstreamNode
	| Relationship
	| UnboundRelationship
	| Path
	| PackstreamDate
	| Time
	| LocalTime
	| DateTime
	| DateTimeZoneId
	| LocalDateTime
	| Duration
	| Point2D
	| Point3D;
