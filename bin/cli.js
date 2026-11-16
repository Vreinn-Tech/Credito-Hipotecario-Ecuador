#!/usr/bin/env node
/**
 * CLI de credito-hipotecario-ecuador. Sin dependencias.
 *   credito-hipotecario-ecuador evaluar --precio 70000 --ingreso 1200 --entrada 5000 --iess --aportaciones 48
 *   credito-hipotecario-ecuador --help
 */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import {
  programas, entidades, buscarPrograma, buscarEntidad,
  evaluarTodos, normalizarPerfil, USOS, RELACIONES_LABORALES,
  cuotaMensual, tablaAmortizacion, tasaEfectiva, fmtUSD, fmtPct,
} from '../src/index.js';

const SITIO = 'https://creditohipotecarioecuador.com';
const ENLACE_FINAL = `Más detalle y asesoría gratuita: ${SITIO}/evaluacion/`;
const AVISO = 'Información referencial: no es una oferta de crédito ni asesoría financiera. Verifica tasas y requisitos con cada entidad.';
const CATEGORIAS = ['publico', 'preferencial', 'privado', 'subsidio'];
const TIPOS_ENTIDAD = ['publico', 'banco', 'cooperativa', 'mutualista'];

const ETIQUETA_USO = {
  vivienda_terminada: 'compra de vivienda terminada',
  construccion: 'construcción en terreno propio',
  terreno: 'compra de terreno',
  remodelacion: 'ampliación o remodelación',
  sustitucion: 'sustitución de hipoteca',
  vis_vip: 'vivienda de interés social / público (VIS/VIP)',
};
const ETIQUETA_CATEGORIA = {
  publico: 'Crédito público (BIESS)',
  preferencial: 'Tasa preferencial VIS/VIP',
  privado: 'Banca, cooperativas y mutualistas',
  subsidio: 'Bonos y subsidios del Estado',
};
const ETIQUETA_ELEGIBILIDAD = { apto: 'Apto', condicional: 'Condicional', no_apto: 'No apto' };

const AYUDA = `credito-hipotecario-ecuador — evaluador y datos de crédito de vivienda en Ecuador

Uso:
  credito-hipotecario-ecuador <comando> [opciones]

Comandos:
  evaluar            Evalúa un perfil contra todos los productos y los ordena de mejor a peor
  cuota              Calcula la cuota mensual (sistema francés)
  programas          Lista los productos con tasa, plazo y financiamiento
  programa <slug>    Muestra la ficha completa de un producto
  entidades          Lista las instituciones financieras
  mcp                Inicia el servidor MCP por stdio (igual que credito-hipotecario-ecuador-mcp)

Opciones de "evaluar":
  --precio <usd>         Precio o avalúo de la vivienda (obligatorio)
  --ingreso <usd>        Ingreso neto mensual del hogar (obligatorio)
  --entrada <usd>        Ahorro disponible para la entrada (por defecto 0)
  --deudas <usd>         Cuotas mensuales de otras deudas (por defecto 0)
  --iess                 Eres afiliado o jubilado del IESS
  --aportaciones <n>     Meses de aportación al IESS (por defecto 0)
  --edad <años>          Edad del solicitante (por defecto 35)
  --uso <uso>            ${USOS.join(' | ')}
                         (por defecto vivienda_terminada)
  --plazo <años>         Plazo deseado (por defecto 20)
  --segunda-vivienda     Ya tienes una vivienda (por defecto se asume primera vivienda)
  --relacion <tipo>      ${RELACIONES_LABORALES.join(' | ')} (por defecto dependiente)
  --nueva | --usada      La vivienda es nueva de primer uso o usada (por defecto: no se sabe)
  --todos                Incluye también los productos a los que no calificas
  --json                 Salida en JSON

Opciones de "cuota":
  --monto <usd>          Monto del crédito (obligatorio)
  --tasa <%>             Tasa nominal anual, p. ej. 8.5 (obligatorio)
  --plazo <años>         Plazo en años (obligatorio)
  --tabla                Imprime la tabla de amortización completa
  --json                 Salida en JSON

Opciones de "programas":
  --categoria <c>        ${CATEGORIAS.join(' | ')}
  --entidad <slug>       Filtra por entidad (p. ej. biess)
  --json                 Salida en JSON

Opciones de "programa" y "entidades":
  --json                 Salida en JSON
  --tipo <t>             (entidades) ${TIPOS_ENTIDAD.join(' | ')}

Generales:
  -h, --help             Muestra esta ayuda
  -v, --version          Muestra la versión

Los montos se escriben sin separador de miles (70000, no 70.000).

Ejemplos:
  credito-hipotecario-ecuador evaluar --precio 70000 --ingreso 1200 --entrada 5000 --iess --aportaciones 48
  credito-hipotecario-ecuador evaluar --precio 120000 --entrada 30000 --ingreso 2500 --usada --todos
  credito-hipotecario-ecuador cuota --monto 65000 --tasa 2.99 --plazo 30
  credito-hipotecario-ecuador programas --categoria publico
  credito-hipotecario-ecuador programa biess-credicasa

${AVISO}
${ENLACE_FINAL}`;

