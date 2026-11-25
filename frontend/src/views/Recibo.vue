<template>
  <v-container class="mt-6 px-3 main-container" fluid>
    <div class="d-flex align-center justify-space-between mb-4 no-print">
      <div>
        <h1 class="text-h4 font-weight-bold">Recibo estimado</h1>
        <p class="text-subtitle-2 text-grey-darken-1">Así se vería tu recibo de luz de este bimestre</p>
      </div>
      <v-btn v-if="p" prepend-icon="mdi-printer-outline" variant="tonal" color="green-darken-2" class="text-none" @click="imprimir">Imprimir</v-btn>
    </div>

    <div v-if="cargando" class="d-flex justify-center my-10"><v-progress-circular indeterminate color="green-darken-2" /></div>

    <v-alert v-else-if="!hogar" type="info" variant="tonal" class="rounded-xl">
      Primero hay que configurar el hogar (tarifa y fecha del recibo).
      <template #append v-if="userStore.esTitular"><v-btn size="small" variant="flat" color="blue-darken-2" class="text-none" to="/hogar">Configurar</v-btn></template>
    </v-alert>

    <template v-else-if="p">
      <v-btn-toggle v-model="vista" color="green-darken-2" mandatory rounded="xl" density="compact" class="bg-green-lighten-5 mb-3 no-print">
        <v-btn value="proyectado" class="text-none text-caption">Al cierre del bimestre (pronóstico)</v-btn>
        <v-btn value="actual" class="text-none text-caption">Lo que llevas hasta hoy</v-btn>
      </v-btn-toggle>

      <!-- ===================== HOJA DEL RECIBO ===================== -->
      <div class="hoja">
        <!-- Encabezado -->
        <div class="encabezado">
          <div class="d-flex align-center">
            <img src="/logopower.png" alt="" class="logo" />
            <div>
              <div class="marca">PowerTech Hogar</div>
              <div class="subtitulo">Recibo estimado de energía eléctrica · uso doméstico</div>
            </div>
          </div>
          <div class="sello">ESTIMADO<br /><span>no es un recibo oficial de CFE</span></div>
        </div>

        <!-- Datos del servicio y total -->
        <div class="fila-datos">
          <div class="datos">
            <div class="etiqueta">Titular</div>
            <div class="valor">{{ titular }}</div>
            <div class="etiqueta mt-2">Domicilio</div>
            <div class="valor">{{ hogar.nombre }}{{ hogar.ciudad ? `, ${hogar.ciudad}` : '' }}</div>
            <div class="d-flex ga-6 mt-2">
              <div><div class="etiqueta">N.º de sensor</div><div class="valor mono">{{ hogar.medidor?.codigoMedidor || '—' }}</div></div>
              <div><div class="etiqueta">Tarifa</div><div class="valor">{{ hogar.tarifa }}</div></div>
            </div>
          </div>
          <div class="total-caja">
            <div class="total-titulo">{{ vista === 'actual' ? 'IMPORTE HASTA HOY' : 'TOTAL A PAGAR' }}</div>
            <div class="total-monto">{{ pesos(r.total) }}</div>
            <div class="total-detalle">({{ montoEnLetra }})</div>
            <div class="total-linea"><span>Periodo facturado</span><b>{{ fechaRecibo(p.periodo.inicio) }} – {{ fechaRecibo(finInclusivo) }}</b></div>
            <div class="total-linea"><span>Fecha de corte</span><b>{{ fechaRecibo(finInclusivo) }}</b></div>
          </div>
        </div>

        <!-- Consumo -->
        <div class="seccion-titulo">Consumo</div>
        <table class="tabla">
          <thead><tr><th>Concepto</th><th class="num">Valor</th></tr></thead>
          <tbody>
            <tr><td>Energía del periodo (kWh)</td><td class="num"><b>{{ formato(r.kwh, 0) }}</b></td></tr>
            <tr><td>Días {{ vista === 'actual' ? 'transcurridos' : 'del periodo' }}</td><td class="num">{{ diasVista }}</td></tr>
            <tr><td>Consumo promedio diario (kWh)</td><td class="num">{{ formato(r.kwh / Math.max(1, diasVista), 1) }}</td></tr>
            <tr><td>Costo promedio diario</td><td class="num">{{ pesos(r.total / Math.max(1, diasVista)) }}</td></tr>
          </tbody>
        </table>

        <!-- Desglose -->
        <div class="seccion-titulo">Desglose del importe a pagar</div>
        <table class="tabla">
          <thead><tr><th>Concepto</th><th class="num">Medido (kWh)</th><th class="num">Precio (MXN)</th><th class="num">Subtotal (MXN)</th></tr></thead>
          <tbody>
            <tr v-for="e in r.escalones" :key="e.clave + e.nombre" :class="{ tenue: !e.kwh }">
              <td>{{ e.nombre }}</td>
              <td class="num">{{ formato(e.kwh, 0) }}</td>
              <td class="num">{{ formato(e.precio, 3) }}</td>
              <td class="num">{{ formato(e.importe, 2) }}</td>
            </tr>
            <tr class="separador"><td colspan="3">Energía</td><td class="num">{{ formato(r.energia, 2) }}</td></tr>
            <tr><td colspan="3">IVA 16 %</td><td class="num">{{ formato(r.iva, 2) }}</td></tr>
            <tr><td colspan="3">Fac. del periodo</td><td class="num">{{ formato(r.total, 2) }}</td></tr>
            <tr class="tenue"><td colspan="3">DAP (derecho de alumbrado público, lo fija tu municipio)</td><td class="num">no incluido</td></tr>
            <tr class="total-fila"><td colspan="3">Total</td><td class="num">{{ pesos(r.total) }}</td></tr>
          </tbody>
        </table>

        <!-- Costo de producción y apoyo gubernamental (como en el recibo de CFE) -->
        <template v-if="r.produccion">
          <div class="seccion-titulo">Costo de producción</div>
          <table class="tabla">
            <thead><tr><th>Concepto</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
            <tbody>
              <tr v-for="c in r.produccion.conceptos" :key="c.concepto">
                <td>{{ c.concepto }}</td>
                <td class="num">{{ c.precio ? formato(c.precio, 3) : '' }}</td>
                <td class="num">{{ formato(c.importe, 2) }}</td>
              </tr>
              <tr class="separador"><td>Costo de producción</td><td></td><td class="num">{{ formato(r.produccion.total, 2) }}</td></tr>
            </tbody>
          </table>
          <div class="apoyo">
            <div><span>Costo de producción</span><b>{{ pesos(r.produccion.total) }}</b></div>
            <div><span>Apoyo gubernamental</span><b class="text-green-darken-2">− {{ pesos(r.produccion.apoyo) }}</b></div>
            <div class="paga"><span>Facturación del periodo (antes de IVA)</span><b>{{ pesos(r.energia) }}</b></div>
          </div>
          <div class="nota" v-if="r.produccion.total > 0">
            El gobierno cubre el {{ formato((r.produccion.apoyo / r.produccion.total) * 100, 0) }} % del costo de tu energía.
            Si tu promedio supera el límite de alto consumo, pasarías a tarifa DAC y perderías este apoyo.
          </div>
        </template>

        <!-- Historial -->
        <template v-if="historial.length">
        <div class="seccion-titulo">Consumo histórico</div>
        <div class="historial">
          <div v-for="h in historial" :key="h.inicio" class="hist-col" :class="{ actual: h.actual }">
            <div class="hist-kwh">{{ h.conDatos ? formato(h.kwh, 0) : '' }}</div>
            <div class="hist-barra-wrap"><div class="hist-barra" :style="{ height: `${h.conDatos ? Math.max(4, (h.kwh / maxHist) * 100) : 0}%` }"></div></div>
            <div class="hist-periodo">{{ mesCorto(h.inicio) }}–{{ mesCorto(finDe(h.fin)) }}</div>
          </div>
        </div>
        <table class="tabla mt-2">
          <thead><tr><th>Periodo</th><th class="num">kWh</th><th class="num">Importe estimado</th></tr></thead>
          <tbody>
            <tr v-for="h in [...historial].reverse()" :key="'t' + h.inicio" :class="{ tenue: !h.conDatos }">
              <td>{{ fechaRecibo(h.inicio) }} – {{ fechaRecibo(finDe(h.fin)) }}{{ h.actual ? ' (actual, hasta hoy)' : '' }}</td>
              <td class="num">{{ h.conDatos ? formato(h.kwh, 0) : 'sin datos' }}</td>
              <td class="num">{{ h.conDatos ? pesos(h.importe) : '—' }}</td>
            </tr>
          </tbody>
        </table>
        </template>

        <!-- DAC -->
        <div class="seccion-titulo">Límite de alto consumo (DAC)</div>
        <div class="dac" :class="{ riesgo: p.dac.enRiesgo }">
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span>Promedio mensual estimado: <b>{{ formato(p.dac.kwhMensualEstimado, 0) }} kWh</b></span>
            <span>Límite tarifa {{ hogar.tarifa }}: <b>{{ p.dac.limiteMensual }} kWh</b></span>
          </div>
          <v-progress-linear :model-value="Math.min(100, p.dac.porcentaje)" :color="p.dac.enRiesgo ? 'red' : 'green'" height="10" rounded />
          <div class="text-caption mt-1">
            {{ p.dac.enRiesgo
              ? 'Estás cerca o arriba del límite: si el promedio de 12 meses lo supera, CFE te cambia a tarifa DAC.'
              : 'Vas bien: tu consumo está por debajo del límite de alto consumo.' }}
          </div>
        </div>

        <div class="pie">
          Estimación calculada por PowerTech Hogar con las lecturas del sensor de consumo y precios de referencia de la tarifa doméstica de CFE.
          El importe real lo determina CFE en tu recibo oficial.
        </div>
      </div>

      <!-- ===================== AYUDA (no se imprime) ===================== -->
      <v-expansion-panels variant="accordion" class="my-4 rounded-xl no-print">
        <v-expansion-panel v-if="tarifa" title="Tu tarifa en detalle">
          <v-expansion-panel-text>
            <div v-for="t in tablas" :key="t.titulo" class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">{{ t.titulo }}</div>
              <div v-for="f in t.filas" :key="f.nombre" class="d-flex justify-space-between text-body-2 py-1 fila">
                <span>{{ f.nombre }}</span>
                <span class="text-grey-darken-2">{{ f.limiteBimestral === null ? 'lo demás' : `hasta ${f.limiteBimestral} kWh/bim.` }} · {{ pesos(f.precio) }}</span>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel title="Cómo leer tu recibo de CFE">
          <v-expansion-panel-text>
            <ul class="text-body-2 pl-4">
              <li class="mb-2"><b>Periodo facturado:</b> las fechas del bimestre. Pon la fecha de inicio en <i>Mi hogar</i> para usar el mismo periodo.</li>
              <li class="mb-2"><b>Lectura actual y anterior:</b> la resta es tu consumo del bimestre en kWh.</li>
              <li class="mb-2"><b>Desglose del importe:</b> básico, intermedio y excedente, cada uno con su precio por kWh.</li>
              <li class="mb-2"><b>Apoyo gubernamental:</b> la diferencia entre lo que cuesta producir y llevar tu energía y lo que tú pagas; si pasas a DAC lo pierdes.</li>
              <li><b>DAP:</b> derecho de alumbrado público, lo cobra el municipio junto con la luz.</li>
            </ul>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel title="Para bajar tu recibo">
          <v-expansion-panel-text>
            <ul class="text-body-2 pl-4">
              <li v-if="faltanParaSubir !== null" class="mb-1">Te quedan <b>{{ formato(faltanParaSubir, 0) }} kWh</b> antes de pasar al siguiente escalón.</li>
              <li class="mb-1">El excedente cuesta varias veces más que el básico: cuida el consumo al final del bimestre.</li>
              <li class="mb-1">El minisplit suele ser lo que más gasta: 24–25 °C y filtros limpios hacen gran diferencia.</li>
              <li>Revisa en <router-link to="/consumo">Consumo</router-link> en qué horas gastas más.</li>
            </ul>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/users';
