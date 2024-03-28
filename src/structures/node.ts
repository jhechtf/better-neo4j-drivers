import { BaseStructure } from './base';

export class PackstreamNode<
	Properties extends Record<string, unknown> = Record<string, unknown>,
	Labels extends readonly string[] = readonly string[],
> extends BaseStructure {
	constructor(
		public readonly id: number,
		public properties: Properties,
		public labels: Labels,
		public readonly element_id: string,
	) {
		super();
	}
}
