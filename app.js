'use strict';
(() => {
  const DATA = window.CARDS || { cards: [] };
  const CARDS = DATA.cards.map((c, i) => ({ ...c, key: [c.c, c.k, c.f, c.q].join('|'), idx: i }));
  const byKey = Object.fromEntries(CARDS.map(c => [c.key, c]));
  const ORDER = { W: 0, U: 1, B: 2, R: 3, G: 4, M: 5, C: 6, L: 7 };
  const STORE = 'buylist-v1';
  const $ = id => document.getElementById(id);
  const money = n => n == null ? 'Ask' : '$' + Number(n).toFixed(2);
  const finishLabel = f => f === 'nonfoil' ? '' : f === 'etched' ? 'Etched foil' : 'Foil';

  // buylist: { key: qty }, kept in this browser so it survives a refresh
  let list = {};
  try { list = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { list = {}; }
  for (const k in list) if (!byKey[k]) delete list[k];
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch {} };

  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    kids.forEach(k => n.append(k));
    return n;
  };

  const total = CARDS.reduce((s, c) => s + c.qty, 0);
  $('sub').textContent = `${total} cards · prices in USD as of ${DATA.asof || ''} · tap a card image to zoom`;

  function filtered() {
    const q = $('q').value.trim().toLowerCase(), col = $('color').value, fin = $('finish').value, s = $('sort').value;
    const out = CARDS.filter(c =>
      (!col || c.g === col) &&
      (!fin || (fin === 'foil' ? c.f !== 'nonfoil' : c.f === 'nonfoil')) &&
      (!q || (c.n + ' ' + c.s + ' ' + c.c).toLowerCase().includes(q)));
    const nm = (a, b) => a.n.localeCompare(b.n);
    const p = c => c.p ?? -1;
    out.sort(s === 'pd' ? (a, b) => p(b) - p(a) || nm(a, b)
      : s === 'pa' ? (a, b) => p(a) - p(b) || nm(a, b)
      : s === 'n' ? nm
      : s === 's' ? (a, b) => a.s.localeCompare(b.s) || nm(a, b)
      : (a, b) => ORDER[a.g] - ORDER[b.g] || nm(a, b));
    return out;
  }

  function cardNode(c) {
    const inList = list[c.key] || 0;
    const img = el('img', { loading: 'lazy', alt: c.n, src: c.i || '' });
    img.addEventListener('click', () => { $('zoomImg').src = (c.i || '').replace('/normal/', '/large/'); $('zoom').hidden = false; });
    const fin = finishLabel(c.f);
    const name = el('div', { className: 't', textContent: c.n });
    if (fin) name.append(el('span', { className: 'tag', textContent: fin }));
    const avail = c.qty > 1 ? ` · ${c.qty} available` : '';
    const btn = el('button', {
      className: 'add' + (inList ? '' : ' primary'),
      textContent: inList ? (inList >= c.qty ? `In buylist (${inList}) ✓` : `In buylist (${inList}) · add 1 more`) : 'Add to buylist',
    });
    btn.addEventListener('click', () => {
      if ((list[c.key] || 0) >= c.qty) { openPanel(); return; }
      list[c.key] = (list[c.key] || 0) + 1; persist(); render(); toast(`Added ${c.n}`);
    });
    return el('div', { className: 'card' + (inList ? ' in' : '') }, [
      img, name,
      el('div', { className: 'meta', textContent: `${c.s} · #${c.k}` }),
      el('div', { className: 'row' }, [
        el('span', { className: 'price', textContent: money(c.p) }),
        el('span', { className: 'meta', textContent: c.q + avail }),
      ]),
      btn,
    ]);
  }

  function render() {
    const rows = filtered();
    $('grid').replaceChildren(...rows.map(cardNode));
    $('none').hidden = rows.length > 0;
    $('count').textContent = rows.length === CARDS.length ? `${rows.length} listings` : `${rows.length} of ${CARDS.length} listings`;
    renderList();
  }

  function lineFor(c, n) {
    const fin = finishLabel(c.f);
    return `${n}x ${c.n} (${c.s} #${c.k}${fin ? ', ' + fin : ''}, ${c.q}) ${money(c.p)}${n > 1 && c.p != null ? ' each' : ''}`;
  }

  function renderList() {
    const keys = Object.keys(list).sort((a, b) => byKey[a].n.localeCompare(byKey[b].n));
    let count = 0, sum = 0;
    const lis = keys.map(k => {
      const c = byKey[k], n = list[k];
      count += n; sum += (c.p || 0) * n;
      const qty = el('input', { type: 'number', min: 1, max: c.qty, value: n, ariaLabel: 'Quantity' });
      qty.addEventListener('change', () => { list[k] = Math.max(1, Math.min(c.qty, parseInt(qty.value, 10) || 1)); persist(); render(); });
      const rm = el('button', { className: 'rm', textContent: '✕', ariaLabel: 'Remove' });
      rm.addEventListener('click', () => { delete list[k]; persist(); render(); });
      const fin = finishLabel(c.f);
      return el('li', {}, [
        el('div', { className: 'info' }, [
          el('div', { textContent: c.n }),
          el('div', { className: 'muted', textContent: `${c.s}${fin ? ' · ' + fin : ''} · ${c.q} · ${money(c.p)}` }),
        ]),
        c.qty > 1 ? qty : el('span', { className: 'muted', textContent: '1' }),
        rm,
      ]);
    });
    $('items').replaceChildren(...lis);
    $('emptyList').hidden = keys.length > 0;
    $('badge').textContent = count;
    $('total').textContent = `${count} card${count === 1 ? '' : 's'} · $${sum.toFixed(2)}`;
    $('text').value = keys.length
      ? keys.map(k => lineFor(byKey[k], list[k])).join('\n') + `\n\nTotal: ${count} card${count === 1 ? '' : 's'}, $${sum.toFixed(2)}`
      : '';
  }

  function openPanel() { $('panel').classList.add('open'); $('shade').hidden = false; }
  function closePanel() { $('panel').classList.remove('open'); $('shade').hidden = true; }
  let tt;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 1800); }

  $('openList').addEventListener('click', openPanel);
  $('closeList').addEventListener('click', closePanel);
  $('shade').addEventListener('click', closePanel);
  $('zoom').addEventListener('click', () => { $('zoom').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); $('zoom').hidden = true; } });
  $('clear').addEventListener('click', () => { if (Object.keys(list).length && confirm('Clear your whole buylist?')) { list = {}; persist(); render(); } });
  $('copy').addEventListener('click', async () => {
    const txt = $('text').value;
    if (!txt) { toast('Add some cards first'); return; }
    try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it in your message.'); }
    catch { $('text').select(); toast('Press Ctrl+C (or long-press → Copy)'); }
  });
  ['q'].forEach(id => $(id).addEventListener('input', render));
  ['color', 'finish', 'sort'].forEach(id => $(id).addEventListener('change', render));

  render();
})();