import { useNotifyStore } from '@/stores/notify';
import { useHogarStore, pesos, mensajeError } from '@/stores/hogar';

const userStore = useUserStore();
const notify = useNotifyStore();
const hogarStore = useHogarStore();
const { hogar, periodo: p } = storeToRefs(hogarStore);

const cargando = ref(true);
const vista = ref('proyectado');
const tarifa = ref(null);
const historial = ref([]);

const r = computed(() => (vista.value === 'actual' ? p.value.reciboActual : p.value.reciboProyectado));
const diasVista = computed(() => (vista.value === 'actual' ? Math.max(1, Math.floor(p.value.periodo.diasTranscurridos)) : p.value.periodo.diasTotales));
const titular = computed(() => (userStore.esTitular ? userStore.usuario?.nombre : `Familia de ${hogar.value?.nombre || 'la casa'}`) || '—');

const formato = (n, d = 2) => (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
const aFecha = (f) => { const [a, m, d] = String(f).split('-').map(Number); return new Date(a, m - 1, d); };
const fechaRecibo = (f) => aFecha(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/\./g, '');
const mesCorto = (f) => aFecha(f).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase();
const finDe = (fin) => { const f = aFecha(fin); f.setDate(f.getDate() - 1); return `${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`; };
const finInclusivo = computed(() => finDe(p.value.periodo.fin));
const maxHist = computed(() => Math.max(1, ...historial.value.map((h) => h.kwh)));

// Total en letra, como en los recibos ("MIL DOSCIENTOS PESOS 50/100 M.N.")
const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
  'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
function menorMil(n) {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), resto = n % 100;
  let t = CENTENAS[c];
  if (resto) {
    const dec = resto < 30 ? UNIDADES[resto] : DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` Y ${UNIDADES[resto % 10]}` : '');
    t = t ? `${t} ${dec}` : dec;
  }
  return t;
}
function enLetra(n) {
  if (n === 0) return 'CERO';
  const miles = Math.floor(n / 1000), resto = n % 1000;
  const m = miles ? (miles === 1 ? 'MIL' : `${menorMil(miles)} MIL`) : '';
  return [m, resto ? menorMil(resto) : ''].filter(Boolean).join(' ');
}
const montoEnLetra = computed(() => {
  const total = Math.round((r.value?.total || 0) * 100) / 100;
  const enteros = Math.floor(total);
  const centavos = String(Math.round((total - enteros) * 100)).padStart(2, '0');
  return `${enLetra(enteros)} ${enteros === 1 ? 'PESO' : 'PESOS'} ${centavos}/100 M.N.`;
});

