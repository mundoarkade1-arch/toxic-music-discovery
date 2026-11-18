// Página do Toxic Music Discovery. Todo texto vindo de fora (títulos do YouTube etc.) entra como TEXTO, nunca como HTML.
'use strict';
const $ = (s) => document.querySelector(s);
const PREFIXO_YOUTUBE = 'https://www.youtube.com/watch?v=';

function h(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}

async function api(caminho, corpo) {
  const r = await fetch(caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
  return j;
}

let slugAtual = '';
let resultadoAtual = null;
let temporizador = null;

function aviso(texto, tipo = '') {
  const el = $('#mensagem');
  el.hidden = !texto;
  el.className = 'aviso ' + tipo;
  el.textContent = texto || '';
}
function chip(id, texto, tipo) { const e = $(id); e.textContent = texto; e.className = 'chip ' + tipo; }

const seguro = (url) => (typeof url === 'string' && url.startsWith(PREFIXO_YOUTUBE) ? url : '#');
const dataBonita = (iso) => { try { return new Date(iso).toLocaleString('pt-BR'); } catch { return ''; } };
const minseg = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

// ---------- situação ----------
async function carregarEstado() {
  const e = await api('/api/estado');
  chip('#chip-chave', e.chaveYoutube ? 'YouTube: chave encontrada' : 'YouTube: FALTA a chave', e.chaveYoutube ? 'bom' : 'ruim');
  chip('#chip-cota', `Pesquisas de hoje: ${e.cota.pesquisasRestantes} de ${e.cota.pesquisasPorDia}`, e.cota.pesquisasRestantes > 10 ? 'bom' : 'neutro');
  if (!e.biblioteca) chip('#chip-biblioteca', 'Biblioteca: não carregada', 'neutro');
  else chip('#chip-biblioteca', `Biblioteca: ${e.biblioteca.faixas} músicas${e.usarBiblioteca ? '' : ' (não usada)'}`, 'bom');
  if (!$('#limite').dataset.mexeu) $('#limite').value = e.limiteMusicas;
  desenharHistorico(e.historico);
  return e;
}

function desenharHistorico(lista) {
  $('#historico-area').hidden = !lista.length;
  $('#historico').replaceChildren(...lista.map((a) => h('button', { type: 'button', class: 'leve', title: `Pesquisado em ${dataBonita(a.quando)}`, onclick: () => abrirResultado(a.slug) }, a.nome)));
}

// ---------- pesquisa ----------
function mostrarJob(job) {
  $('#progresso').hidden = !job.rodando;
  $('#btn-pesquisar').disabled = job.rodando;
  $('#btn-parar').hidden = !job.rodando;
  if (!job.rodando) return;
  const pct = job.total ? Math.round((job.feitas / job.total) * 100) : 0;
  $('#barra-preench').style.width = pct + '%';
  $('#progresso-texto').textContent = job.total ? `${job.feitas} de ${job.total}. ${job.mensagem}` : job.mensagem;
}

function textoDoFim(job, r) {
  if (job.erro) return { texto: job.erro, tipo: 'erro' };
  if (!r) return { texto: '' };
  const partes = [];
  if (r.jaSalvas) partes.push(`${r.jaSalvas} música(s) já tinham resposta salva (não gastaram pesquisa).`);
  if (r.naBiblioteca) partes.push(`${r.naBiblioteca} música(s) já estão na sua biblioteca (não foram pesquisadas).`);
  if (r.exato === false) partes.push(`Atenção: não achei exatamente esse nome. Usei "${r.nome}". Confira se é o artista certo.`);
  if (r.parou === 'cota_local' || r.parou === 'cota_youtube') {
    partes.push('Parei porque as pesquisas de hoje acabaram. O que já foi achado está salvo. Pesquise o mesmo artista amanhã para continuar de onde parou.');
    return { texto: partes.join('\n'), tipo: 'erro' };
  }
  if (r.parou === 'erros') { partes.push(`Parei depois de 3 erros seguidos: ${r.erro}`); return { texto: partes.join('\n'), tipo: 'erro' }; }
  if (r.parou === 'usuario') partes.push('Pesquisa parada por você. O que já foi achado está salvo.');
  else partes.push(`Pronto. Foram pesquisadas ${r.pesquisadas} música(s).`);
  return { texto: partes.join('\n'), tipo: r.parou ? '' : 'ok' };
}

async function acompanhar() {
  clearInterval(temporizador);
  temporizador = setInterval(async () => {
    let e;
    try { e = await carregarEstado(); } catch { return; }
    mostrarJob(e.job);
    if (!e.job.rodando) {
      clearInterval(temporizador);
      const { texto, tipo } = textoDoFim(e.job, e.job.resumo);
      aviso(texto, tipo);
      if (e.job.resumo) await abrirResultado(e.job.resumo.slug, true);
    }
  }, 1000);
}

$('#form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  aviso('');
  try {
    await api('/api/pesquisar', { artista: $('#artista').value, limite: Number($('#limite').value) });
    mostrarJob({ rodando: true, total: 0, feitas: 0, mensagem: 'Começando...' });
    acompanhar();
  } catch (e) { aviso(e.message, 'erro'); }
});
$('#limite').addEventListener('input', () => { $('#limite').dataset.mexeu = '1'; });
$('#btn-parar').addEventListener('click', () => api('/api/parar', {}).catch(() => {}));

