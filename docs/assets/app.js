// Página del proyecto: demo del evaluador, tabla ordenable y botones de copiar.
// evaluacion.js, finanzas.js, programas.json y entidades.json son copias generadas por scripts/build-docs.mjs.
import { evaluarTodos, normalizarPerfil } from './evaluacion.js';
import { fmtUSD, fmtPct } from './finanzas.js';

const SITIO = 'https://creditohipotecarioecuador.com';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const fecha = (iso) => {
  if (!esIso(iso)) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
};
const $ = (id) => document.getElementById(id);

/** Crea un elemento: h('p', { class: 'x' }, 'texto', otroNodo). */
function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

// ---------------------------------------------------------------- Demo
const ESTADO = { apto: 'Calificas', condicional: 'Calificas con condiciones', no_apto: 'No calificas' };

async function iniciarDemo() {
  const form = $('demo-form');
  if (!form) return;
  const cargar = (archivo) => fetch(new URL(`./${archivo}`, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar ${archivo}`);
    return r.json();
  });
  const [programas, entidades] = await Promise.all([cargar('programas.json'), cargar('entidades.json')]);
  const nombreEntidad = new Map(entidades.map((e) => [e.slug, e.nombre.replace(/\s*\(.*\)\s*$/, '')]));

  const iess = $('f-iess');
  const aportWrap = $('aport-wrap');
  const abierto = { mas: false, no: false };
  $('demo-mas-wrap').addEventListener('toggle', (e) => { abierto.mas = e.target.open; });
  $('demo-no-wrap').addEventListener('toggle', (e) => { abierto.no = e.target.open; });

  function leerPerfil() {
    const d = new FormData(form);
    const num = (campo) => {
      const v = String(d.get(campo) ?? '').trim();
      return v === '' ? undefined : Number(v);
    };
    return {
      precioVivienda: num('precioVivienda'),
      ingresoMensual: num('ingresoMensual'),
      entradaDisponible: num('entradaDisponible') ?? 0,
      deudasMensuales: num('deudasMensuales') ?? 0,
      afiliadoIess: iess.checked,
      aportaciones: iess.checked ? num('aportaciones') ?? 0 : 0,
      edad: num('edad'),
      primeraVivienda: $('f-primera').checked,
      viviendaNueva: $('f-nueva').checked,
      plazoDeseado: num('plazoDeseado'),
    };
  }

  function tarjeta(r, n) {
    const p = r.programa;
    const no = r.elegibilidad === 'no_apto';
    const cifra = (clase, dt, dd) => h('div', { class: clase }, h('dt', { text: dt }), dd instanceof Node ? dd : h('dd', { text: dd }));
    return h('li', {},
      h('article', { class: `res${n === 1 ? ' res-1' : ''}`, 'data-slug': p.slug, 'data-elegibilidad': r.elegibilidad, 'data-cuota': r.cuotaEstimada.toFixed(2), 'data-monto': r.montoFinanciable.toFixed(2), 'data-score': r.score },
        h('div', { class: 'res-top' },
          h('div', { class: 'res-id' },
            no ? null : h('span', { class: 'res-n', 'aria-label': `Posición ${n}`, text: n }),
            h('div', {},
              h('p', { class: 'res-ent', text: nombreEntidad.get(p.entidad) ?? p.entidad }),
              h('h4', { class: 'res-nom' }, h('a', { href: `${SITIO}/programas/${p.slug}/`, text: p.nombre })),
            ),
          ),
          h('span', { class: `badge badge-${r.elegibilidad}`, text: ESTADO[r.elegibilidad] }),
        ),
        no ? null : h('dl', { class: 'res-cifras' },
          cifra('cuota', 'Cuota estimada', h('dd', {}, fmtUSD(r.cuotaEstimada), h('small', { text: ' /mes' }))),
          cifra('', 'Monto financiado', fmtUSD(r.montoFinanciable)),
          cifra('', 'Tasa nominal', p.tasaNominal == null ? '—' : fmtPct(p.tasaNominal)),
          cifra('', 'Plazo', `${r.plazo} años`),
          cifra('', 'Entrada mínima', fmtUSD(r.entradaRequerida)),
        ),
        r.razones.length ? h('ul', { class: 'res-raz' }, r.razones.map((t) => h('li', { text: t }))) : null,
        h('p', { class: 'res-pie' },
          no ? null : h('span', {}, 'Puntaje ', h('b', { text: `${r.score}/100` })),
          esIso(p.fechaDato)
            ? h('span', {}, 'Dato del ', h('time', { datetime: p.fechaDato, text: fecha(p.fechaDato) }))
            : h('span', { text: 'Fecha del dato sin confirmar' }),
          h('span', { text: p.verificado ? 'Verificado' : 'Por verificar' }),
        ),
      ),
    );
  }

  function calcular() {
    const err = $('demo-error');
    let resultados;
    try {
      resultados = evaluarTodos(programas, normalizarPerfil(leerPerfil()));
      err.hidden = true;
    } catch (e) {
      err.textContent = `Revisa los datos: ${e.message}`;
      err.hidden = false;
      return;
    }
    const si = resultados.filter((r) => r.elegibilidad !== 'no_apto');
    const no = resultados.filter((r) => r.elegibilidad === 'no_apto');
    const cond = si.filter((r) => r.elegibilidad === 'condicional').length;
    const resumen = $('demo-resumen');
    resumen.replaceChildren(
      si.length
        ? `Calificas a ${si.length} de ${resultados.length} productos`
        : `Con este perfil no calificas a ninguno de los ${resultados.length} productos`,
      h('span', { text: si.length ? (cond ? ` · ${cond} con condiciones` : ' · todos sin condiciones') : ' · prueba con más entrada, más plazo o un precio menor' }),
    );
    const PRIMEROS = 4;
    $('demo-lista').replaceChildren(...si.slice(0, PRIMEROS).map((r, i) => tarjeta(r, i + 1)));
    const resto = si.slice(PRIMEROS);
    $('demo-mas-wrap').hidden = resto.length === 0;
    $('demo-mas-wrap').open = abierto.mas;
    $('demo-mas-sum').textContent = `Ver ${resto.length} ${resto.length === 1 ? 'opción' : 'opciones'} más`;
    $('demo-mas').replaceChildren(...resto.map((r, i) => tarjeta(r, PRIMEROS + i + 1)));
    $('demo-no-wrap').hidden = no.length === 0;
    $('demo-no-wrap').open = abierto.no;
    $('demo-no-sum').textContent = `Ver ${no.length} ${no.length === 1 ? 'producto al que no calificas' : 'productos a los que no calificas'} y por qué`;
    $('demo-no').replaceChildren(...no.map((r) => tarjeta(r, 0)));
  }

  const sincronizarIess = () => { aportWrap.hidden = !iess.checked; };
  let espera;
  form.addEventListener('input', () => {
    sincronizarIess();
    clearTimeout(espera);
    espera = setTimeout(calcular, 180);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(espera);
    calcular();
    if (window.matchMedia('(max-width: 939px)').matches) $('demo-resumen').scrollIntoView({ block: 'start' });
  });

  sincronizarIess();
  calcular();
  $('demo-fallback').hidden = true;
  $('demo-app').hidden = false;
}

// ---------------------------------------------------------------- Tabla
function iniciarTabla() {
  const tabla = $('tabla');
  if (!tabla) return;
  const tbody = tabla.tBodies[0];
  const filas = [...tbody.rows];
  filas.forEach((f, i) => { f.dataset.i = i; });
  const estado = { grupo: '', q: '', orden: null, dir: 1 };
  const cuenta = $('tabla-cuenta');
  const vacia = h('tr', { class: 'tabla-vacia' }, h('td', { colspan: 7, text: 'Ningún producto coincide con el filtro.' }));
  const sinTildes = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function pintar() {
    const q = sinTildes(estado.q.trim());
    let visibles = filas.filter((f) => (!estado.grupo || f.dataset.grupo === estado.grupo) && (!q || f.dataset.texto.includes(q)));
    if (estado.orden) {
      const { orden, dir, tipo } = estado;
      visibles.sort((a, b) => {
        const x = a.dataset[orden], y = b.dataset[orden];
        if (x === '' || y === '') return x === y ? a.dataset.i - b.dataset.i : x === '' ? 1 : -1; // sin dato, al final
        const c = tipo === 'num' ? Number(x) - Number(y) : x.localeCompare(y, 'es');
        return c * dir || a.dataset.i - b.dataset.i;
      });
    }
    tbody.replaceChildren(...(visibles.length ? visibles : [vacia]));
    cuenta.textContent = visibles.length === filas.length
      ? `${filas.length} productos`
      : `Mostrando ${visibles.length} de ${filas.length} productos`;
  }

  for (const th of tabla.tHead.rows[0].cells) {
    const boton = h('button', { type: 'button' });
    boton.append(...th.childNodes);
    th.append(boton);
    th.classList.add('con-orden');
    boton.addEventListener('click', () => {
      const mismo = estado.orden === th.dataset.orden;
      estado.dir = mismo ? -estado.dir : 1;
      estado.orden = th.dataset.orden;
      estado.tipo = th.dataset.tipo;
      for (const o of tabla.tHead.rows[0].cells) o.removeAttribute('aria-sort');
      th.setAttribute('aria-sort', estado.dir === 1 ? 'ascending' : 'descending');
      pintar();
    });
  }
  const filtros = [...document.querySelectorAll('.filtro')];
  for (const b of filtros) {
    b.addEventListener('click', () => {
      estado.grupo = b.dataset.grupo;
      for (const o of filtros) o.setAttribute('aria-pressed', String(o === b));
      pintar();
    });
  }
  $('tabla-q').addEventListener('input', (e) => { estado.q = e.target.value; pintar(); });
  $('tabla-ctrl').hidden = false;
  cuenta.hidden = false;
  pintar();
}

// ---------------------------------------------------------------- Copiar
function iniciarCopiar() {
  const crear = (texto) => {
    const b = h('button', { type: 'button', class: 'btn-copiar', text: 'Copiar' });
    b.addEventListener('click', async () => {
      let ok = true;
      try {
        await navigator.clipboard.writeText(texto());
      } catch {
        const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
        ta.value = texto();
        document.body.append(ta);
        ta.select();
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
      }
      b.textContent = ok ? 'Copiado' : 'No se pudo copiar';
      setTimeout(() => { b.textContent = 'Copiar'; }, 1800);
    });
    return b;
  };
  for (const pre of document.querySelectorAll('pre[data-copiar]')) {
    const code = pre.querySelector('code');
    pre.classList.add('con-copiar');
    pre.append(crear(() => code.textContent));
  }
  const url = $('mcp-url');
  if (url) url.parentElement.append(crear(() => url.textContent));
}

iniciarTabla();
iniciarCopiar();
iniciarDemo().catch((e) => {
  // Si falla la carga, queda visible el texto alternativo con el enlace a la evaluación del sitio.
  console.error(e);
});
