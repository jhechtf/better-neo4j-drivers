// TODO: do we add a `.create` method to allow for easy creation of other things?
export class BaseStructure {}

export type BaseStructureConstructor = {
	new (...args: unknown[]): BaseStructure;
};