$('#btn-testar').addEventListener('click', async () => {
  const caixa = $('#teste');
  caixa.hidden = false; caixa.className = 'aviso'; caixa.textContent = 'Testando...';
  try {
    const r = await api('/api/testar', {});
    caixa.textContent = `${r.deezer.ok ? 'OK' : 'PROBLEMA'} - ${r.deezer.mensagem}\n${r.youtube.ok ? 'OK' : 'PROBLEMA'} - ${r.youtube.mensagem}`;
    caixa.className = 'aviso ' + (r.deezer.ok && r.youtube.ok ? 'ok' : 'erro');
    carregarEstado();
  } catch (e) { caixa.textContent = e.message; caixa.className = 'aviso erro'; }
});

// ---------- resultado ----------
async function abrirResultado(slug, mantemAviso = false) {
  try {
    resultadoAtual = await api('/api/resultado?artista=' + encodeURIComponent(slug));
    slugAtual = slug;
    if (!mantemAviso) aviso('');
    desenharResultado();
  } catch (e) { aviso(e.message, 'erro'); }
}

async function decidir(chave, acao, videoId) {
  try {
    await api('/api/decidir', { artista: slugAtual, chave, acao, videoId });
    await abrirResultado(slugAtual, true);
  } catch (e) { aviso(e.message, 'erro'); }
}

function agrupar(itens) {
  if ($('#ordem').value !== 'album') return [{ album: '', itens }];
  const mapa = new Map();
  for (const it of itens) { const k = it.album || 'Sem álbum'; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(it); }
  return [...mapa].map(([album, lista]) => ({ album, itens: lista }));
}

function linhaEncontrada(it) {
  return h('li', { class: 'musica' },
    h('span', { class: 'num' }, it.ordem),
    h('div', {},
      h('div', { class: 'titulo' }, it.titulo),
      h('div', { class: 'sec' }, `${it.video.canal}${it.manual ? ' · aprovada por você' : ''}`),
      h('a', { class: 'link', href: seguro(it.video.url), target: '_blank', rel: 'noopener noreferrer' }, it.video.url)),
    h('div', { class: 'botoes' }, h('button', { type: 'button', class: 'pequeno', onclick: () => decidir(it.chave, 'descartar') }, 'Descartar')));
}

function linhaConferir(it) {
  const cands = it.candidatos.map((c) => h('div', { class: 'cand' },
    h('div', {},
      h('div', { class: 'titulo' }, c.titulo),
      h('div', { class: 'sec' }, `${c.canal}${c.duracao ? ' · ' + minseg(c.duracao) : ''}`),
      h('a', { class: 'link', href: seguro(c.url), target: '_blank', rel: 'noopener noreferrer' }, 'Abrir no YouTube para conferir')),
    h('button', { type: 'button', class: 'pequeno', onclick: () => decidir(it.chave, 'aprovar', c.id) }, 'Usar este'),
    h('div', { class: 'motivos' }, c.motivos.join(' · '))));
  return h('li', { class: 'musica' },
    h('span', { class: 'num' }, it.ordem),
    h('div', {}, h('div', { class: 'titulo' }, it.titulo), it.aviso ? h('div', { class: 'sec' }, it.aviso) : null),
    h('div', { class: 'botoes' }, h('button', { type: 'button', class: 'pequeno', onclick: () => decidir(it.chave, 'descartar') }, 'Descartar')),
    h('div', { class: 'candidatos' }, cands));
}