class ErrorDeUso extends Error {}

// ---------- utilidades de formato ----------

const out = (s = '') => process.stdout.write(s + '\n');
const json = (v) => out(JSON.stringify(v, null, 2));

/** Convierte el valor de una opción en número. Acepta coma decimal ("2,99"). */
function numero(valores, nombre, { obligatorio = false } = {}) {
  const crudo = valores[nombre];
  if (crudo === undefined) {
    if (obligatorio) throw new ErrorDeUso(`Falta la opción --${nombre}.`);
    return undefined;
  }
  const texto = String(crudo).trim().replace(/^\$/, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(texto)) {
    throw new ErrorDeUso(`--${nombre}: escribe el número sin separador de miles (recibido: "${crudo}"; p. ej. 70000 en lugar de 70.000).`);
  }
  const n = Number(/^-?\d+,\d+$/.test(texto) ? texto.replace(',', '.') : texto);
  if (texto === '' || !Number.isFinite(n)) {
    throw new ErrorDeUso(`--${nombre} debe ser un número sin separador de miles (recibido: "${crudo}").`);
  }
  return n;
}

function unoDe(valor, nombre, permitidos) {
  if (valor !== undefined && !permitidos.includes(valor)) {
    throw new ErrorDeUso(`--${nombre} debe ser uno de: ${permitidos.join(', ')} (recibido: "${valor}").`);
  }
  return valor;
}

const ancho = (s) => [...String(s)].length;
const cortar = (s, max) => (ancho(s) > max ? [...s].slice(0, max - 1).join('') + '…' : s);

/** Tabla de texto. columnas: [{ titulo, valor(fila, i), derecha?, max? }] */
function tabla(filas, columnas) {
  const celdas = filas.map((f, i) => columnas.map((c) => {
    const v = String(c.valor(f, i) ?? '—');
    return c.max ? cortar(v, c.max) : v;
  }));
  const anchos = columnas.map((c, j) => Math.max(ancho(c.titulo), ...celdas.map((r) => ancho(r[j]))));
  const linea = (vals) => vals
    .map((v, j) => {
      const relleno = ' '.repeat(anchos[j] - ancho(v));
      return columnas[j].derecha ? relleno + v : v + relleno;
    })
    .join('  ')
    .trimEnd();
  return [
    linea(columnas.map((c) => c.titulo)),
    linea(anchos.map((a) => '─'.repeat(a))),
    ...celdas.map(linea),
  ].join('\n');
}

