import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml utility', () => {
    it('should sanitize dangerous HTML tags', () => {
        const input = '<p>Hello <script>alert("hack")</script><span>World</span></p>';
        const clean = sanitizeHtml(input);
        expect(clean).toContain('Hello <span>World</span>');
        expect(clean).not.toContain('script');
    });

    it('should allow mark tags and safe classes for search highlighting while stripping events', () => {
        const input = 'Matched: <mark class="bg-accent/30 text-accent font-bold" onclick="alert(1)">highlighted</mark>';
        const clean = sanitizeHtml(input);
        expect(clean).toContain('<mark class="bg-accent/30 text-accent font-bold">highlighted</mark>');
        expect(clean).not.toContain('onclick');
    });
});
