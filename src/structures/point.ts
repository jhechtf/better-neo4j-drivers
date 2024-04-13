import { BaseStructure } from './base';

export class Point2D extends BaseStructure {
	constructor(
		public srid: number,
		public x: number,
		public y: number,
	) {
		super();
	}
}

export class Point3D extends BaseStructure {
	constructor(
		public srid: number,
		public x: number,
		public y: number,
		public z: number,
	) {
		super();
	}
}
