'use strict';

// DDDs válidos no Brasil (ANATEL).
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Valida e normaliza um celular brasileiro.
 * Aceita "(16) 99123-4567", "16991234567", "+55 16 99123-4567", "5516991234567".
 * Exige DDD válido e celular (9 dígitos começando com 9).
 * Retorna { ok:true, digits:'5516991234567', ddd, local } ou { ok:false, motivo }.
 */
function normalizeBrazilianMobile(input) {
  if (typeof input !== 'string' || input.length > 30) {
    return { ok: false, motivo: 'Informe o número no formato (DDD) 9XXXX-XXXX.' };
  }
  let digits = input.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);

  if (digits.length !== 11) {
    return { ok: false, motivo: 'O número deve ter DDD + 9 dígitos, por exemplo (16) 99123-4567.' };
  }
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (!VALID_DDD.has(ddd)) {
    return { ok: false, motivo: 'DDD inválido. Confira os dois primeiros dígitos.' };
  }
  const local = digits.slice(2);
  if (local[0] !== '9') {
    return { ok: false, motivo: 'Use um número de celular (começa com 9 depois do DDD).' };
  }
  if (/^(\d)\1+$/.test(local)) {
    return { ok: false, motivo: 'Esse número parece inválido. Confira os dígitos.' };
  }
  return { ok: true, digits: `55${digits}`, ddd, local };
}

/** Máscara para logs: não revela o número completo (apenas DDD e 2 últimos dígitos). */
function maskForLog(digits) {
  if (!/^\d{12,13}$/.test(digits || '')) return '***';
  return `+55${digits.slice(2, 4)}*******${digits.slice(-2)}`;
}

/** Máscara para exibir na interface/painel técnico (4 últimos dígitos). */
function maskForDisplay(digits) {
  if (!/^\d{12,13}$/.test(digits || '')) return '***';
  return `+55 ${digits.slice(2, 4)} 9****-${digits.slice(-4)}`;
}

/**
 * Apelido opcional: letras (inclusive acentuadas), espaço, hífen e apóstrofo, até 20 caracteres.
 * Qualquer outro caractere é rejeitado (evita formatação/links dentro da mensagem do WhatsApp).
 */
function sanitizeNickname(input) {
  if (input === undefined || input === null || input === '') return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, motivo: 'Apelido inválido.' };
  const value = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: true, value: null };
  if (value.length > 20) return { ok: false, motivo: 'O apelido pode ter no máximo 20 letras.' };
  if (!/^[\p{L}][\p{L}\p{M} '-]*$/u.test(value)) {
    return { ok: false, motivo: 'Use apenas letras no apelido (sem números ou símbolos).' };
  }
  return { ok: true, value };
}

module.exports = { normalizeBrazilianMobile, maskForLog, maskForDisplay, sanitizeNickname, VALID_DDD };