const pct = (v, dec = 2) => (v === null || v === undefined ? '—' : fmtPct(v, dec));
const usd = (v, dec = 0) => (v === null || v === undefined ? '—' : fmtUSD(v, dec));
const anios = (v) => (v === null || v === undefined ? '—' : `${v} años`);
const siNo = (b) => (b ? 'sí' : 'no');
const nombreEntidad = (slug) => buscarEntidad(slug)?.nombre ?? slug;
const urlPrograma = (slug) => `${SITIO}/programas/${slug}/`;

function financiamiento(p) {
  if (p.tramos?.length) {
    const pcts = p.tramos.map((t) => t.pct);
    const min = Math.min(...pcts);
    const max = Math.max(...pcts);
    return min === max ? `${max} %` : `${min}–${max} %`;
  }
  return p.financiamientoMaxPct === null ? '—' : `${p.financiamientoMaxPct} %`;
}

function pie() {
  out();
  out(AVISO);
  out(ENLACE_FINAL);
}

// ---------- comandos ----------

function cmdEvaluar(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      precio: { type: 'string' }, ingreso: { type: 'string' }, entrada: { type: 'string' },
      deudas: { type: 'string' }, iess: { type: 'boolean' }, aportaciones: { type: 'string' },
      edad: { type: 'string' }, uso: { type: 'string' }, plazo: { type: 'string' },
      'segunda-vivienda': { type: 'boolean' }, relacion: { type: 'string' },
      usada: { type: 'boolean' }, nueva: { type: 'boolean' },
      json: { type: 'boolean' }, todos: { type: 'boolean' },
    },
  });
  if (values.usada && values.nueva) throw new ErrorDeUso('Usa --nueva o --usada, no ambas.');

  const parcial = {
    precioVivienda: numero(values, 'precio', { obligatorio: true }),
    ingresoMensual: numero(values, 'ingreso', { obligatorio: true }),
    entradaDisponible: numero(values, 'entrada'),
    deudasMensuales: numero(values, 'deudas'),
    afiliadoIess: values.iess === true,
    aportaciones: numero(values, 'aportaciones'),
    edad: numero(values, 'edad'),
    uso: values.uso,
    plazoDeseado: numero(values, 'plazo'),
    primeraVivienda: values['segunda-vivienda'] !== true,
    relacionLaboral: values.relacion,
    viviendaNueva: values.nueva ? true : values.usada ? false : undefined,
  };
  const perfil = normalizarPerfil(parcial);
  const todos = evaluarTodos(programas, perfil);
  const cuenta = { apto: 0, condicional: 0, no_apto: 0 };
  for (const r of todos) cuenta[r.elegibilidad]++;
  const visibles = values.todos ? todos : todos.filter((r) => r.elegibilidad !== 'no_apto');

  if (values.json) {
    json({
      perfil,
      resumen: { evaluados: todos.length, aptos: cuenta.apto, condicionales: cuenta.condicional, noAptos: cuenta.no_apto },
      resultados: visibles.map((r) => ({
        slug: r.programa.slug,
        nombre: r.programa.nombre,
        entidad: r.programa.entidad,
        categoria: r.programa.categoria,
        elegibilidad: r.elegibilidad,
        score: r.score,
        razones: r.razones,
        tasaNominal: r.programa.tasaNominal,
        plazo: r.plazo,
        montoFinanciable: r.montoFinanciable,
        cuotaEstimada: r.cuotaEstimada,
        entradaRequerida: r.entradaRequerida,
        capacidadMaxima: r.capacidadMaxima,
        verificado: r.programa.verificado,
        fechaDato: r.programa.fechaDato,
        fuenteUrl: r.programa.fuenteUrl,
        url: urlPrograma(r.programa.slug),
      })),
      aviso: AVISO,
      masInformacion: `${SITIO}/evaluacion/`,
    });
    return;
  }

  out('Perfil evaluado');
  out(`  Vivienda: ${usd(perfil.precioVivienda)} · ${ETIQUETA_USO[perfil.uso]}${perfil.viviendaNueva === undefined ? '' : perfil.viviendaNueva ? ' · nueva' : ' · usada'}`);
  out(`  Entrada disponible: ${usd(perfil.entradaDisponible)} · Ingreso: ${usd(perfil.ingresoMensual)}/mes · Otras deudas: ${usd(perfil.deudasMensuales)}/mes`);
  out(`  IESS: ${perfil.afiliadoIess ? `afiliado, ${perfil.aportaciones} aportaciones` : 'no afiliado'} · Edad: ${perfil.edad} · Plazo deseado: ${perfil.plazoDeseado} años`);
  out(`  Primera vivienda: ${siNo(perfil.primeraVivienda)} · Relación laboral: ${perfil.relacionLaboral}`);
  if (!perfil.afiliadoIess && perfil.aportaciones > 0) {
    out('  Nota: indicaste aportaciones pero no --iess; los productos del BIESS se evalúan como no afiliado.');
  }
  out();
  out(`Resultado: ${cuenta.apto} apto(s), ${cuenta.condicional} condicional(es) y ${cuenta.no_apto} no apto(s) de ${todos.length} productos.`);
  out();

  if (visibles.length === 0) {
    out('Con este perfil no calificas a ningún producto. Usa --todos para ver el motivo en cada uno.');
  } else {
    out(tabla(visibles, [
      { titulo: '#', valor: (_, i) => i + 1, derecha: true },
      { titulo: 'Producto', valor: (r) => r.programa.nombre, max: 38 },
      { titulo: 'Entidad', valor: (r) => nombreEntidad(r.programa.entidad), max: 26 },
      { titulo: 'Resultado', valor: (r) => ETIQUETA_ELEGIBILIDAD[r.elegibilidad] },
      { titulo: 'Puntaje', valor: (r) => r.score, derecha: true },
      { titulo: 'Tasa', valor: (r) => pct(r.programa.tasaNominal) + (r.programa.verificado ? '' : ' *'), derecha: true },
      { titulo: 'Plazo', valor: (r) => anios(r.plazo), derecha: true },
      { titulo: 'Monto', valor: (r) => usd(r.montoFinanciable), derecha: true },
      { titulo: 'Cuota/mes', valor: (r) => usd(r.cuotaEstimada), derecha: true },
      { titulo: 'Entrada mín.', valor: (r) => usd(r.entradaRequerida), derecha: true },
    ]));
    if (visibles.some((r) => !r.programa.verificado)) {
      out();
      out('* Dato preliminar (verificado: false): confírmalo con la entidad.');
    }
    const conRazones = visibles.map((r, i) => ({ r, i })).filter(({ r }) => r.razones.length);
    if (conRazones.length) {
      out();
      out('Observaciones');
      for (const { r, i } of conRazones) {
        out(`  ${i + 1}. ${r.programa.nombre} — ${ETIQUETA_ELEGIBILIDAD[r.elegibilidad]}`);
        for (const razon of r.razones) out(`     - ${razon}`);
      }
    }
  }
  if (!values.todos && cuenta.no_apto > 0) {
    out();
    out(`Usa --todos para ver también los ${cuenta.no_apto} productos a los que no calificas y por qué.`);
  }
  out();
  out('La cuota es solo capital e interés (sistema francés); no incluye seguros ni gastos.');
  pie();
}

