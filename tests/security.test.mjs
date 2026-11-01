import test from 'node:test';
import assert from 'node:assert/strict';
import { safeImage, safeReaction, RateLimiter } from '../security.js';

test('safeImage accepts HTTPS URLs', () => {
  assert.equal(safeImage('https://images.example.com/token.png'), 'https://images.example.com/token.png');
});

test('safeImage rejects non-HTTPS and local destinations', () => {
  assert.equal(safeImage('http://images.example.com/a.png'), '');
  assert.equal(safeImage('https://localhost/a.png'), '');
  assert.equal(safeImage('https://127.0.0.1/a.png'), '');
});

test('safeImage rejects credentials and malformed values', () => {
  assert.equal(safeImage('https://user:pass@example.com/a.png'), '');
  assert.equal(safeImage('not a URL'), '');
  assert.equal(safeImage('x'.repeat(2049)), '');
});

test('safeReaction accepts an allowed payload and sanitizes image URL', () => {
  const value = safeReaction({
    name: '  Character  ',
    reaction: 'approves',
    nonce: 'nonce_123',
    image: 'http://bad.example/image.png',
    role: 'GM',
  });
  assert.deepEqual(value, { id: 'nonce_123', name: 'Character', reaction: 'approves', image: '' });
  assert.equal(Object.hasOwn(value, 'role'), false);
});

test('safeReaction rejects untrusted shapes and invalid reactions', () => {
  assert.equal(safeReaction(null), null);
  assert.equal(safeReaction([]), null);
  assert.equal(safeReaction({ name: 'A', reaction: 'delete', nonce: 'n' }), null);
  assert.equal(safeReaction({ name: 'A', reaction: 'approves', nonce: 'bad nonce' }), null);
  assert.equal(safeReaction({ name: ' ', reaction: 'approves', nonce: 'n' }), null);
});

test('RateLimiter enforces the configured event limit', () => {
  const limiter = new RateLimiter(2, 2000);
  assert.equal(limiter.allow('connection-a'), true);
  assert.equal(limiter.allow('connection-a'), true);
  assert.equal(limiter.allow('connection-a'), false);
  assert.equal(limiter.allow('connection-b'), true);
});
