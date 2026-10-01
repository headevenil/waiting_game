// IME-safe Korean input. Owns its DOM and value; dispatches only on the big 확인 button.
import { h, btn } from './h.js';
import { len } from '../i18n/norm.js';

const ATTRS = {
  type: 'text', lang: 'ko', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off',
  spellcheck: 'false', enterkeyhint: 'done', inputmode: 'text',
};

export function koinput({ fields = 1, placeholders = [], maxLength = 12, validate, submitLabel = '확인',
  onSubmit, allowEmpty = false, label, autofocus = false }) {
  const err = h('p', { class: 'koinput-error', role: 'alert', 'aria-live': 'polite' });
  const inputs = [];
  const rows = [];
  for (let i = 0; i < fields; i++) {
    const count = h('span', { class: 'koinput-count', 'aria-hidden': 'true' }, `0/${maxLength}`);
    const input = h('input', { ...ATTRS, class: 'koinput-field', placeholder: placeholders[i] ?? '', 'aria-label': placeholders[i] ?? label ?? '입력' });
    const update = () => {
      const n = len(input.value);
      count.textContent = `${n}/${maxLength}`;
      count.classList.toggle('is-over', n > maxLength);
    };
    input.addEventListener('input', update);
    input.addEventListener('compositionend', update);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229) return;          // still composing a syllable: do nothing
      e.preventDefault();
      if (i < fields - 1) inputs[i + 1].focus(); else submit();
    });
    inputs.push(input);
    rows.push(h('label', { class: 'koinput-row' }, input, count));
  }

  let busy = false;
  function submit() {
    if (busy) return;
    busy = true;
    // Blur first so the keyboard commits any half-composed syllable, then read on the next tick.
    for (const el of inputs) el.blur();
    setTimeout(() => {
      busy = false;
      const values = inputs.map((el) => el.value.normalize('NFC').trim());
      let msg = null;
      if (!allowEmpty && values.some((v) => !v)) msg = fields > 1 ? '빈칸을 모두 채워 주세요' : '내용을 써 주세요';
      else if (values.some((v) => len(v) > maxLength)) msg = `${maxLength}글자까지만 돼요`;
      else msg = validate?.(values) ?? null;
      if (msg) { err.textContent = msg; return; }
      err.textContent = '';
      for (const el of inputs) el.value = '';           // never leave the last secret in the field
      onSubmit(fields === 1 ? values[0] : values);
    }, 0);
  }

  const submitBtn = btn(submitLabel, submit, 'primary', { class: 'koinput-submit' });
  const el = h('div', { class: 'koinput' }, label ? h('p', { class: 'koinput-label' }, label) : null, rows, err);
  if (autofocus) requestAnimationFrame(() => inputs[0]?.focus());
  return { el, submitBtn, inputs, submit };
}