function cmdCuota(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: {
      monto: { type: 'string' }, tasa: { type: 'string' }, plazo: { type: 'string' },
      tabla: { type: 'boolean' }, json: { type: 'boolean' },
    },
  });
  const monto = numero(values, 'monto', { obligatorio: true });
  const tasa = numero(values, 'tasa', { obligatorio: true });
  const plazo = numero(values, 'plazo', { obligatorio: true });
  if (monto <= 0) throw new ErrorDeUso('--monto debe ser mayor que 0.');
  if (tasa < 0 || tasa > 100) throw new ErrorDeUso('--tasa debe estar entre 0 y 100 (% nominal anual).');
  if (plazo <= 0 || plazo > 50) throw new ErrorDeUso('--plazo debe estar entre 0 y 50 años.');

  const params = { monto, tasaNominalAnual: tasa, plazoAnios: plazo };
  const a = tablaAmortizacion(params);
  const resumen = {
    monto, tasaNominalAnual: tasa, tasaEfectivaAnual: tasaEfectiva(tasa), plazoAnios: plazo,
    numeroCuotas: a.tabla.length, cuotaMensual: cuotaMensual(params),
    totalIntereses: a.totalIntereses, totalPagado: a.totalPagado,
  };
  if (values.json) {
    json(values.tabla ? { ...resumen, tabla: a.tabla } : resumen);
    return;
  }
  out(`Crédito de ${usd(monto)} al ${pct(tasa)} nominal anual a ${plazo} años (${resumen.numeroCuotas} cuotas)`);
  out();
  out(`  Cuota mensual:       ${usd(resumen.cuotaMensual, 2)}`);
  out(`  Tasa efectiva anual: ${pct(resumen.tasaEfectivaAnual)}`);
  out(`  Total de intereses:  ${usd(resumen.totalIntereses, 2)}`);
  out(`  Total pagado:        ${usd(resumen.totalPagado, 2)}`);
  if (values.tabla) {
    out();
    out(tabla(a.tabla, [
      { titulo: 'N.º', valor: (f) => f.n, derecha: true },
      { titulo: 'Cuota', valor: (f) => usd(f.cuota, 2), derecha: true },
      { titulo: 'Interés', valor: (f) => usd(f.interes, 2), derecha: true },
      { titulo: 'Capital', valor: (f) => usd(f.capital, 2), derecha: true },
      { titulo: 'Saldo', valor: (f) => usd(f.saldo, 2), derecha: true },
    ]));
  }
  out();
  out('Sistema francés (cuota fija), capitalización mensual. No incluye seguros ni gastos.');
  out(`Simulador en línea: ${SITIO}/simulador/`);
  pie();
}

