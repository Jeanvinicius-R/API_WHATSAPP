'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBrazilianMobile, maskForLog, maskForDisplay, sanitizeNickname } = require('../src/validation');

test('aceita formatos comuns de celular brasileiro', () => {
  for (const input of ['(16) 99123-4567', '16991234567', '+55 16 99123-4567', '5516991234567', ' 16 9 9123 4567 ']) {
    const r = normalizeBrazilianMobile(input);
    assert.equal(r.ok, true, input);
    assert.equal(r.digits, '5516991234567', input);
  }
});

test('DDD 55 (RS) não é confundido com código do país', () => {
  const r = normalizeBrazilianMobile('(55) 99123-4567');
  assert.equal(r.ok, true);
  assert.equal(r.digits, '5555991234567');
});

test('rejeita números inválidos', () => {
  const invalidos = [
    '', '123', '16 3412-3456', // fixo (sem 9)
    '(10) 99123-4567', '(20) 99123-4567', // DDD inexistente
    '(16) 89123-4567', // não começa com 9
    '(16) 99999-9999', // dígitos repetidos
    '+1 415 555 2671', // fora do Brasil
    '1699123456789012345', 'abc', null, undefined, 12345678901, {},
  ];
  for (const input of invalidos) {
    assert.equal(normalizeBrazilianMobile(input).ok, false, String(input));
  }
});

test('máscaras nunca expõem o número completo', () => {
  const d = '5516991234567';
  assert.equal(maskForLog(d), '+5516*******67');
  assert.ok(!maskForLog(d).includes('9912345'));
  assert.equal(maskForDisplay(d), '+55 16 9****-4567');
  assert.equal(maskForLog('xx'), '***');
});

test('apelido: aceita letras acentuadas e rejeita símbolos/links', () => {
  assert.deepEqual(sanitizeNickname(''), { ok: true, value: null });
  assert.deepEqual(sanitizeNickname(undefined), { ok: true, value: null });
  assert.equal(sanitizeNickname('  Maria   José ').value, 'Maria José');
  assert.equal(sanitizeNickname("D'Ávila-Souza").ok, true);
  for (const ruim of ['*negrito*', 'http://x.co', 'João123', '_it_', 'a'.repeat(21), '<b>x</b>', '😀', 123]) {
    assert.equal(sanitizeNickname(ruim).ok, false, String(ruim));
  }
});
