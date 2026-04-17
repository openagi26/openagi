import { describe, expect, it } from 'vitest';
import { resolveSupportedLanguage } from '../../shared/language';

describe('resolveSupportedLanguage', () => {
  it('uses the base language for supported regional locales', () => {
    expect(resolveSupportedLanguage('zh-CN')).toBe('zh');
    expect(resolveSupportedLanguage('ja_JP')).toBe('ja');
    expect(resolveSupportedLanguage('en-US')).toBe('en');
  });

  it('falls back to Chinese for unsupported locales', () => {
    expect(resolveSupportedLanguage('fr-FR')).toBe('zh');
    expect(resolveSupportedLanguage('ko')).toBe('zh');
  });

  it('falls back to Chinese when locale is missing', () => {
    expect(resolveSupportedLanguage('')).toBe('zh');
    expect(resolveSupportedLanguage(undefined)).toBe('zh');
  });
});
