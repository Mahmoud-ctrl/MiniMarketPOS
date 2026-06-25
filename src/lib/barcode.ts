export function generateEAN13(): string {
  const d: number[] = [2, 0, 0];
  for (let i = 0; i < 9; i++) d.push(Math.floor(Math.random() * 10));
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 === 0 ? 1 : 3);
  d.push((10 - (sum % 10)) % 10);
  return d.join("");
}
