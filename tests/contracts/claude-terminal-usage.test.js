const { parseProviderEvents } = require('../../scripts/specflow-runner.cjs');
const parse = events => parseProviderEvents('claude-print', events.map(JSON.stringify).join('\n')).usage;

// #177 D9: usage-only values from a real Claude 2.1.285 builder transcript.
// Earlier assistant usage is a partial message, not the run's accounting total.
test('terminal totals replace partial messages without counting overlapping cache usage twice', () => {
  const assistant = { type: 'assistant', message: { usage: {
    input_tokens: 2, output_tokens: 25, cache_creation_input_tokens: 6200, cache_read_input_tokens: 0,
  } } };
  const result = { type: 'result', usage: {
    input_tokens: 2, output_tokens: 654, cache_creation_input_tokens: 6200, cache_read_input_tokens: 0,
    iterations: [{ input_tokens: 2, output_tokens: 654, cache_creation_input_tokens: 6200 }],
  }, total_cost_usd: 0.031344 };
  expect(parse([assistant, assistant, result])).toEqual({
    input_tokens: 2, output_tokens: 654, total_tokens: 6856,
    cache_creation_input_tokens: 6200, cache_read_input_tokens: 0, estimated_cost_usd: 0.031344,
  });
});
test('an interrupted stream does not turn partial message counts into run totals', () => {
  expect(parse([{ type: 'assistant', message: { usage: { input_tokens: 10, output_tokens: 3 } } }])).toEqual({});
});
test('missing terminal fields stay unknown instead of borrowing earlier values or inventing a total', () => {
  expect(parse([
    { type: 'assistant', message: { usage: { input_tokens: 10, output_tokens: 3, cost_usd: 0.9 } } },
    { type: 'result', usage: { output_tokens: 20 } },
  ])).toEqual({ output_tokens: 20 });
});
test('terminal zero values are retained, including zero cache and estimated cost', () => {
  expect(parse([{ type: 'result', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 }, total_cost_usd: 0 }]))
    .toEqual({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 });
});
test('provider total is authoritative and later nonterminal events cannot overwrite it', () => {
  expect(parse([
    { type: 'result', usage: { input_tokens: 10, output_tokens: 20, total_tokens: 42 }, total_cost_usd: 0.4 },
    { type: 'assistant', message: { usage: { input_tokens: 99, output_tokens: 99, cost_usd: 9 } } },
  ])).toEqual({ input_tokens: 10, output_tokens: 20, total_tokens: 42, estimated_cost_usd: 0.4 });
});
test('a terminal error can report actual usage without becoming success', () => {
  const parsed = parseProviderEvents('claude-print', JSON.stringify({ type: 'result', is_error: true,
    usage: { input_tokens: 10, output_tokens: 20 }, total_cost_usd: 0.1 }));
  expect(parsed.usage).toEqual({ input_tokens: 10, output_tokens: 20, total_tokens: 30, estimated_cost_usd: 0.1 });
  expect(parsed.events[0].is_error).toBe(true);
});
test('Codex counts keep their provider semantics, including cached tokens already in input', () => {
  expect(parseProviderEvents('codex-exec', JSON.stringify({ type: 'turn.completed', usage: {
    input_tokens: 100, cached_input_tokens: 80, output_tokens: 20,
  } })).usage).toEqual({ input_tokens: 100, output_tokens: 20, total_tokens: 120 });
});
