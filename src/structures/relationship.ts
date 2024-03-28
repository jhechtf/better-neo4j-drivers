import { BaseStructure } from './base';

export class Relationship<
	Type extends string = string,
	Properties extends Record<string, unknown> = Record<string, unknown>,
> extends BaseStructure {
	constructor(
		public readonly id: number,
		public startNodeId: number,
		public endNodeId: number,
		public type: Type,
		public properties: Properties,
		public element_id: string,
		public start_node_element_id: string,
		public end_node_element_id: string,
	) {
		super();
	}
}

export class UnboundRelationship<
	Type extends string = string,
	Properties extends Record<string, unknown> = Record<string, unknown>,
> extends BaseStructure {
	constructor(
		public readonly id: number,
		public type: Type,
		public properties: Properties,
		public element_id: string,
	) {
		super();
	}
}