function linhaSimples(it, extra) {
  return h('li', { class: 'musica' },
    h('span', { class: 'num' }, it.ordem),
    h('div', {}, h('div', { class: 'titulo' }, it.titulo), h('div', { class: 'sec' }, it.album || '')),
    h('div', { class: 'botoes' }, extra || null));
}

function bloco(titulo, explica, itens, desenhar, { recolhido = false } = {}) {
  if (!itens.length) return null;
  const grupos = agrupar(itens);
  const corpo = grupos.map((g) => [g.album ? h('div', { class: 'album' }, g.album) : null, h('ol', { class: 'musicas' }, g.itens.map(desenhar))]);
  if (recolhido) return h('details', { class: 'bloco' }, h('summary', {}, `${titulo} (${itens.length})`), h('p', { class: 'explica' }, explica), corpo);
  return h('section', { class: 'bloco' }, h('h3', {}, `${titulo} (${itens.length})`), h('p', { class: 'explica' }, explica), corpo);
}

function desenharResultado() {
  const r = resultadoAtual;
  if (!r) return;
  const por = (estado) => r.faixas.filter((f) => f.estado === estado);
  $('#resultado').hidden = false;
  $('#res-titulo').textContent = r.artista.nome;
  $('#res-resumo').textContent = `${r.limite} músicas na lista. ${r.totais.encontrada} com link confirmado, ${r.totais.conferir} para conferir.`;
  $('#btn-copiar').textContent = `Copiar todos os links (${r.urls.length})`;
  $('#btn-copiar').disabled = !r.urls.length;
  const baixar = $('#btn-baixar');
  baixar.href = r.urls.length ? '/api/exportar?artista=' + encodeURIComponent(r.artista.slug) : '#';
  baixar.setAttribute('aria-disabled', String(!r.urls.length));
  baixar.textContent = `Baixar ${r.artista.slug}.txt`;
  $('#copiado').hidden = true;

  const blocos = [
    bloco('Encontradas', 'O título, o artista e a duração conferem. Estes links entram no TXT.', por('encontrada'), linhaEncontrada),
    bloco('Precisam de conferência', 'Achei vídeos parecidos, mas não tenho certeza. Abra o link, veja se é a música certa e clique em "Usar este". Só os confirmados entram no TXT.', por('conferir'), linhaConferir),
    bloco('Sem resultado', 'Nenhum vídeo parecido foi achado.', por('sem_resultado'), (it) => linhaSimples(it)),
    bloco('Ainda não pesquisadas', 'Faltou pesquisa (acabou a cota do dia ou você parou). Pesquise o artista de novo para continuar.', por('pendente'), (it) => linhaSimples(it)),
    bloco('Já estão na sua biblioteca', 'Não foram pesquisadas e não entram no TXT.', por('na_biblioteca'), (it) => linhaSimples(it), { recolhido: true }),
    bloco('Descartadas por você', 'Não entram no TXT.', por('descartada'), (it) => linhaSimples(it, h('button', { type: 'button', class: 'pequeno', onclick: () => decidir(it.chave, 'limpar') }, 'Desfazer')), { recolhido: true }),
  ].filter(Boolean);
  $('#listas').replaceChildren(...(blocos.length ? blocos : [h('p', { class: 'vazio' }, 'Nada para mostrar ainda.')]));
}

$('#ordem').addEventListener('change', desenharResultado);

$('#btn-copiar').addEventListener('click', async () => {
  const texto = resultadoAtual.urls.join('\n');
  try { await navigator.clipboard.writeText(texto); }
  catch {
    const t = h('textarea', { style: 'position:fixed;opacity:0' }); t.value = texto; document.body.append(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
  }
  const c = $('#copiado');
  c.hidden = false; c.textContent = `${resultadoAtual.urls.length} links copiados. Agora cole no Media Downloader.`;
});

$('#btn-baixar').addEventListener('click', (ev) => { if (!resultadoAtual?.urls.length) ev.preventDefault(); });

carregarEstado().then((e) => { mostrarJob(e.job); if (e.job.rodando) acompanhar(); }).catch(() => aviso('Não consegui falar com o programa. Ele ainda está aberto?', 'erro'));
