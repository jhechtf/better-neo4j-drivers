import { PackstreamNode } from './node';
import { UnboundRelationship } from './relationship';

export interface Path {
	nodes: PackstreamNode[];
	rels: UnboundRelationship[];
	indices: number[];
}
