import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('domaine', () => {
  it("n'importe ni l'horloge, ni React, ni Expo", () => {
    readdirSync(__dirname)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .forEach((f) => {
        const source = readFileSync(join(__dirname, f), 'utf8');
        expect(source).not.toMatch(/state\/clock|from 'react|from 'expo|new Date\(\)|Date\.now/);
      });
  });
});
