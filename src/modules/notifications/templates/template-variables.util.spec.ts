import {
  extractHandlebarsVariables,
  getSamplePayloadForCode,
} from './template-variables.util.js';

describe('template-variables.util', () => {
  describe('extractHandlebarsVariables', () => {
    it('returns empty array for empty, null, or invalid input', () => {
      expect(extractHandlebarsVariables('')).toEqual([]);
      expect(extractHandlebarsVariables(null)).toEqual([]);
      expect(extractHandlebarsVariables(undefined)).toEqual([]);
    });

    it('extracts top-level mustache variables', () => {
      const template =
        'Hello {{user_name}}, click here {{verification_url}} to activate {{company_name}}!';
      const vars = extractHandlebarsVariables(template);
      expect(vars).toEqual(
        expect.arrayContaining([
          'user_name',
          'verification_url',
          'company_name',
        ]),
      );
      expect(vars).toHaveLength(3);
    });

    it('extracts variables inside block statements', () => {
      const template =
        '{{#if has_discount}}Your code is {{discount_code}}{{/if}} {{#each items}}{{item_name}}{{/each}}';
      const vars = extractHandlebarsVariables(template);
      expect(vars).toContain('has_discount');
      expect(vars).toContain('discount_code');
      expect(vars).toContain('items');
      expect(vars).toContain('item_name');
      expect(vars).not.toContain('if');
      expect(vars).not.toContain('each');
    });
  });

  describe('getSamplePayloadForCode', () => {
    it('returns sample payload for known templates', () => {
      const sample = getSamplePayloadForCode('verification-email');
      expect(sample).toBeDefined();
      expect(sample?.user_name).toBeDefined();
      expect(sample?.verification_url).toBeDefined();
    });

    it('resolves snake_case alias to sample payload', () => {
      const sample = getSamplePayloadForCode('verification_email');
      expect(sample).toBeDefined();
      expect(sample?.user_name).toBeDefined();
    });

    it('returns null for unknown template codes', () => {
      expect(getSamplePayloadForCode('unknown-template-xyz')).toBeNull();
    });
  });
});