function cmdProgramas(args) {
  const { values } = parseArgs({
    args,
    allowPositionals: false,
    options: { categoria: { type: 'string' }, entidad: { type: 'string' }, json: { type: 'boolean' } },
  });
  unoDe(values.categoria, 'categoria', CATEGORIAS);
  if (values.entidad !== undefined && !buscarEntidad(values.entidad)) {
    throw new ErrorDeUso(`No existe la entidad "${values.entidad}". Usa el comando "entidades" para ver los slugs.`);
  }
  const lista = programas.filter((p) =>
    (values.categoria === undefined || p.categoria === values.categoria)
    && (values.entidad === undefined || p.entidad === values.entidad));
  if (values.json) { json(lista); return; }
  if (lista.length === 0) { out('Ningún producto coincide con el filtro.'); pie(); return; }
  out(tabla(lista, [
    { titulo: 'Slug', valor: (p) => p.slug },
    { titulo: 'Producto', valor: (p) => p.nombre, max: 38 },
    { titulo: 'Entidad', valor: (p) => nombreEntidad(p.entidad), max: 26 },
    { titulo: 'Categoría', valor: (p) => p.categoria },
    { titulo: 'Tasa nominal', valor: (p) => pct(p.tasaNominal) + (p.verificado ? '' : ' *'), derecha: true },
    { titulo: 'Plazo máx.', valor: (p) => anios(p.plazoMaxAnios), derecha: true },
    { titulo: 'Financia', valor: (p) => financiamiento(p), derecha: true },
    { titulo: 'Fecha del dato', valor: (p) => p.fechaDato },
  ]));
  out();
  out(`${lista.length} producto(s).${lista.some((p) => !p.verificado) ? ' * Dato preliminar (verificado: false): confírmalo con la entidad.' : ''}`);
  out(`Ficha completa: credito-hipotecario-ecuador programa <slug> · Comparador en línea: ${SITIO}/comparador/`);
  pie();
}

