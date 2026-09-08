declare const resourceBindingBrand: unique symbol;

export interface ResourceBinding<Names extends string> {
  readonly [resourceBindingBrand]: Names;
}

export function createResourceDefinitionBinding<
  Names extends string,
>(): ResourceBinding<Names> {
  return Object.freeze({}) as ResourceBinding<Names>;
}
