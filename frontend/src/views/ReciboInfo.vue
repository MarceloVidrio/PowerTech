    <template>
        <div class="recibo-container">
            <div v-if="!embedded" class="embedded-back d-flex align-center mb-2">
                <v-btn icon="mdi-arrow-left" variant="text" color="blue-darken-2" @click="$router.back()"></v-btn>
                <span class="text-subtitle-1 font-weight-bold ml-2">Volver a la selección</span>
            </div>
            <!-- Aviso Oficial -->
            <div class="cfe-disclaimer">
                <strong>Aviso:</strong> Este recibo es una <strong>simulación didáctica de PowerTech</strong> para fines
                académicos. Los valores, cargos y cálculos mostrados son representativos y no constituyen un recibo oficial de CFE.
            </div>

            <!-- Controles de Navegación -->
            <header class="header">
                <div class="header-titles">
                    <h1>Información de Recibo Empresarial</h1>
                    <p class="subtitle">Modalidad: <strong>{{ activeTarifa === 'GDMTH' ? 'Gran Demanda Horaria (>= 100kW)' :
                        'Gran Demanda Ordinaria (< 100kW)' }}</strong>
                    </p>
                </div>

                <div class="controls-wrapper">
                    <div class="toggle-group tarifa-toggle">
                        <span class="toggle-label">Tarifa:</span>
                        <button :class="['tab-btn', { active: activeTarifa === 'GDMTH' }]"
                            @click="setTarifa('GDMTH')">GDMTH</button>
                        <button :class="['tab-btn', { active: activeTarifa === 'GDMTO' }]"
                            @click="setTarifa('GDMTO')">GDMTO</button>
                    </div>
                    <div class="toggle-group vista-toggle">
                        <span class="toggle-label">Vista:</span>
                        <button :class="['tab-btn', { active: activeTab === 'frente' }]"
                            @click="activeTab = 'frente'">Frente</button>
                        <button :class="['tab-btn', { active: activeTab === 'reverso' }]"
                            @click="activeTab = 'reverso'">Reverso</button>
                    </div>
                </div>
            </header>

            <div class="main-content">

                <!-- LADO IZQUIERDO: EL RECIBO INTERACTIVO -->
                <div class="recibo-wrapper">

                    <!-- ======================= FRENTE ======================= -->
                    <div v-show="activeTab === 'frente'" class="recibo-mockup">

                        <!-- Datos Principales (Dinámico) -->
                        <div class="clickable-section" :class="{ selected: selectedSection === 'datosPrincipales' }"
                            @click="selectSection('datosPrincipales')">
                            <div class="flex-row">
                                <div class="col-left">
                                    <h2>{{ salaNombre || 'Sala seleccionada' }}</h2>
                                    <p class="mock-text">{{ edificioNombre || 'Edificio seleccionado' }}</p>
                                    <p><strong>CÓDIGO DE SALA:</strong> {{ salaId || 'N/D' }}</p>
                                    <p><strong>TARIFA:</strong> {{ activeTarifa }} &nbsp;&nbsp;
                                        <strong>MULTIPLICADOR:</strong> {{ activeTarifa === 'GDMTH' ? '120' : '60' }}
                                    </p>
                                    <div class="datos-carga">
                                    <span><strong>CARGA INSTALADA:</strong> {{ activeTarifa === 'GDMTH' ? '500 kW' : '95 kW' }}</span>
                                    <span><strong>DEMANDA CONTRATADA:</strong> {{ activeTarifa === 'GDMTH' ? '450 kW' : '85 kW' }}</span>
                                        </div>
                                </div>
                                <div class="col-right text-center">
                                    <p class="total-pagar">
                                        TOTAL A PAGAR:<br>
                                        <span>${{ totalPagar.toFixed(2) }}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Lecturas (GDMTH) -->
                        <div v-if="activeTarifa === 'GDMTH'" class="clickable-section"
                            :class="{ selected: selectedSection === 'lecturasHorarias' }"
                            @click="selectSection('lecturasHorarias')">
                            <h3 class="section-title">Lecturas de Energía y Demanda</h3>
                            <table class="mock-table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th>Lectura Actual</th>
                                        <th>Lectura Anterior</th>
                                        <th>Diferencia</th>
                                        <th>Totales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Potencia medida</td>
                                        <td>{{ lecturaActual.toFixed(0) }} W</td>
                                        <td>{{ lecturaAnterior.toFixed(0) }} W</td>
                                        <td>
                                            {{ diferenciaPotencia >= 0 ? '+' : '' }}{{ diferenciaPotencia.toFixed(0) }} W
                                        </td>
                                        <td>—</td>
                                    </tr>
                                    <tr>
                                        <td>Energía estimada</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td><strong>{{ consumoFormateado }} kWh</strong></td>
                                    </tr>
                                    <tr class="highlight-row">
                                        <td>kW Max (Demanda)</td>
                                        <td>{{ demandaFormateada }} kW</td>
                                        <td>{{ (lecturaAnterior / 1000).toFixed(3) }} kW</td>
                                        <td>
                                            {{ ((lecturaActual - lecturaAnterior) / 1000).toFixed(3) }} kW
                                        </td>
                                        <td>{{ demandaFormateada }} kW</td>
                                    </tr>
                                    <tr>
                                        <td>Energía reactiva</td>
                                        <td>N/D</td>
                                        <td>N/D</td>
                                        <td>N/D</td>
                                        <td>N/D</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div class="flex-row justify-between metrics-bar">
                                <span>Factor de Potencia: N/D</span>
                                <span>Demanda Máxima: {{ demandaFormateada }} kW</span>
                            </div>
                        </div>

                        <!-- Lecturas (GDMTO) -->
                        <div
                            v-if="activeTarifa === 'GDMTO'"
                            class="clickable-section"
                            :class="{ selected: selectedSection === 'lecturasOrdinarias' }"
                            @click="selectSection('lecturasOrdinarias')"
                        >
                            <h3 class="section-title">Lecturas de Energía y Demanda</h3>

                            <table class="mock-table">
                                <thead>
                                    <tr>
                                        <th>Concepto</th>
                                        <th>Lectura Actual</th>
                                        <th>Lectura Anterior</th>
                                        <th>Diferencia</th>
                                        <th>Totales</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr>
                                        <td>Potencia medida</td>
                                        <td>{{ lecturaActual.toFixed(0) }} W</td>
                                        <td>{{ lecturaAnterior.toFixed(0) }} W</td>
                                        <td>
                                            {{ diferenciaPotencia >= 0 ? '+' : '' }}{{ diferenciaPotencia.toFixed(0) }} W
                                        </td>
                                        <td>—</td>
                                    </tr>

                                    <tr>
                                        <td>Energía estimada</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td>—</td>
                                        <td>
                                            <strong>{{ consumoFormateado }} kWh</strong>
                                        </td>
                                    </tr>

                                    <tr class="highlight-row">
                                        <td>kW Max (Demanda)</td>
                                        <td>{{ demandaFormateada }} kW</td>
                                        <td>{{ (lecturaAnterior / 1000).toFixed(3) }} kW</td>
                                        <td>
                                            {{ ((lecturaActual - lecturaAnterior) / 1000).toFixed(3) }} kW
                                        </td>
                                        <td>{{ demandaFormateada }} kW</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div class="flex-row justify-between metrics-bar bonus">
                                <span>Factor de Potencia: N/D</span>
                                <span>Demanda Máxima: {{ demandaFormateada }} kW</span>
                            </div>
                        </div>

                        <!-- Costos y Desglose (Dinámico) -->
                       <div class="split-row">
                            <div class="clickable-section half" :class="{ selected: selectedSection === 'costosMercado' }"
                                @click="selectSection('costosMercado')">

                                <h3 class="section-title">Costos del Mercado</h3>

                                <p class="mock-line">
                                    Suministro
                                    <span>${{ costoSuministro.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Distribución
                                    <span>${{ costoDistribucion.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Transmisión
                                    <span>${{ costoTransmision.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    CENACE
                                    <span>${{ costoCenace.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Generación (Energía)
                                    <span>${{ costoGeneracion.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Capacidad
                                    <span>${{ costoCapacidad.toFixed(2) }}</span>
                                </p>

                            </div>

                            <div class="clickable-section half desglose-print-block" :class="{ selected: selectedSection === 'desglose' }"
                                @click="selectSection('desglose')">
                                <h3 class="section-title">Desglose del importe</h3>

                                <p class="mock-line">
                                    Cargo Fijo
                                    <span>${{ cargoFijo.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Energía
                                    <span>${{ cargoEnergia.toFixed(2) }}</span>
                                </p>

                                <p v-if="activeTarifa === 'GDMTH'" class="mock-line">
                                    Ajuste Factor de Potencia
                                    <span>$0.00</span>
                                </p>

                                <p class="mock-line">
                                    Distribución
                                    <span>${{ costoDistribucion.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Capacidad
                                    <span>${{ costoCapacidad.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    Subtotal
                                    <span>${{ subtotal.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    IVA 16%
                                    <span>${{ iva.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    DAP
                                    <span>${{ dap.toFixed(2) }}</span>
                                </p>

                                <p class="mock-line">
                                    <strong>
                                        Total a pagar
                                        <span>${{ totalPagar.toFixed(2) }}</span>
                                    </strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- ======================= REVERSO ======================= -->
                    <div v-show="activeTab === 'reverso'" class="recibo-mockup">

                        <!-- Comportamiento de Demanda (Común, datos ajustados) -->
                        <div class="clickable-section" :class="{ selected: selectedSection === 'comportamientoDemanda' }"
                            @click="selectSection('comportamientoDemanda')">
                            <h3 class="text-center">HISTORIAL DE DEMANDA</h3>
                            <div class="flex-row items-center mt-10">
                                <div class="col-left w-50">
                                    <table class="mock-table small-text">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Demanda (kW)</th>
                                                <th>F.P. (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(lectura, index) in lecturas"
                                                :key="`hist-${lectura.codigoSensor}-${lectura.fechaHora}`">

                                                <td>
                                                    {{ new Date(lectura.fechaHora).toLocaleString('es-MX') }}
                                                </td>

                                                <td>
                                                    {{ (Number(lectura.valor) / 1000).toFixed(3) }}
                                                </td>

                                                <td>
                                                    N/D
                                                </td>

                                            </tr>

                                            <tr v-if="lecturas.length === 0">
                                                <td colspan="3" class="text-center">
                                                    No hay lecturas registradas.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="col-right w-50 chart-mockup fp-chart">

                                    <svg
                                        v-if="lecturas.length > 0"
                                        viewBox="0 0 100 55"
                                        class="line-chart"
                                        preserveAspectRatio="none"
                                    >
                                        <!-- Eje inferior -->
                                        <line
                                            x1="5"
                                            y1="45"
                                            x2="95"
                                            y2="45"
                                            stroke="#cfcfcf"
                                            stroke-width="0.7"
                                        />

                                        <!-- Línea de tendencia -->
                                        <polyline
                                            :points="demandaLinePoints"
                                            fill="none"
                                            stroke="#00845a"
                                            stroke-width="3"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            vector-effect="non-scaling-stroke"
                                        />

                                        <!-- Puntos de las lecturas -->
                                        <circle
                                            v-for="(punto, index) in demandaChartPoints"
                                            :key="`demanda-point-${index}`"
                                            :cx="punto.x"
                                            :cy="punto.y"
                                            r="1.8"
                                            fill="#00845a"
                                        />

                                        <!-- Valores -->
                                        <text
                                            v-for="(punto, index) in demandaChartPoints"
                                            :key="`demanda-label-${index}`"
                                            :x="punto.x"
                                            y="51"
                                            text-anchor="middle"
                                            font-size="3"
                                            fill="#666"
                                        >
                                            {{ punto.valor.toFixed(2) }}
                                        </text>
                                    </svg>

                                    <div
                                        v-else
                                        style="
                                            width: 100%;
                                            text-align: center;
                                            color: #666;
                                        "
                                    >
                                        Sin lecturas
                                    </div>

                                    <span class="chart-label">
                                        Comportamiento de Demanda
                                    </span>

                                </div>
</div>
</div>

<!-- Consumo Histórico -->
                        <div
                            class="clickable-section"
                            :class="{ selected: selectedSection === 'consumoHistorico' }"
                            @click="selectSection('consumoHistorico')"
                        >
                            <h3 class="text-center">COMPORTAMIENTO DE LECTURAS</h3>

                            <div v-if="lecturas.length > 0">

                                <div class="flex-row items-center">

                                    <div class="w-100 chart-mockup-bars">

                                        <div
                                            v-for="(lectura, index) in lecturas"
                                            :key="`consumo-${lectura.codigoSensor}-${lectura.fechaHora}`"
                                            class="bar-group single"
                                        >

                                            <div
                                                class="bar base"
                                                :style="{
                                                    height: `${Math.max(
                                                        8,
                                                        (Number(lectura.valor) /
                                                        Math.max(...lecturas.map(l => Number(l.valor)))) * 100
                                                    )}%`
                                                }"
                                            ></div>

                                        </div>

                                    </div>

                                </div>

                                <div class="legend flex-row justify-center mt-10">
                                    <span class="leg-item">
                                        <span class="box base"></span>
                                        Potencia medida
                                    </span>
                                </div>

                                <div class="text-center mt-4">
                                    <small>
                                        Lecturas registradas: {{ lecturas.length }}
                                    </small>
                                </div>

                            </div>

                            <div v-else class="text-center mt-4">
                                <small>
                                    No hay lecturas registradas para esta sala.
                                </small>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- LADO DERECHO: PANEL DE INFORMACIÓN (COMÚN) -->
                <div class="info-panel">
                    <div v-if="selectedData" class="info-card">
                        <h2>{{ selectedData.title }}</h2>
                        <div class="info-content" v-html="selectedData.content"></div>
                    </div>
                    <div v-else class="empty-state">
                        <p>👆 Selecciona una tarifa en el menú superior y haz clic en cualquier sección resaltada del recibo
                            para entender cómo funciona la facturación comercial.</p>
                    </div>
                </div>
            </div>
        </div>
    </template>

    <script setup>
    import { ref, computed, watch, onMounted } from 'vue'
    import axios from 'axios'
    import { useRoute } from 'vue-router'

    const route = useRoute()

    const props = defineProps({
        embedded: {
            type: Boolean,
            default: false
        }
    })

    const embedded = computed(() => props.embedded)

    const activeTab = ref('frente')
    const activeTarifa = ref('GDMTH')
    const selectedSection = ref(null)

    // ============================================================
    // DATOS DE POWERTECH
    // ============================================================

    const edificioId = ref(route.query.edificio || route.params.buildingId || '')
    const salaId = ref(route.query.sala || route.params.roomId || '')

    const lecturas = ref([])
    const cargandoLecturas = ref(false)
    const errorLecturas = ref('')

    // Identificación dinámica del edificio y la sala seleccionados
    const edificioNombre = ref('')
    const salaNombre = ref('')
    const cargandoIdentificacion = ref(false)
    const errorIdentificacion = ref('')

    // Obtener la identificación real del edificio y la sala
    const obtenerIdentificacion = async () => {
        if (!salaId.value) {
            errorIdentificacion.value = 'No se especificó una sala.'
            return
        }

        cargandoIdentificacion.value = true
        errorIdentificacion.value = ''

        try {
            const respuesta = await axios.get(
                `/report/room/${encodeURIComponent(salaId.value)}`
            )

            if (respuesta.data.error) {
                throw new Error(
                    respuesta.data.mensaje || 'No se pudo obtener la identificación del recibo.'
                )
            }

            const datos = respuesta.data.data || {}

            edificioNombre.value = datos.nombreEdificio || ''
            salaNombre.value = datos.nombreSala || ''

            console.log('Identificación PowerTech:', {
                edificio: edificioNombre.value,
                sala: salaNombre.value
            })

        } catch (error) {
            console.error('Error al obtener la identificación:', error)

            errorIdentificacion.value =
                error.response?.data?.mensaje ||
                'No fue posible obtener la identificación de PowerTech.'
        } finally {
            cargandoIdentificacion.value = false
        }
    }

    // Obtener las lecturas reales de la sala
    const obtenerLecturas = async () => {
        if (!salaId.value) {
            errorLecturas.value = 'No se especificó una sala.'
            return
        }

        cargandoLecturas.value = true
        errorLecturas.value = ''

        try {
            const respuesta = await axios.get(
                `/lecturas/sala/${encodeURIComponent(salaId.value)}`
            )

            if (respuesta.data.error) {
                throw new Error(
                    respuesta.data.mensaje || 'No se pudieron obtener las lecturas.'
                )
            }

            lecturas.value = respuesta.data.data || []

            console.log('Lecturas PowerTech:', lecturas.value)

        } catch (error) {
            console.error('Error al obtener lecturas:', error)

            errorLecturas.value =
                error.response?.data?.mensaje ||
                'No fue posible obtener las lecturas de PowerTech.'
        } finally {
            cargandoLecturas.value = false
        }
    }

    onMounted(() => {
        obtenerIdentificacion()
        obtenerLecturas()
    })

    // ============================================================
    // CÁLCULO DE CONSUMO DE ENERGÍA
    // ============================================================

    const consumoKwh = computed(() => {
        if (lecturas.value.length < 2) {
            return 0
        }

        let energiaWh = 0

        for (let i = 1; i < lecturas.value.length; i++) {
            const lecturaAnterior = lecturas.value[i - 1]
            const lecturaActual = lecturas.value[i]

            const fechaAnterior = new Date(lecturaAnterior.fechaHora)
            const fechaActual = new Date(lecturaActual.fechaHora)

            const horas =
                (fechaActual - fechaAnterior) / (1000 * 60 * 60)

            if (horas > 0) {
                const potenciaPromedio =
                    (Number(lecturaAnterior.valor) +
                        Number(lecturaActual.valor)) / 2

                energiaWh += potenciaPromedio * horas
            }
        }

        return energiaWh / 1000
    })

    // ============================================================
    // DEMANDA MÁXIMA
    // ============================================================

    const demandaMaximaKw = computed(() => {
        if (lecturas.value.length === 0) {
            return 0
        }

        const valores = lecturas.value.map(
            lectura => Number(lectura.valor)
        )

        return Math.max(...valores) / 1000
    })

    // ============================================================
    // LECTURA ACTUAL Y ANTERIOR
    // ============================================================

    const lecturaActual = computed(() => {
        if (lecturas.value.length === 0) {
            return 0
        }

        return Number(
            lecturas.value[lecturas.value.length - 1].valor
        )
    })

    const lecturaAnterior = computed(() => {
        if (lecturas.value.length < 2) {
            return 0
        }

        return Number(
            lecturas.value[lecturas.value.length - 2].valor
        )
    })

    const diferenciaPotencia = computed(() => {
        return lecturaActual.value - lecturaAnterior.value
    })

    const consumoFormateado = computed(() => {
        return consumoKwh.value.toFixed(4)
    })

    const demandaFormateada = computed(() => {
        return demandaMaximaKw.value.toFixed(3)
    })

    // Puntos de la gráfica lineal de demanda usando las lecturas reales
    const demandaChartPoints = computed(() => {
        if (lecturas.value.length === 0) {
            return []
        }

        const valores = lecturas.value.map(
            lectura => Number(lectura.valor) / 1000
        )

        const minimo = Math.min(...valores)
        const maximo = Math.max(...valores)

        return valores.map((valor, index) => {
            const x = valores.length === 1
                ? 50
                : 5 + (index / (valores.length - 1)) * 90

            const y = maximo === minimo
                ? 25
                : 38 - ((valor - minimo) / (maximo - minimo)) * 25

            return { x, y, valor }
        })
    })

    const demandaLinePoints = computed(() => {
        return demandaChartPoints.value
            .map(punto => `${punto.x},${punto.y}`)
            .join(' ')
    })

        // ============================================================
        // COSTOS SIMULADOS DE ENERGÍA
        // ============================================================

        const costoSuministro = computed(() => {
            return activeTarifa.value === 'GDMTH' ? 520 : 350
        })

        const costoDistribucion = computed(() => {
            return activeTarifa.value === 'GDMTH'
                ? demandaMaximaKw.value * 120
                : demandaMaximaKw.value * 90
        })

        const costoTransmision = computed(() => {
            return activeTarifa.value === 'GDMTH'
                ? consumoKwh.value * 90
                : consumoKwh.value * 70
        })

        const costoCenace = computed(() => {
            return activeTarifa.value === 'GDMTH'
                ? consumoKwh.value * 7
                : consumoKwh.value * 5
        })

        const costoGeneracion = computed(() => {
            return activeTarifa.value === 'GDMTH'
                ? consumoKwh.value * 950
                : consumoKwh.value * 800
        })

        const costoCapacidad = computed(() => {
            return activeTarifa.value === 'GDMTH'
                ? demandaMaximaKw.value * 180
                : demandaMaximaKw.value * 140
        })

        const cargoFijo = computed(() => {
            return costoSuministro.value
        })

        const cargoEnergia = computed(() => {
            return costoGeneracion.value +
                costoTransmision.value +
                costoCenace.value
        })

        const ajusteFactorPotencia = computed(() => {
            return 0
        })

        const subtotal = computed(() => {
            return cargoFijo.value +
                cargoEnergia.value +
                costoDistribucion.value +
                costoCapacidad.value +
                ajusteFactorPotencia.value
        })

        const iva = computed(() => {
            return subtotal.value * 0.16
        })

        const dap = computed(() => {
            return subtotal.value * 0.02
        })

        const totalPagar = computed(() => {
            return subtotal.value +
                iva.value +
                dap.value
        })
    // ============================================================
    // LIMPIAR LA SELECCIÓN AL CAMBIAR DE PESTAÑA O TARIFA
    // ============================================================

    const setTarifa = (tarifa) => {
        activeTarifa.value = tarifa
        selectedSection.value = null
    }

    watch(activeTab, () => {
        selectedSection.value = null
    })

    const infoData = {
        // --- FRENTE ---
        datosPrincipales: {
            title: 'Datos de la Industria y Tarifa',
            content: `
                <ul>
                    <li><strong>Tarifa:</strong> Indica la modalidad de facturación seleccionada para el inmueble.</li>
                    <li><strong>Carga Instalada:</strong> Representa la potencia eléctrica instalada que puede utilizar el inmueble.</li>
                    <li><strong>Demanda Contratada:</strong> Corresponde al nivel de potencia considerado para la contratación del servicio.</li>
                    <li><strong>Total a Pagar:</strong> Es el importe calculado a partir de los cargos de suministro, energía, distribución y capacidad.</li>
                </ul>
            `
        },

        lecturasHorarias: {
            title: 'Lecturas, Energía y Demanda (GDMTH)',
            content: `
                <p>Esta sección muestra las lecturas obtenidas directamente de los sensores de PowerTech.</p>
                <ul>
                    <li><strong>Potencia medida:</strong> Muestra la lectura actual y la lectura anterior registrada por el sensor.</li>
                    <li><strong>Diferencia:</strong> Indica cuánto cambió la potencia entre ambas lecturas.</li>
                    <li><strong>Energía estimada:</strong> Se calcula utilizando las lecturas de potencia y el tiempo transcurrido entre ellas.</li>
                    <li><strong>Demanda Máxima:</strong> Corresponde al valor más alto de potencia registrado.</li>
                </ul>
            `
        },

        lecturasOrdinarias: {
            title: 'Lecturas, Energía y Demanda (GDMTO)',
            content: `
                <p>Esta sección muestra las lecturas obtenidas directamente de los sensores de PowerTech.</p>
                <ul>
                    <li><strong>Potencia medida:</strong> Muestra la lectura actual y la lectura anterior registrada por el sensor.</li>
                    <li><strong>Diferencia:</strong> Indica el cambio de potencia entre ambas lecturas.</li>
                    <li><strong>Energía estimada:</strong> Representa la energía calculada a partir de las lecturas registradas.</li>
                    <li><strong>Demanda Máxima:</strong> Muestra el valor máximo de potencia detectado durante el periodo disponible.</li>
                </ul>
            `
        },

        costosMercado: {
            title: 'Costos del Mercado',
            content: `
                <p>Esta sección muestra un desglose de los costos utilizados para calcular el importe del recibo.</p>
                <ul>
                    <li><strong>Suministro:</strong> Cargo fijo utilizado dentro de la simulación.</li>
                    <li><strong>Distribución:</strong> Cargo calculado considerando la demanda máxima registrada.</li>
                    <li><strong>Transmisión:</strong> Cargo relacionado con la energía estimada.</li>
                    <li><strong>CENACE:</strong> Cargo calculado con base en la energía estimada.</li>
                    <li><strong>Generación:</strong> Representa el costo asociado a la energía estimada.</li>
                    <li><strong>Capacidad:</strong> Cargo calculado considerando la demanda máxima.</li>
                </ul>
            `
        },

        desglose: {
            title: 'Desglose del Importe',
            content: `
                <p>El importe final se obtiene a partir de los diferentes cargos calculados para la tarifa seleccionada.</p>
                <ul>
                    <li><strong>Cargo Fijo:</strong> Corresponde al costo de suministro.</li>
                    <li><strong>Energía:</strong> Integra los costos relacionados con la generación, transmisión y CENACE.</li>
                    <li><strong>Distribución:</strong> Se calcula utilizando la demanda máxima registrada.</li>
                    <li><strong>Capacidad:</strong> Se determina a partir de la demanda máxima.</li>
                    <li><strong>Subtotal:</strong> Es la suma de los cargos anteriores.</li>
                    <li><strong>IVA:</strong> Se calcula aplicando el 16% sobre el subtotal.</li>
                    <li><strong>DAP:</strong> Se calcula como un porcentaje adicional sobre el subtotal.</li>
                    <li><strong>Total a Pagar:</strong> Es la suma del subtotal, IVA y DAP.</li>
                </ul>
            `
        },

        // --- REVERSO ---
        comportamientoDemanda: {
            title: 'Historial de Demanda',
            content: `
                <p>Esta sección permite consultar el comportamiento de la potencia registrada por los sensores de PowerTech.</p>
                <ul>
                    <li><strong>Fecha:</strong> Indica el momento exacto en que se registró cada lectura.</li>
                    <li><strong>Demanda:</strong> Muestra la potencia registrada convertida de W a kW.</li>
                    <li><strong>Lecturas:</strong> Cada registro proviene directamente de la base de datos de PowerTech.</li>
                    <li><strong>Demanda Máxima:</strong> Corresponde al valor más alto registrado durante el periodo disponible.</li>
                </ul>
            `
        },

        consumoHistorico: {
            title: 'Comportamiento de Lecturas',
            content: `
                <p>La gráfica muestra las lecturas de potencia registradas por los sensores de PowerTech.</p>
                <ul>
                    <li><strong>Potencia medida:</strong> Cada barra representa una lectura registrada por un sensor.</li>
                    <li><strong>Conversión:</strong> Los valores almacenados en W se convierten a kW para facilitar su interpretación.</li>
                    <li><strong>Lecturas registradas:</strong> La cantidad de barras depende directamente de las lecturas disponibles en la base de datos.</li>
                    <li><strong>Actualización:</strong> Cuando se registran nuevas lecturas, la información de esta sección puede actualizarse automáticamente.</li>
                </ul>
            `
        }
    }

    const selectedData = computed(() => {
        return selectedSection.value ? infoData[selectedSection.value] : null
    })

    const selectSection = (sectionId) => {
        selectedSection.value = sectionId
    }
    </script>

    <style scoped>
    /* Estilos Generales */
    .recibo-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        font-family: 'Arial', sans-serif;
        color: #333;
    }

    .cfe-disclaimer {
        background-color: #e6f4ea;
        color: #00845a;
        padding: 12px;
        border-radius: 8px;
        border-left: 5px solid #00845a;
        margin-bottom: 20px;
        font-size: 0.95rem;
    }

    /* Controles de Header Modernizados */
    .header {
        margin-bottom: 25px;
        border-bottom: 2px solid #eee;
        padding-bottom: 15px;
    }

    .header-titles h1 {
        margin: 0;
        color: #00845a;
    }

    .subtitle {
        margin: 5px 0 15px 0;
        color: #666;
        font-size: 1.1rem;
    }

    .controls-wrapper {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 15px;
        background: #f8fafc;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
    }

    .toggle-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .toggle-label {
        font-weight: bold;
        color: #475569;
        font-size: 0.9rem;
    }

    .tab-btn {
        padding: 8px 16px;
        border: 1px solid #cbd5e1;
        background-color: #fff;
        cursor: pointer;
        border-radius: 6px;
        font-weight: bold;
        transition: all 0.2s;
        color: #475569;
    }

    .tab-btn:hover {
        background-color: #f1f5f9;
    }

    .tab-btn.active {
        background-color: #00845a;
        color: white;
        border-color: #00845a;
    }

    .main-content {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 30px;
        align-items: start;
    }

    .recibo-mockup {
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 15px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .clickable-section {
        border: 2px dashed transparent;
        padding: 15px;
        border-radius: 8px;
        background-color: #fafafa;
        cursor: pointer;
        transition: all 0.2s;
    }

    .clickable-section:hover {
        border-color: #4ade80;
        background-color: #f0fdf4;
    }

    .clickable-section.selected {
        border-color: #00845a;
        background-color: #e6f4ea;
        box-shadow: 0 0 0 2px rgba(0, 132, 90, 0.2);
    }

    .flex-row {
        display: flex;
        justify-content: space-between;
        gap: 20px;
    }

    .datos-carga {
        display: flex;
        align-items: center;
        gap: 18px;
        white-space: nowrap;
    }

    .text-center {
        text-align: center;
    }

    .items-center {
        align-items: center;
    }

    .justify-between {
        justify-content: space-between;
    }

    .justify-center {
        justify-content: center;
    }

    .w-50 {
        width: 50%;
    }

    .w-100 {
        width: 100%;
    }

    .mt-10 {
        margin-top: 10px;
    }

    .split-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }

    h2,
    h3 {
        margin-top: 0;
        color: #00845a;
    }

    .mock-text,
    .mock-line {
        font-size: 0.85rem;
        color: #555;
        margin: 4px 0;
    }

    .mock-line {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dotted #ccc;
    }

    .total-pagar {
        font-size: 0.9rem;
        font-weight: bold;
    }

    .total-pagar span {
        font-size: 1.8rem;
        color: #333;
    }

    .text-red {
        color: #dc2626;
        font-weight: bold;
    }

    .text-green {
        color: #16a34a;
        font-weight: bold;
    }

    .mock-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        margin-bottom: 10px;
    }

    .mock-table th {
        background-color: #00845a;
        color: white;
        padding: 6px;
        text-align: left;
    }

    .mock-table td {
        padding: 6px;
        border-bottom: 1px solid #eee;
    }

    .small-text {
        font-size: 0.75rem;
    }

    .highlight-row {
        background-color: #fef08a;
        font-weight: bold;
    }

    .metrics-bar {
        font-size: 0.85rem;
        font-weight: bold;
        background: #fee2e2;
        padding: 8px;
        border-radius: 4px;
        color: #991b1b;
    }

    .metrics-bar.bonus {
        background: #dcfce7;
        color: #166534;
    }

    /* Estilos de gráficas industriales */
    .chart-mockup {
        height: 120px;
        border-left: 1px solid #ccc;
        border-bottom: 1px solid #ccc;
        padding: 5px;
        display: flex;
        align-items: flex-end;
        position: relative;
    }

    .fp-chart {
        justify-content: center;
        overflow: visible;
    }

    .line-chart {
        width: 100%;
        height: 100%;
    }

    .chart-label {
        position: absolute;
        bottom: -20px;
        font-size: 0.65rem;
        color: #666;
    }

    .chart-mockup-bars {
        display: flex;
        justify-content: space-around;
        height: 140px;
        border-bottom: 2px solid #ccc;
        padding-top: 20px;
        align-items: flex-end;
    }

    .bar-group {
        display: flex;
        gap: 2px;
        align-items: flex-end;
        height: 100%;
        width: 25%;
    }

    .bar-group.single {
        justify-content: center;
        width: 20%;
    }

    .bar-group.single .bar {
        width: 70%;
        flex-grow: 0;
    }

    .bar-group .bar {
        flex-grow: 1;
    }

    .base {
        background-color: #3b82f6;
    }

    .int {
        background-color: #eab308;
    }

    .punta {
        background-color: #ef4444;
    }

    .legend {
        font-size: 0.8rem;
        font-weight: bold;
        gap: 15px;
    }

    .leg-item {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .box {
        width: 12px;
        height: 12px;
        display: inline-block;
        border-radius: 2px;
    }

    /* Panel de Información */
    .info-panel {
        position: sticky;
        top: 20px;
    }

    .info-card {
        background-color: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    .info-card h2 {
        border-bottom: 2px solid #00845a;
        padding-bottom: 10px;
        margin-bottom: 15px;
        color: #00845a;
    }

    .info-content :deep(ul) {
        padding-left: 20px;
        margin-bottom: 10px;
    }

    .info-content :deep(li) {
        margin-bottom: 12px;
        line-height: 1.5;
    }

    .empty-state {
        background-color: #f8fafc;
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 40px 20px;
        text-align: center;
        color: #64748b;
        font-size: 1.1rem;
    }

    @media (max-width: 900px) {
        .main-content {
            grid-template-columns: 1fr;
        }

        .info-panel {
            position: static;
        }

        .split-row {
            grid-template-columns: 1fr;
        }

        .flex-row {
            flex-direction: column;
        }

        .w-50 {
            width: 100%;
        }
    }
    

/* =========================================
   MODO PDF CUANDO EL RECIBO ESTA INTEGRADO
   ========================================= */
@media print {
    .recibo-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
    }

    .embedded-back,
    .cfe-disclaimer,
    .controls-wrapper,
    .info-panel,
    .header {
        display: none !important;
    }


    .main-content {
        display: block !important;
    }

    .recibo-wrapper {
        width: 100% !important;
    }

    /* v-show oculta una de las caras en pantalla; !important permite imprimir ambas */
    .recibo-mockup {
        display: flex !important;
        width: 100% !important;
        box-shadow: none !important;
        margin-bottom: 18px !important;
    }

    /* Evita dejar el título de Desglose al final de una página. */
    .desglose-print-block {
        break-before: page;
        page-break-before: always;
    }
}

</style>