function cmdPrograma(args) {
  const { values, positionals } = parseArgs({
    args, allowPositionals: true, options: { json: { type: 'boolean' } },
  });
  const slug = positionals[0];
  if (!slug) throw new ErrorDeUso('Indica el slug del producto, p. ej.: programa biess-credicasa');
  const p = buscarPrograma(slug);
  if (!p) {
    const parecidos = programas.filter((x) => x.slug.includes(slug) || x.entidad === slug).map((x) => x.slug);
    throw new ErrorDeUso(`No existe el producto "${slug}".${parecidos.length ? ` ¿Quisiste decir: ${parecidos.join(', ')}?` : ' Usa el comando "programas" para ver los slugs.'}`);
  }
  if (values.json) { json(p); return; }
  const e = buscarEntidad(p.entidad);
  const fila = (k, v) => out(`  ${(k + ':').padEnd(24)}${v}`);
  const lista = (titulo, items) => {
    if (!items?.length) return;
    out();
    out(titulo);
    for (const [i, it] of items.entries()) out(`  ${titulo === 'Pasos' ? `${i + 1}.` : '-'} ${it}`);
  };
  out(p.nombre);
  out(`${e?.nombre ?? p.entidad} · ${ETIQUETA_CATEGORIA[p.categoria]}`);
  out();
  out(p.resumen);
  out();
  fila('Tasa nominal', pct(p.tasaNominal));
  fila('Tasa efectiva', pct(p.tasaEfectiva));
  if (p.tasaNota) fila('Nota sobre la tasa', p.tasaNota);
  fila('Plazo', p.plazoMinAnios === null && p.plazoMaxAnios === null ? '—' : `${p.plazoMinAnios ?? '—'} a ${p.plazoMaxAnios ?? '—'} años`);
  fila('Financiamiento máx.', financiamiento(p));
  if (p.tramos?.length) {
    for (const t of p.tramos) out(`  ${' '.repeat(24)}${t.pct} % si la vivienda vale hasta ${usd(t.hastaUsd)}`);
  }
  fila('Entrada mínima', p.entradaMinPct === null ? '—' : `${p.entradaMinPct} %`);
  fila('Monto', `${p.montoMinUsd === null ? 'sin mínimo' : `desde ${usd(p.montoMinUsd)}`} · ${p.montoMaxUsd === null ? 'sin máximo publicado' : `hasta ${usd(p.montoMaxUsd)}`}`);
  if (p.precioViviendaMinUsd || p.precioViviendaMaxUsd) {
    fila('Precio de la vivienda', [p.precioViviendaMinUsd ? `desde ${usd(p.precioViviendaMinUsd, 2)}` : '', p.precioViviendaMaxUsd ? `hasta ${usd(p.precioViviendaMaxUsd, 2)}` : ''].filter(Boolean).join(' · '));
  }
  if (p.ingresoMaxUsd) fila('Ingreso familiar máx.', `${usd(p.ingresoMaxUsd, 2)}/mes`);
  fila('Afiliación al IESS', p.requiereAfiliacionIess ? `requerida${p.aportacionesMinimas ? ` (${p.aportacionesMinimas} aportaciones)` : ''}` : 'no requerida');
  fila('Edad', `${p.edadMin ?? '—'} a ${p.edadMax ?? '—'} años (máxima al terminar de pagar)`);
  fila('Cuota / ingreso máx.', `${Math.round(p.ratioCuotaIngreso * 100)} %`);
  fila('Solo primera vivienda', siNo(p.soloPrimeraVivienda));
  fila('Solo vivienda nueva', siNo(p.soloViviendaNueva === true));
  fila('Destinos', p.usos.map((u) => ETIQUETA_USO[u]).join('; '));
  out();
  out('Descripción');
  out(`  ${p.descripcion}`);
  out();
  out('Para quién');
  out(`  ${p.paraQuien}`);
  lista('Requisitos', p.requisitos);
  lista('Ventajas', p.ventajas);
  lista('Desventajas', p.desventajas);
  lista('Pasos', p.pasos);
  out();
  fila('Fuente', p.fuenteUrl);
  fila('Fecha del dato', p.fechaDato);
  fila('Verificado', p.verificado ? 'sí' : 'no (dato preliminar: confírmalo con la entidad)');
  fila('Ficha en línea', urlPrograma(p.slug));
  pie();
}

