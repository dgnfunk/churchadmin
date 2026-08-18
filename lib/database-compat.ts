export const databaseProvider = process.env.DATABASE_PROVIDER === "mysql" ? "mysql" : "postgresql";

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function databaseList<T extends string>(values: T[]): never {
  return values as never;
}

export function containsText(value: string): never {
  return (databaseProvider === "mysql" ? { contains: value } : { contains: value, mode: "insensitive" }) as never;
}

export function equalsText(value: string): never {
  return (databaseProvider === "mysql" ? { equals: value } : { equals: value, mode: "insensitive" }) as never;
}

export function containsListValue(value: string): never {
  return (databaseProvider === "mysql" ? { array_contains: value } : { has: value }) as never;
}