const tablas = computed(() => {
  if (!tarifa.value) return [];
  const t = [];
  if (tarifa.value.verano) t.push({ titulo: 'En verano', filas: tarifa.value.verano });
  t.push({ titulo: tarifa.value.verano ? 'Fuera de verano' : 'Todo el año', filas: tarifa.value.fueraVerano });
  return t;
});
const faltanParaSubir = computed(() => {
  const e = (p.value?.reciboActual.escalones || []).find((x) => x.limite !== null && x.kwh < x.limite);
  return e ? e.limite - e.kwh : null;
});

const imprimir = () => window.print();

onMounted(async () => {
  try {
    const h = hogar.value || await hogarStore.cargar();
    if (h) {
      // El recibo principal no depende del historial ni de la tabla de tarifa:
      // si alguno falla, el recibo se muestra igual sin esa sección.
      const [t, , hist] = await Promise.all([
        hogarStore.tarifa().catch(() => null),
        hogarStore.cargarPeriodo(),
        hogarStore.historial().catch(() => []),
      ]);
      tarifa.value = t;
      historial.value = Array.isArray(hist) ? hist : [];
    }
  } catch (e) {
    notify.show(mensajeError(e, 'No se pudo calcular el recibo'), 'error');
  } finally {
    cargando.value = false;
  }
});
</script>

