// Central de Pedidos SGP — página própria (GitHub Pages) com os dados no Supabase (18/11/2026).
// Qualquer pessoa vê o quadro e abre pedido, sem conta. Só o dono (entrada por link no e-mail) move, prioriza e recusa.
(() => {
  const SUPABASE_URL = 'https://bnpftglrbcppfapirysg.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucGZ0Z2xyYmNwcGZhcGlyeXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDk5NDQsImV4cCI6MjExMDA4NTk0NH0.-mW67xz3635E8Q5GYuBSCYVJY4u-db3gEmZCNcMfYxM'; // a chave pública: só deixa fazer o que as regras do banco permitem
  const BUCKET = 'prints';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: true, detectSessionInUrl: true } });

  const COLUNAS = [
    { id: 'novo', nome: 'Novas solicitações', cor: 'var(--novo)', soft: 'var(--novo-soft)' },
    { id: 'a_fazer', nome: 'A fazer', cor: 'var(--fazer)', soft: 'var(--fazer-soft)' },
    { id: 'em_progresso', nome: 'Em progresso', cor: 'var(--prog)', soft: 'var(--prog-soft)' },
    { id: 'concluido', nome: 'Concluídos', cor: 'var(--feito)', soft: 'var(--feito-soft)' },
  ];
  const TIPOS = ['Ajuste', 'Mudança', 'Nova funcionalidade', 'Defeito', 'Dúvida'];
  const NOME_ESTADO = { novo: 'Nova', a_fazer: 'A fazer', em_progresso: 'Em progresso', concluido: 'Concluído', recusado: 'Recusada' };
  const st = { pedidos: [], carregado: false, souDono: false, email: null, dias: new Set(), mes: new Date(new Date().getFullYear(), new Date().getMonth(), 1), busca: '', verRecusadas: true };

  // ── utilitários ──
  const $ = (s) => document.querySelector(s);
  function el(tag, attrs = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') e.setAttribute('style', v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f instanceof Node ? f : document.createTextNode(String(f)));
    return e;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const diaIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = (s) => { if (!s) return null; const d = new Date(String(s).length === 10 ? s + 'T12:00:00' : s); return isNaN(d) ? null : d; };
  const dataBr = (s) => { const d = deIso(s); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—'; };
  const diaLocal = (s) => { const d = deIso(s); return d ? diaIso(d) : ''; };
  const hojeIso = () => diaIso(new Date());
  const urlFoto = (caminho) => sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lerLocal = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  st.verRecusadas = lerLocal('cp:recusadas') !== '0';
  $('#ver-recusadas').checked = st.verRecusadas;

  let tAviso = null;
  function aviso(txt) { const a = $('#aviso'); a.textContent = txt; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => { a.hidden = true; }, 7000); }

  // ── dados ──
  async function carregar() {
    const { data, error } = await sb.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(2000);
    if (error) { aviso('Não foi possível carregar os pedidos agora. Tente de novo em instantes.'); return; }
    st.pedidos = data.map((p) => ({ ...p, estado: p.status }));
    st.carregado = true;
    render();
  }

  function dataDoPedido(p) {
    if (p.estado === 'novo' || p.estado === 'recusado') return diaLocal(p.criado_em);
    if (p.estado === 'concluido') return diaLocal(p.concluido_em || p.entrega);
    return p.entrega ? String(p.entrega).slice(0, 10) : '';
  }
  const colunaDe = (p) => (p.estado === 'recusado' ? 'novo' : p.estado);
  function visivel(p) {
    if (p.estado === 'recusado' && !st.verRecusadas) return false;
    if (st.dias.size && !st.dias.has(dataDoPedido(p))) return false;
    if (st.busca) {
      const alvo = [p.titulo, p.descricao, p.tipo, p.solicitante].join(' ').toLowerCase();
      if (!alvo.includes(st.busca)) return false;
    }
    return true;
  }

  // ── quadro ──
  function render() {
    const q = $('#quadro');
    q.replaceChildren();
    for (const c of COLUNAS) {
      const itens = st.pedidos.filter((p) => colunaDe(p) === c.id && visivel(p));
      if (c.id === 'novo') itens.sort((a, b) => (a.estado === 'recusado') - (b.estado === 'recusado') || String(b.criado_em).localeCompare(String(a.criado_em)));
      else if (c.id === 'concluido') itens.sort((a, b) => String(b.concluido_em).localeCompare(String(a.concluido_em)));
      else itens.sort((a, b) => (a.prioridade ?? 9999) - (b.prioridade ?? 9999) || String(a.entrega).localeCompare(String(b.entrega)));
      const ativos = itens.filter((p) => p.estado !== 'recusado').length;
      const col = el('section', { class: 'col', 'aria-label': c.nome },
        el('div', { class: 'col-cab' }, el('h2', {}, el('i', { style: `background:${c.cor}` }), c.nome), el('span', { class: 'cont', text: String(ativos) })));
      if (!st.carregado) col.append(el('div', { class: 'vazio', text: 'Carregando os pedidos…' }));
      else if (!itens.length) col.append(el('div', { class: 'vazio', text: c.id === 'novo' ? 'Nenhuma solicitação nova. Use "+ Nova solicitação" para pedir um ajuste ou uma mudança.' : (st.dias.size || st.busca ? 'Nada nesta coluna com o filtro.' : 'Nada aqui por enquanto.') }));
      itens.forEach((p, i) => col.append(cartao(p, c, itens, i)));
      q.append(col);
    }
    renderCalendario();
  }

  function cartao(p, c, irmaos, i) {
    const atrasado = (p.estado === 'a_fazer' || p.estado === 'em_progresso') && p.entrega && String(p.entrega) < hojeIso();
    const meta = el('div', { class: 'meta' },
      p.historico ? null : el('span', { text: p.solicitante }),
      p.historico ? null : el('span', { text: 'Pedido em ' + dataBr(p.criado_em) }),
      p.entrega && p.estado !== 'novo' && p.estado !== 'recusado' ? el('span', { class: atrasado ? 'atraso' : '', text: (atrasado ? 'Atrasado · entrega ' : 'Entrega ') + dataBr(p.entrega) }) : null,
      p.estado === 'concluido' && p.concluido_em ? el('span', { text: (p.historico ? 'Em produção desde ' : 'Concluído em ') + dataBr(p.concluido_em) }) : null,
      (p.imagens || []).length ? el('span', { text: '🖼 ' + p.imagens.length }) : null);
    const linha1 = el('div', { class: 'linha1' },
      p.prioridade != null && (p.estado === 'a_fazer' || p.estado === 'em_progresso') ? el('span', { class: 'prio', title: 'Prioridade', text: 'P' + p.prioridade }) : null,
      el('span', { class: 'tipo', text: p.tipo || 'Pedido' }),
      p.estado === 'recusado' ? el('span', { class: 'estado', style: 'background:var(--surface-2);color:var(--ink-2)', text: 'Recusada' }) : null);
    if (st.souDono && (p.estado === 'a_fazer' || p.estado === 'em_progresso')) {
      linha1.append(el('span', { class: 'ordem' },
        el('button', { type: 'button', title: 'Subir a prioridade', 'aria-label': 'Subir a prioridade', disabled: i === 0, onclick: (e) => { e.stopPropagation(); trocar(irmaos, i, i - 1); } }, '▲'),
        el('button', { type: 'button', title: 'Descer a prioridade', 'aria-label': 'Descer a prioridade', disabled: i === irmaos.length - 1, onclick: (e) => { e.stopPropagation(); trocar(irmaos, i, i + 1); } }, '▼')));
    }
    return el('button', { type: 'button', class: 'card' + (p.estado === 'recusado' ? ' recusado' : ''), style: `--cor:${c.cor}`, onclick: () => abrirDetalhe(p.id) },
      linha1, el('h3', { text: p.titulo || '(sem título)' }), meta,
      p.estado === 'recusado' && p.motivo ? el('div', { class: 'motivo', text: 'Motivo: ' + p.motivo }) : null);
  }

  // ── calendário ──
  function renderCalendario() {
    const m = st.mes;
    $('#mes-nome').textContent = m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const g = $('#cal-grade');
    g.replaceChildren(...['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => el('div', { class: 'cal-sem', text: d })));
    const porDia = {};
    for (const p of st.pedidos) {
      if (p.estado === 'recusado' && !st.verRecusadas) continue;
      const d = dataDoPedido(p); if (!d) continue;
      (porDia[d] ||= []).push(p.estado);
    }
    const ini = new Date(m.getFullYear(), m.getMonth(), 1 - m.getDay());
    for (let k = 0; k < 42; k++) {
      const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + k);
      const iso = diaIso(d);
      const est = porDia[iso] || [];
      const cores = [...new Set(est)].map((e) => ({ novo: 'var(--novo)', recusado: 'var(--recusa)', a_fazer: 'var(--fazer)', em_progresso: 'var(--prog)', concluido: 'var(--feito)' })[e]);
      g.append(el('button', { type: 'button', class: 'cal-dia' + (d.getMonth() !== m.getMonth() ? ' fora' : '') + (iso === hojeIso() ? ' hoje' : '') + (st.dias.has(iso) ? ' sel' : ''),
        'aria-pressed': st.dias.has(iso) ? 'true' : 'false', 'aria-label': `${dataBr(iso)}: ${est.length} pedido(s)`,
        onclick: () => { st.dias.has(iso) ? st.dias.delete(iso) : st.dias.add(iso); render(); atualizarChip(); } },
        String(d.getDate()),
        cores.length ? el('span', { class: 'pontos' }, cores.map((c) => el('i', { style: `background:${c}` }))) : null,
        est.length ? el('span', { class: 'n', text: String(est.length) }) : null));
    }
  }
  function atualizarChip() {
    const chip = $('#chip-dias');
    if (!st.dias.size) { chip.hidden = true; return; }
    const ds = [...st.dias].sort();
    chip.hidden = false;
    chip.replaceChildren('Filtro: ', el('b', { text: ds.length <= 3 ? ds.map(dataBr).join(', ') : `${ds.length} dias` }), ' ',
      el('button', { type: 'button', class: 'btn peq', onclick: () => { st.dias.clear(); render(); atualizarChip(); } }, 'Limpar'));
  }
  $('#btn-cal').onclick = () => { const c = $('#cal'); c.hidden = !c.hidden; $('#btn-cal').setAttribute('aria-expanded', String(!c.hidden)); };
  $('#mes-ant').onclick = () => { st.mes = new Date(st.mes.getFullYear(), st.mes.getMonth() - 1, 1); renderCalendario(); };
  $('#mes-prox').onclick = () => { st.mes = new Date(st.mes.getFullYear(), st.mes.getMonth() + 1, 1); renderCalendario(); };
  $('#cal-hoje').onclick = () => { st.dias = new Set([hojeIso()]); st.mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render(); atualizarChip(); };
  $('#cal-semana').onclick = () => { const h = new Date(); const s = new Set(); for (let k = 0; k < 7; k++) s.add(diaIso(new Date(h.getFullYear(), h.getMonth(), h.getDate() - h.getDay() + k))); st.dias = s; render(); atualizarChip(); };
  $('#cal-limpar').onclick = () => { st.dias.clear(); render(); atualizarChip(); };
  $('#busca').addEventListener('input', (e) => { st.busca = e.target.value.trim().toLowerCase(); render(); });
  $('#ver-recusadas').addEventListener('change', (e) => { st.verRecusadas = e.target.checked; guardar('cp:recusadas', st.verRecusadas ? '1' : '0'); render(); });

  // ── modais ──
  function abrirModal(conteudo) {
    const fundo = el('div', { class: 'fundo', role: 'dialog', 'aria-modal': 'true' });
    const fechar = () => { fundo.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') fechar(); };
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', esc);
    fundo.append(conteudo(fechar));
    $('#modais').append(fundo);
    const foco = fundo.querySelector('input, textarea, select, button');
    foco && foco.focus();
    return fechar;
  }

  // nova solicitação: sem conta; o nome de quem pede é digitado (e lembrado neste aparelho)
  $('#btn-novo').onclick = () => {
    const fotos = []; // {caminho, url, subindo, nome}
    let enviando = false;
    abrirModal((fechar) => {
      const nome = el('input', { id: 'f-nome', maxlength: '80', placeholder: 'Ex.: Luiza (Planejamento)', value: st.souDono ? '' : (lerLocal('cp:nome') || '') });
      const titulo = el('input', { id: 'f-titulo', maxlength: '120', placeholder: 'Ex.: PDF da OP sem a coluna de prioridade' });
      const tipo = el('select', { id: 'f-tipo' }, TIPOS.map((t) => el('option', { value: t, text: t })));
      const desc = el('textarea', { id: 'f-desc', maxlength: '6000', placeholder: 'O que acontece hoje, o que deveria acontecer, em qual tela, e um exemplo (OP, bloco, data…).' });
      const mini = el('div', { class: 'mini' });
      const erro = el('div', { class: 'erro', hidden: true });
      const desenhaMini = () => mini.replaceChildren(...fotos.map((f, i) => el('figure', {},
        f.url ? el('img', { src: f.url, alt: f.nome || 'imagem' }) : null,
        f.subindo ? el('span', { class: 'subindo', text: 'Enviando…' }) : null,
        el('button', { type: 'button', 'aria-label': 'Tirar a imagem', onclick: () => { fotos.splice(i, 1); desenhaMini(); } }, '×'))));
      async function anexar(arquivos) {
        for (const a of arquivos) {
          if (!a.type.startsWith('image/')) continue;
          if (fotos.length >= 8) { erro.hidden = false; erro.textContent = 'No máximo 8 imagens por pedido.'; break; }
          if (a.size > 10 * 1024 * 1024) { erro.hidden = false; erro.textContent = 'A imagem ' + (a.name || '') + ' passa de 10 MB.'; continue; }
          const f = { caminho: null, url: URL.createObjectURL(a), subindo: true, nome: a.name };
          fotos.push(f); desenhaMini();
          const ext = (a.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          const caminho = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
          const { error } = await sb.storage.from(BUCKET).upload(caminho, a, { contentType: a.type, upsert: false });
          if (error) { fotos.splice(fotos.indexOf(f), 1); erro.hidden = false; erro.textContent = 'A imagem ' + (a.name || '') + ' não subiu. Tente de novo.'; }
          else { f.caminho = caminho; f.subindo = false; }
          desenhaMini();
        }
      }
      const inputArq = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, id: 'f-arq', onchange: (e) => anexar([...e.target.files]) });
      const solta = el('div', { class: 'solta' }, 'Arraste prints aqui, cole com Ctrl+V / ⌘V, ou ', el('button', { type: 'button', class: 'btn peq', onclick: () => inputArq.click() }, 'escolha as imagens'), inputArq);
      solta.addEventListener('dragover', (e) => { e.preventDefault(); solta.classList.add('sobre'); });
      solta.addEventListener('dragleave', () => solta.classList.remove('sobre'));
      solta.addEventListener('drop', (e) => { e.preventDefault(); solta.classList.remove('sobre'); anexar([...e.dataTransfer.files]); });
      const botao = el('button', { type: 'submit', class: 'btn prim', text: 'Enviar pedido' });
      const modal = el('form', { class: 'modal', onsubmit: async (e) => {
        e.preventDefault();
        if (enviando) return;
        if (!nome.value.trim()) { erro.hidden = false; erro.textContent = st.souDono ? 'Diga em nome de quem é o pedido (ou o seu nome).' : 'Digite o seu nome.'; nome.focus(); return; }
        if (!titulo.value.trim()) { erro.hidden = false; erro.textContent = 'Dê um nome ao pedido.'; titulo.focus(); return; }
        if (fotos.some((f) => f.subindo)) { erro.hidden = false; erro.textContent = 'Espere as imagens terminarem de subir.'; return; }
        enviando = true; botao.disabled = true; botao.textContent = 'Enviando…';
        const linha = { titulo: titulo.value.trim(), tipo: tipo.value, descricao: desc.value.trim(), solicitante: nome.value.trim(), imagens: fotos.map((f) => f.caminho).filter(Boolean) };
        if (st.souDono) linha.aberto_pelo_dono = true;
        const { error } = await sb.from('pedidos').insert(linha);
        if (error) { enviando = false; botao.disabled = false; botao.textContent = 'Enviar pedido'; erro.hidden = false; erro.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.'; return; }
        if (!st.souDono) guardar('cp:nome', nome.value.trim());
        fechar(); aviso('Pedido enviado. Ele aparece em Novas solicitações.'); carregar();
      } },
        el('h2', { text: 'Nova solicitação' }),
        el('div', { class: 'campo' }, el('label', { for: 'f-nome', text: st.souDono ? 'Em nome de (quem pediu)' : 'Seu nome' }), nome),
        el('div', { class: 'campo' }, el('label', { for: 'f-titulo', text: 'Nome do pedido' }), titulo),
        el('div', { class: 'duas' },
          el('div', { class: 'campo' }, el('label', { for: 'f-tipo', text: 'Tipo' }), tipo),
          el('div', { class: 'campo' }, el('label', { text: 'Data do pedido' }), el('input', { value: dataBr(new Date().toISOString()), disabled: true }))),
        el('div', { class: 'campo' }, el('label', { for: 'f-desc', text: 'Descrição' }), desc),
        el('div', { class: 'campo' }, el('label', { text: 'Imagens e prints (opcional)' }), solta, mini),
        erro,
        el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'btn', onclick: fechar }, 'Cancelar'), botao));
      modal.addEventListener('paste', (e) => { const fs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/')); if (fs.length) { e.preventDefault(); anexar(fs); } });
      return modal;
    });
  };

  function abrirDetalhe(id) {
    const p = st.pedidos.find((x) => x.id === id);
    if (!p) return;
    const col = COLUNAS.find((c) => c.id === colunaDe(p));
    abrirModal((fechar) => {
      const corEstado = p.estado === 'recusado' ? 'background:var(--surface-2);color:var(--ink-2)' : `background:${col.soft};color:${col.cor}`;
      const m = el('div', { class: 'modal' },
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          el('span', { class: 'estado', style: corEstado, text: NOME_ESTADO[p.estado] }),
          el('span', { class: 'tipo', text: p.tipo || 'Pedido' }),
          p.prioridade != null && (p.estado === 'a_fazer' || p.estado === 'em_progresso') ? el('span', { class: 'prio', text: 'Prioridade ' + p.prioridade }) : null),
        el('h2', { text: p.titulo || '(sem título)' }),
        el('div', { class: 'linha-info' },
          p.historico ? null : el('span', { text: 'Pedido por ' + p.solicitante + (p.aberto_pelo_dono ? ' (aberto pelo Jaime)' : '') }),
          p.historico ? null : el('span', { text: 'em ' + dataBr(p.criado_em) }),
          p.entrega ? el('span', { text: 'Entrega estimada: ' + dataBr(p.entrega) }) : null,
          p.iniciado_em ? el('span', { text: 'Iniciado em ' + dataBr(p.iniciado_em) }) : null,
          p.concluido_em ? el('span', { text: (p.historico ? 'Em produção desde ' : 'Concluído em ') + dataBr(p.concluido_em) }) : null),
        p.estado === 'recusado' && p.motivo ? el('div', { class: 'motivo', text: 'Recusada. Motivo: ' + p.motivo }) : null,
        p.descricao ? el('div', { class: 'det-desc', text: p.descricao }) : (p.historico ? null : el('div', { class: 'quem', text: 'Sem descrição.' })),
        (p.imagens || []).length ? el('div', { class: 'det-fotos' }, p.imagens.map((a) => el('a', { href: urlFoto(a), target: '_blank', rel: 'noopener' }, el('img', { src: urlFoto(a), alt: 'imagem do pedido', loading: 'lazy' })))) : null);
      const acoes = el('div', { class: 'acoes' });
      if (st.souDono) {
        const f = (rotulo, cls, fn) => el('button', { type: 'button', class: 'btn ' + cls, onclick: fn }, rotulo);
        acoes.append(f('✏️ Editar', 'esq', () => { fechar(); editar(p); }));
        if (p.estado === 'novo') acoes.append(f('Recusar', 'perigo esq', () => { fechar(); recusar(p); }), f('Aceitar e mover para A fazer', 'prim', () => { fechar(); aceitar(p); }));
        else if (p.estado === 'recusado') acoes.append(f('Desfazer a recusa', 'esq', () => { fechar(); mudar(p.id, { status: 'novo', motivo: null }); }), f('Aceitar e mover para A fazer', 'prim', () => { fechar(); aceitar(p); }));
        else if (p.estado === 'a_fazer') acoes.append(f('Voltar para Novas', 'esq', () => { fechar(); mudar(p.id, { status: 'novo', prioridade: null }); }), f('Mudar prioridade e data', '', () => { fechar(); aceitar(p, true); }), f('Começar (Em progresso)', 'prim', () => { fechar(); mudar(p.id, { status: 'em_progresso', iniciado_em: new Date().toISOString() }); }));
        else if (p.estado === 'em_progresso') acoes.append(f('Voltar para A fazer', 'esq', () => { fechar(); mudar(p.id, { status: 'a_fazer' }); }), f('Mudar prioridade e data', '', () => { fechar(); aceitar(p, true); }), f('Concluir', 'prim', () => { fechar(); mudar(p.id, { status: 'concluido', concluido_em: new Date().toISOString(), prioridade: null }); }));
        else if (p.estado === 'concluido' && !p.historico) acoes.append(f('Reabrir (Em progresso)', 'esq', () => { fechar(); mudar(p.id, { status: 'em_progresso', concluido_em: null }); }));
      }
      acoes.append(el('button', { type: 'button', class: 'btn', onclick: fechar }, 'Fechar'));
      m.append(acoes);
      return m;
    });
  }

  // o dono corrige o que foi pedido: nome, tipo, descrição e quem pediu
  function editar(p) {
    abrirModal((fechar) => {
      const titulo = el('input', { id: 'e-titulo', maxlength: '160', value: p.titulo || '' });
      const tipo = el('select', { id: 'e-tipo' }, TIPOS.map((t) => el('option', { value: t, text: t, selected: t === p.tipo })));
      const quem = el('input', { id: 'e-quem', maxlength: '80', value: p.solicitante || '' });
      const desc = el('textarea', { id: 'e-desc', maxlength: '6000' }); desc.value = p.descricao || '';
      const erro = el('div', { class: 'erro', hidden: true });
      return el('form', { class: 'modal', onsubmit: async (e) => {
        e.preventDefault();
        if (!titulo.value.trim() || !quem.value.trim()) { erro.hidden = false; erro.textContent = 'O nome do pedido e quem pediu não podem ficar em branco.'; return; }
        fechar();
        await mudar(p.id, { titulo: titulo.value.trim(), tipo: tipo.value, descricao: desc.value.trim(), solicitante: quem.value.trim() });
        aviso('Pedido salvo.');
      } },
        el('h2', { text: 'Editar o pedido' }),
        el('div', { class: 'campo' }, el('label', { for: 'e-titulo', text: 'Nome do pedido' }), titulo),
        el('div', { class: 'duas' },
          el('div', { class: 'campo' }, el('label', { for: 'e-tipo', text: 'Tipo' }), tipo),
          el('div', { class: 'campo' }, el('label', { for: 'e-quem', text: 'Quem pediu' }), quem)),
        el('div', { class: 'campo' }, el('label', { for: 'e-desc', text: 'Descrição' }), desc),
        erro,
        el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'btn', onclick: fechar }, 'Cancelar'), el('button', { type: 'submit', class: 'btn prim', text: 'Salvar' })));
    });
  }

  function aceitar(p, editar = false) {
    const ativos = st.pedidos.filter((x) => (x.estado === 'a_fazer' || x.estado === 'em_progresso') && x.id !== p.id);
    const sugestao = editar && p.prioridade != null ? p.prioridade : ativos.length + 1;
    abrirModal((fechar) => {
      const data = el('input', { type: 'date', id: 'f-entrega', value: p.entrega || '', min: editar ? null : hojeIso(), required: true });
      const prio = el('input', { type: 'number', id: 'f-prio', min: '1', max: String(ativos.length + 1), value: String(sugestao), required: true });
      const erro = el('div', { class: 'erro', hidden: true });
      return el('form', { class: 'modal', onsubmit: async (e) => {
        e.preventDefault();
        if (!data.value) { erro.hidden = false; erro.textContent = 'Escolha a data estimada de entrega.'; return; }
        const n = Math.max(1, Math.min(ativos.length + 1, parseInt(prio.value, 10) || ativos.length + 1));
        fechar();
        await reordenar(p, n, { status: editar ? p.estado : 'a_fazer', entrega: data.value, motivo: null, aceito_em: p.aceito_em || new Date().toISOString() });
      } },
        el('h2', { text: editar ? 'Prioridade e data' : 'Aceitar o pedido' }),
        el('div', { class: 'quem', text: p.titulo }),
        el('div', { class: 'duas' },
          el('div', { class: 'campo' }, el('label', { for: 'f-entrega', text: 'Data estimada de entrega' }), data),
          el('div', { class: 'campo' }, el('label', { for: 'f-prio', text: `Prioridade (1 = primeiro; hoje há ${ativos.length} na fila)` }), prio)),
        erro,
        el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'btn', onclick: fechar }, 'Cancelar'), el('button', { type: 'submit', class: 'btn prim', text: editar ? 'Salvar' : 'Mover para A fazer' })));
    });
  }
  function recusar(p) {
    abrirModal((fechar) => {
      const motivo = el('textarea', { id: 'f-motivo', maxlength: '1000', placeholder: 'Ex.: já existe na tela X; ou fica para depois da entrega do shot.', required: true });
      return el('form', { class: 'modal', onsubmit: async (e) => {
        e.preventDefault();
        if (!motivo.value.trim()) return;
        fechar();
        await mudar(p.id, { status: 'recusado', motivo: motivo.value.trim(), prioridade: null, entrega: null });
      } },
        el('h2', { text: 'Recusar o pedido' }),
        el('div', { class: 'quem', text: p.titulo }),
        el('div', { class: 'campo' }, el('label', { for: 'f-motivo', text: 'Motivo (quem pediu vai ler)' }), motivo),
        el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'btn', onclick: fechar }, 'Cancelar'), el('button', { type: 'submit', class: 'btn perigo', text: 'Recusar' })));
    });
  }

  // ── gravação do dono ──
  async function mudar(id, campos, recarregar = true) {
    const { error } = await sb.from('pedidos').update({ ...campos, atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) aviso('Não foi possível salvar: ' + error.message);
    if (recarregar) await carregar();
  }
  async function reordenar(p, n, campos) {
    const fila = st.pedidos.filter((x) => (x.estado === 'a_fazer' || x.estado === 'em_progresso') && x.id !== p.id).sort((a, b) => (a.prioridade ?? 9999) - (b.prioridade ?? 9999));
    fila.splice(n - 1, 0, p);
    await mudar(p.id, { ...campos, prioridade: n }, false);
    for (let k = 0; k < fila.length; k++) {
      const x = fila[k];
      if (x.id !== p.id && x.prioridade !== k + 1) await mudar(x.id, { prioridade: k + 1 }, false);
    }
    await carregar();
  }
  async function trocar(lista, i, j) {
    const a = lista[i], b = lista[j];
    if (!a || !b) return;
    const pa = a.prioridade ?? i + 1, pb = b.prioridade ?? j + 1;
    await mudar(a.id, { prioridade: pb }, false);
    await mudar(b.id, { prioridade: pa }, false);
    await carregar();
  }

  // ── a entrada do dono (link no e-mail), pelo botão do topo ──
  function entrarComoDono() {
    abrirModal((fechar) => {
      const email = el('input', { type: 'email', id: 'f-email', placeholder: 'seu e-mail', value: lerLocal('cp:email-dono') || '' });
      const msg = el('div', { class: 'quem' });
      return el('form', { class: 'modal', onsubmit: async (e) => {
        e.preventDefault();
        if (!email.value.trim()) return;
        guardar('cp:email-dono', email.value.trim());
        const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
        msg.textContent = error ? 'Não foi possível mandar o link: ' + error.message : 'Pronto: enviamos um link de entrada para ' + email.value.trim() + '. Abra o e-mail NESTE computador e clique no link (olhe também o spam).';
      } },
        el('h2', { text: 'Entrar como dono' }),
        el('div', { class: 'quem', text: 'Só o dono do quadro aceita, prioriza, edita e recusa pedidos. Digite o seu e-mail para receber o link de entrada (não tem senha).' }),
        el('div', { class: 'campo' }, el('label', { for: 'f-email', text: 'E-mail' }), email),
        msg,
        el('div', { class: 'acoes' }, el('button', { type: 'button', class: 'btn', onclick: fechar }, 'Fechar'), el('button', { type: 'submit', class: 'btn prim', text: 'Receber link de entrada' })));
    });
  }
  async function verDono() {
    const { data } = await sb.auth.getSession();
    st.email = data.session?.user?.email || null;
    st.souDono = false;
    if (st.email) {
      const r = await sb.rpc('eh_dono');
      st.souDono = r.data === true;
    }
    const btn = $('#btn-dono');
    if (st.souDono) {
      $('#quem').replaceChildren('Você: ', el('b', { text: st.email }), el('span', { class: 'selo-dono', text: 'dono do quadro' }));
      btn.textContent = 'Sair';
      btn.onclick = async () => { await sb.auth.signOut(); await verDono(); render(); };
    } else {
      $('#quem').textContent = st.email ? 'Você entrou como ' + st.email + ', que não é o dono do quadro.' : '';
      btn.textContent = st.email ? 'Sair' : '🔑 Entrar como dono';
      btn.onclick = st.email ? async () => { await sb.auth.signOut(); await verDono(); render(); } : entrarComoDono;
    }
    $('#rodape').replaceChildren();
  }
  sb.auth.onAuthStateChange(() => { verDono().then(render); });

  render();
  verDono().then(carregar);
  setInterval(() => { if (!document.hidden && !document.querySelector('.fundo')) carregar(); }, 30000);
})();