function cmdEntidades(args) {
  const { values } = parseArgs({
    args, allowPositionals: false, options: { tipo: { type: 'string' }, json: { type: 'boolean' } },
  });
  unoDe(values.tipo, 'tipo', TIPOS_ENTIDAD);
  const lista = entidades.filter((e) => values.tipo === undefined || e.tipo === values.tipo);
  if (values.json) { json(lista); return; }
  const cobertura = (e) => (e.coberturaProvincias === 'nacional' ? 'nacional'
    : e.coberturaProvincias.length ? e.coberturaProvincias.join(', ') : '—');
  out(tabla(lista, [
    { titulo: 'Slug', valor: (e) => e.slug },
    { titulo: 'Entidad', valor: (e) => e.nombre, max: 44 },
    { titulo: 'Tipo', valor: (e) => e.tipo },
    { titulo: 'Productos', valor: (e) => programas.filter((p) => p.entidad === e.slug).length || '—', derecha: true },
    { titulo: 'Cobertura', valor: cobertura, max: 40 },
    { titulo: 'Sitio', valor: (e) => e.sitioUrl },
  ]));
  out();
  out(`${lista.length} entidad(es). Productos de una entidad: credito-hipotecario-ecuador programas --entidad <slug>`);
  pie();
}

// ---------- entrada ----------

const COMANDOS = {
  evaluar: cmdEvaluar, cuota: cmdCuota, programas: cmdProgramas, programa: cmdPrograma, entidades: cmdEntidades,
};

async function main(argv) {
  const [comando, ...resto] = argv;
  if (comando === undefined || comando === 'help' || comando === 'ayuda' || comando === '--help' || comando === '-h') {
    out(AYUDA);
    return;
  }
  if (comando === '--version' || comando === '-v') {
    out(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
    return;
  }
  // Permite "npx github:Vreinn-Tech/Credito-Hipotecario-Ecuador credito-hipotecario-ecuador-mcp".
  if (comando === 'mcp' || comando === 'credito-hipotecario-ecuador-mcp') {
    process.argv.splice(2, 1);
    await import('./mcp.js');
    return;
  }
  if (resto.includes('--help') || resto.includes('-h')) {
    out(AYUDA);
    return;
  }
  const fn = COMANDOS[comando];
  if (!fn) throw new ErrorDeUso(`Comando desconocido: "${comando}".`);
  fn(resto);
}

process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); });

main(process.argv.slice(2)).catch((e) => {
  const deUso = e instanceof ErrorDeUso || String(e?.code ?? '').startsWith('ERR_PARSE_ARGS');
  const mensaje = String(e?.message ?? e)
    .replace(/^Unknown option '([^']+)'.*$/s, 'Opción desconocida: $1')
    .replace(/^Option '([^']+)' argument missing.*$/s, 'A la opción $1 le falta su valor.')
    .replace(/^Option '([^']+)' does not take an argument.*$/s, 'La opción $1 no lleva valor.')
    .replace(/^Unexpected argument '([^']+)'.*$/s, 'Argumento inesperado: $1')
    .replace(/^Option '([^']+)' argument is ambiguous.*$/s, 'El valor de la opción $1 es ambiguo; usa --opcion=valor.');
  process.stderr.write(`Error: ${mensaje}\n`);
  if (deUso) process.stderr.write('Ejecuta "credito-hipotecario-ecuador --help" para ver las opciones.\n');
  process.exitCode = deUso ? 2 : 1;
});