<style scoped>
.main-container { max-width: 760px; margin: 0 auto; }
.hoja { background: #fff; border: 1px solid #d9e2dc; border-radius: 6px; box-shadow: 0 2px 10px rgba(0, 0, 0, .06); overflow: hidden; font-size: 14px; }
.encabezado { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: #1b5e20; color: #fff; }
.logo { width: 46px; height: 46px; object-fit: contain; background: #fff; border-radius: 8px; padding: 3px; margin-right: 12px; }
.marca { font-size: 20px; font-weight: 800; letter-spacing: .3px; }
.subtitulo { font-size: 12px; opacity: .9; }
.sello { border: 2px solid #fff; border-radius: 4px; padding: 4px 10px; text-align: center; font-weight: 800; font-size: 13px; letter-spacing: 1px; transform: rotate(-3deg); }
.sello span { font-size: 9px; font-weight: 600; letter-spacing: 0; }
.fila-datos { display: grid; grid-template-columns: 1fr 260px; gap: 14px; padding: 16px 18px; border-bottom: 3px solid #1b5e20; }
.etiqueta { font-size: 10px; text-transform: uppercase; color: #6b7a70; letter-spacing: .5px; }
.valor { font-weight: 600; color: #222; }
.mono { font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
.total-caja { border: 2px solid #1b5e20; border-radius: 6px; padding: 10px 12px; background: #f3f9f4; }
.total-titulo { font-size: 12px; font-weight: 800; color: #1b5e20; letter-spacing: 1px; }
.total-monto { font-size: 32px; font-weight: 900; color: #1b5e20; line-height: 1.1; }
.total-detalle { font-size: 9px; color: #555; margin-bottom: 6px; }
.total-linea { display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #c8d8cc; padding-top: 3px; margin-top: 3px; }
.total-linea span { color: #555; }
.seccion-titulo { background: #e8f1ea; color: #1b5e20; font-weight: 800; font-size: 12px; letter-spacing: .6px; text-transform: uppercase; padding: 6px 18px; margin-top: 12px; }
.tabla { width: calc(100% - 36px); margin: 6px 18px 0; border-collapse: collapse; font-size: 13px; }
.tabla th { text-align: left; font-size: 11px; color: #6b7a70; font-weight: 700; border-bottom: 1px solid #ccd6cf; padding: 4px 2px; }
.tabla td { padding: 4px 2px; border-bottom: 1px solid #f0f2f1; }
.tabla .num { text-align: right; white-space: nowrap; }
.tabla .tenue td { color: #a0a7a3; }
.tabla .separador td { border-top: 1px solid #ccd6cf; font-weight: 600; }
.tabla .total-fila td { font-weight: 900; font-size: 15px; color: #1b5e20; border-top: 2px solid #1b5e20; border-bottom: none; padding-top: 6px; }
.apoyo { margin: 8px 18px 0; display: grid; gap: 4px; }
.apoyo > div { display: flex; justify-content: space-between; }
.apoyo .paga { border-top: 1px solid #ccd6cf; padding-top: 4px; font-size: 15px; }
.nota { font-size: 10px; color: #8a938e; margin: 4px 18px 0; }
.historial { display: flex; align-items: flex-end; gap: 10px; height: 130px; margin: 10px 18px 0; }
.hist-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.hist-kwh { font-size: 10px; color: #555; height: 14px; }
.hist-barra-wrap { flex: 1; width: 70%; display: flex; align-items: flex-end; border-bottom: 1px solid #ccd6cf; }
.hist-barra { width: 100%; background: #a5d6a7; border-radius: 2px 2px 0 0; }
.hist-col.actual .hist-barra { background: #2e7d32; }
.hist-periodo { font-size: 9px; color: #6b7a70; margin-top: 3px; white-space: nowrap; }
.dac { margin: 8px 18px 0; padding: 10px 12px; border: 1px solid #d9e2dc; border-radius: 6px; }
.dac.riesgo { background: #fff4f3; border-color: #f5c2bd; }
.pie { margin-top: 16px; padding: 10px 18px; background: #f6f8f7; font-size: 10px; color: #6b7a70; border-top: 1px solid #e2e8e4; }
.fila { border-bottom: 1px dashed #eee; }
@media (max-width: 600px) {
  .fila-datos { grid-template-columns: 1fr; }
  .sello { display: none; }
}
</style>

<style>
@media print {
  .no-print, .menu-bar, .copilot-container, .powerbot-drawer { display: none !important; }
  .hoja { box-shadow: none !important; border: none !important; }
  .encabezado, .seccion-titulo, .total-caja, .hist-barra { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
