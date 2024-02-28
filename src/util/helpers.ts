export function between(value: number | bigint, min: number | bigint, max: number | bigint): boolean {
  return value >= min && value < max;
}