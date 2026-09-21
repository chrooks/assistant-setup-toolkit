export interface Searchable { name: string; description: string }
export function search<T extends Searchable>(query: string, skills: T[]): { nameMatches: T[]; intentMatches: T[]; weak: T[] };
