import { BaseStructure } from './base';
import { PackstreamNode } from './node';
import { UnboundRelationship } from './relationship';

export class Path extends BaseStructure {
	constructor(
		public nodes: PackstreamNode[],
		public rels: UnboundRelationship[],
		public indices: number[],
	) {
		super();
	}
}
