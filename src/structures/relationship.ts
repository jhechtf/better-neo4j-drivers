export interface Relationship<
	Type extends string = string,
	Properties extends Record<string, unknown> = Record<string, unknown>,
> {
	id: number;
	startNodeId: number;
	endNodeId: number;
	type: Type;
	properties: Properties;
	element_id: string;
	start_node_element_id: string;
	end_node_element_id: string;
}

export interface UnboundRelationship<
	Type extends string = string,
	Properties extends Record<string, unknown> = Record<string, unknown>,
> {
	id: number;
	type: Type;
	properties: Properties;
	element_id: string;
}
