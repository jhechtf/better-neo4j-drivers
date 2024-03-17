export interface PackstreamNode<
	Properties extends Record<string, unknown> = Record<string, unknown>,
	Labels extends readonly string[] = readonly string[],
> {
	id: number;
	labels: Labels;
	properties: Properties;
	element_id: string;
}
