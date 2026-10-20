import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Encode, totp, verifyTotp } from '../src/lib/crypto';
import { passwordProblem, temporaryPassword } from '../src/lib/password';

test('TOTP matches RFC 6238 test vector (SHA-1)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(totp(secret, 59_000).slice(-6), '287082');
  assert.equal(totp(secret, 1111111109_000), '081804');
  assert.ok(verifyTotp(secret, totp(secret)));
  assert.ok(!verifyTotp(secret, '000000') || totp(secret) === '000000');
});

test('password policy', () => {
  assert.ok(passwordProblem('short'));
  assert.ok(passwordProblem('alllowercaseletters'));
  assert.ok(passwordProblem('Password-12345!'));
  assert.equal(passwordProblem('Granite-ledger-7741!'), null);
  for (let i = 0; i < 50; i++) assert.equal(passwordProblem(temporaryPassword()), null);
});
