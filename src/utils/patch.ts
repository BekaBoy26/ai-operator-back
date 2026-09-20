// Partial, который допускает явный undefined (нужно при exactOptionalPropertyTypes)
export type Patch<T> = { [K in keyof T]?: T[K] | undefined };
