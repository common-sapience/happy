import { describe, expect, it } from 'vitest';
import { buildFirstMessage } from './firstMessage';

describe('DESK-10 extra instructions', () => {
    it('sends the prompt alone when there are none', () => {
        expect(buildFirstMessage({ prompt: ' Ship it ', systemPromptAddition: null })).toBe('Ship it');
        expect(buildFirstMessage({ prompt: 'Ship it', systemPromptAddition: '   ' })).toBe('Ship it');
    });

    it('opens the first message with them', () => {
        expect(buildFirstMessage({
            prompt: 'Ship it',
            systemPromptAddition: ' Always run the tests ',
        })).toBe('Always run the tests\n\nShip it');
    });

    it('sends them on their own when the composer is otherwise empty', () => {
        expect(buildFirstMessage({ prompt: '  ', systemPromptAddition: 'Always run the tests' }))
            .toBe('Always run the tests');
    });
});
