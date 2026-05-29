// skipcq: JS-0323 - Unexpected any. Specify a different type
export type ClassConstructor<T> = new (...args: any[]) => T
