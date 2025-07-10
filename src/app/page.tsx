"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

// Definir tipos para los movimientos
interface Movimiento {
  id: string;
  tipo: 'ingreso' | 'egreso' | 'viatico';
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  metodo_pago?: string;
  banco?: string;
  creado_en?: string;
}

export default function Home() {
  // Estados para el formulario
  const [tipo, setTipo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fecha, setFecha] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [banco, setBanco] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  // Estados para formulario, filtros, movimientos, saldo y loading
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados para filtros
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMes, setFiltroMes] = useState("");

  // Estados para presupuestos y metas
  const [presupuestos, setPresupuestos] = useState<Record<string, number>>({});
  const [metas, setMetas] = useState<{objetivo: number, actual: number, descripcion: string}>({objetivo: 0, actual: 0, descripcion: ""});
  const [mostrarPresupuestos, setMostrarPresupuestos] = useState(false);
  const [mostrarMetas, setMostrarMetas] = useState(false);
  const [nuevoPresupuesto, setNuevoPresupuesto] = useState({categoria: "", monto: ""});

  // Estados para búsqueda y filtros avanzados
  const [busqueda, setBusqueda] = useState("");
  const [filtroMontoMin, setFiltroMontoMin] = useState("");
  const [filtroMontoMax, setFiltroMontoMax] = useState("");
  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);

  // Estados para acciones rápidas
  const [mostrarAccionesRapidas, setMostrarAccionesRapidas] = useState(false);
  const montosComunes = [100, 500, 1000, 2000, 5000, 10000];

  // Estados para recordatorios
  const [recordatorios, setRecordatorios] = useState<Array<{
    id: string;
    titulo: string;
    monto: number;
    fecha: string;
    categoria: string;
    activo: boolean;
  }>>([]);
  const [mostrarRecordatorios, setMostrarRecordatorios] = useState(false);
  const [nuevoRecordatorio, setNuevoRecordatorio] = useState({
    titulo: "",
    monto: "",
    fecha: "",
    categoria: ""
  });

  // Categorías inteligentes con sugerencias
  const categoriasSugeridas: Record<string, string[]> = {
    "Comida": ["restaurante", "supermercado", "café", "almuerzo", "cena", "desayuno", "pizza", "hamburguesa"],
    "Transporte": ["uber", "taxi", "gasolina", "bus", "metro", "parking", "estacionamiento"],
    "Entretenimiento": ["cine", "película", "netflix", "spotify", "juego", "concierto", "teatro"],
    "Salud": ["farmacia", "médico", "dentista", "gimnasio", "vitaminas", "consulta"],
    "Educación": ["libro", "curso", "universidad", "taller", "seminario", "material"],
    "Servicios": ["luz", "agua", "internet", "teléfono", "cable", "wifi"],
    "Ropa": ["zapatos", "camisa", "pantalón", "vestido", "ropa", "accesorios"],
    "Tecnología": ["celular", "laptop", "tablet", "cargador", "cable", "software"]
  };

  // Función para sugerir categoría basada en descripción
  const sugerirCategoria = useCallback((descripcion: string): string => {
    const descLower = descripcion.toLowerCase();
    for (const [categoria, palabras] of Object.entries(categoriasSugeridas)) {
      if (palabras.some(palabra => descLower.includes(palabra))) {
        return categoria;
      }
    }
    return "";
  }, [categoriasSugeridas]);

  // Función para agregar presupuesto
  const agregarPresupuesto = () => {
    if (nuevoPresupuesto.categoria && nuevoPresupuesto.monto) {
      setPresupuestos(prev => ({
        ...prev,
        [nuevoPresupuesto.categoria]: Number(nuevoPresupuesto.monto)
      }));
      setNuevoPresupuesto({categoria: "", monto: ""});
    }
  };

  // Calcular progreso de presupuestos
  const progresoPresupuestos = Object.entries(presupuestos).map(([cat, limite]) => {
    const gastado = movimientosFiltrados
      .filter(m => m.categoria === cat && m.tipo === 'egreso')
      .reduce((acc, m) => acc + Number(m.monto), 0);
    const porcentaje = (gastado / limite) * 100;
    return { categoria: cat, gastado, limite, porcentaje, alerta: porcentaje > 90 };
  });

  // Calcular progreso de meta
  const progresoMeta = metas.objetivo > 0 ? (metas.actual / metas.objetivo) * 100 : 0;

  // Filtrar movimientos con búsqueda avanzada
  const movimientosFiltrados = movimientos.filter((m) => {
    // Filtro por tipo
    const coincideTipo = filtroTipo ? m.tipo === filtroTipo : true;
    
    // Filtro por mes
    const coincideMes = filtroMes
      ? m.fecha && m.fecha.startsWith(filtroMes)
      : true;
    
    // Filtro por búsqueda en descripción
    const coincideBusqueda = busqueda 
      ? m.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.categoria.toLowerCase().includes(busqueda.toLowerCase())
      : true;
    
    // Filtro por rango de montos
    const monto = Number(m.monto);
    const coincideMontoMin = filtroMontoMin ? monto >= Number(filtroMontoMin) : true;
    const coincideMontoMax = filtroMontoMax ? monto <= Number(filtroMontoMax) : true;
    
    // Filtro por rango de fechas
    const coincideFechaInicio = filtroFechaInicio ? m.fecha >= filtroFechaInicio : true;
    const coincideFechaFin = filtroFechaFin ? m.fecha <= filtroFechaFin : true;
    
    return coincideTipo && coincideMes && coincideBusqueda && coincideMontoMin && coincideMontoMax && coincideFechaInicio && coincideFechaFin;
  });

  // Calcular saldo total
  const saldoTotal = movimientosFiltrados.reduce((acc, m) => {
    if (m.tipo === "ingreso" || m.tipo === "viatico") return acc + Number(m.monto);
    else return acc - Number(m.monto);
  }, 0);

  // Función para actualizar meta
  const actualizarMeta = useCallback(() => {
    setMetas(prev => ({...prev, actual: saldoTotal}));
  }, [saldoTotal]);

  // Conversión a dólares (ejemplo: 1 USD = 36.5 C$)
  const tasaDolar = 36.5;
  const saldoUSD = saldoTotal / tasaDolar;

  // Datos para la gráfica por categoría
  const resumenPorCategoria: Record<string, number> = {};
  movimientosFiltrados.forEach((m) => {
    if (!resumenPorCategoria[m.categoria]) resumenPorCategoria[m.categoria] = 0;
    resumenPorCategoria[m.categoria] += Number(m.monto) * ((m.tipo === "ingreso" || m.tipo === "viatico") ? 1 : -1);
  });
  const chartData = {
    labels: Object.keys(resumenPorCategoria),
    datasets: [
      {
        label: "Saldo por categoría",
        data: Object.values(resumenPorCategoria),
        backgroundColor: "#2563eb",
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  // Métricas avanzadas
  const totalIngresos = movimientosFiltrados.filter(m => m.tipo === 'ingreso' || m.tipo === 'viatico').reduce((acc, m) => acc + Number(m.monto), 0);
  const totalEgresos = movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + Number(m.monto), 0);
  const promedioGastos = movimientosFiltrados.filter(m => m.tipo === 'egreso').length > 0 
    ? movimientosFiltrados.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + Number(m.monto), 0) / movimientosFiltrados.filter(m => m.tipo === 'egreso').length 
    : 0;

  // Categoría con mayor gasto
  const gastosPorCategoria: Record<string, number> = {};
  movimientosFiltrados.filter(m => m.tipo === 'egreso').forEach(m => {
    if (!gastosPorCategoria[m.categoria]) gastosPorCategoria[m.categoria] = 0;
    gastosPorCategoria[m.categoria] += Number(m.monto);
  });
  const categoriaMayorGasto = Object.keys(gastosPorCategoria).length > 0 
    ? Object.entries(gastosPorCategoria).reduce((a, b) => gastosPorCategoria[a[0]] > gastosPorCategoria[b[0]] ? a : b)[0]
    : 'N/A';

  // Datos para gráfica de evolución temporal (últimos 7 días)
  const ultimos7Dias = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const datosEvolucion = ultimos7Dias.map(fecha => {
    const movimientosDelDia = movimientosFiltrados.filter(m => m.fecha === fecha);
    return movimientosDelDia.reduce((acc, m) => {
      if (m.tipo === 'ingreso' || m.tipo === 'viatico') return acc + Number(m.monto);
      else return acc - Number(m.monto);
    }, 0);
  });

  const chartDataEvolucion = {
    labels: ultimos7Dias.map(f => new Date(f).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})),
    datasets: [{
      label: 'Saldo diario',
      data: datosEvolucion,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  // Datos para gráfica circular por categorías
  const datosCircular = {
    labels: Object.keys(resumenPorCategoria),
    datasets: [{
      data: Object.values(resumenPorCategoria),
      backgroundColor: [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16'
      ],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  const chartOptionsEvolucion = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: { 
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.1)' }
      },
      x: { 
        grid: { color: 'rgba(0,0,0,0.1)' }
      }
    }
  };

  const chartOptionsCircular = {
    responsive: true,
    plugins: {
      legend: { 
        position: 'bottom' as const,
        labels: { padding: 20 }
      },
      title: { display: false },
    }
  };

  useEffect(() => {
    const fetchMovimientos = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("movimientos")
        .select("*")
        .order("fecha", { ascending: false });
      if (!error && data) setMovimientos(data);
      setLoading(false);
    };
    fetchMovimientos();
  }, []);

  // Función para agregar movimiento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm("");
    if (!tipo || !descripcion || !monto || !categoria || !fecha || !metodoPago || (metodoPago === "tarjeta" && !banco)) {
      setErrorForm("Todos los campos son obligatorios");
      return;
    }
    setFormLoading(true);
    const { error } = await supabase.from("movimientos").insert([
      {
        tipo,
        descripcion,
        monto: Number(monto),
        categoria,
        fecha,
        metodo_pago: metodoPago,
        banco: metodoPago === "tarjeta" ? banco : null,
      },
    ]);
    setFormLoading(false);
    if (error) {
      setErrorForm("Error al guardar. Intenta de nuevo.");
      return;
    }
    // Limpiar formulario y refrescar lista
    setTipo("");
    setDescripcion("");
    setMonto("");
    setCategoria("");
    setFecha("");
    setMetodoPago("");
    setBanco("");
    // Refrescar movimientos
    setLoading(true);
    const { data } = await supabase
      .from("movimientos")
      .select("*")
      .order("fecha", { ascending: false });
    setMovimientos(data || []);
    setLoading(false);
  };

  // Función para agregar recordatorio
  const agregarRecordatorio = () => {
    if (nuevoRecordatorio.titulo && nuevoRecordatorio.monto && nuevoRecordatorio.fecha) {
      const recordatorio = {
        id: Date.now().toString(),
        titulo: nuevoRecordatorio.titulo,
        monto: Number(nuevoRecordatorio.monto),
        fecha: nuevoRecordatorio.fecha,
        categoria: nuevoRecordatorio.categoria,
        activo: true
      };
      setRecordatorios(prev => [...prev, recordatorio]);
      setNuevoRecordatorio({titulo: "", monto: "", fecha: "", categoria: ""});
    }
  };

  // Función para usar monto común
  const usarMontoComun = (monto: number) => {
    setMonto(monto.toString());
  };

  // Función para limpiar filtros
  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroTipo("");
    setFiltroMes("");
    setFiltroMontoMin("");
    setFiltroMontoMax("");
    setFiltroFechaInicio("");
    setFiltroFechaFin("");
  };

  // Auto-sugerir categoría cuando cambie la descripción
  useEffect(() => {
    if (descripcion && !categoria) {
      const sugerencia = sugerirCategoria(descripcion);
      if (sugerencia) {
        setCategoria(sugerencia);
      }
    }
  }, [descripcion, categoria, sugerirCategoria]);

  // Actualizar meta automáticamente
  useEffect(() => {
    actualizarMeta();
  }, [saldoTotal, actualizarMeta]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-2 sm:p-4 flex flex-col gap-4 sm:gap-6 max-w-4xl mx-auto">
      <div className="text-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          💰 Control de Finanzas Personales
        </h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm">Gestiona tus ingresos, gastos y viáticos de manera inteligente</p>
      </div>
      
      {/* Formulario de registro */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-2">
        <h2 className="font-bold mb-4 text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
          📝 Registrar Movimiento
        </h2>
        {/* Aquí irá el formulario */}
        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          {/* Campos: tipo, descripción, monto, categoría, fecha, método de pago, banco */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">🎯 Tipo de movimiento</option>
              <option value="ingreso">💰 Ingreso</option>
              <option value="egreso">💸 Egreso</option>
              <option value="viatico">🚗 Viático</option>
            </select>
            <input className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" type="text" placeholder="📄 Descripción" required value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" type="number" placeholder="💵 Monto" required min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} />
            <input className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" type="text" placeholder="🏷️ Categoría" required value={categoria} onChange={e => setCategoria(e.target.value)} />
            <input className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" type="date" required value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
              <option value="">💳 Método de pago</option>
              <option value="efectivo">💵 Efectivo</option>
              <option value="tarjeta">💳 Tarjeta</option>
            </select>
            {metodoPago === "tarjeta" && (
              <select className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" required value={banco} onChange={e => setBanco(e.target.value)}>
                <option value="">🏦 Banco</option>
                <option value="bac">🏦 BAC</option>
                <option value="banpro">🏦 Banpro</option>
              </select>
            )}
          </div>
          {errorForm && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{errorForm}</div>}
          <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg p-3 mt-2 font-semibold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none text-sm" type="submit" disabled={formLoading}>
            {formLoading ? "⏳ Guardando..." : "✅ Agregar Movimiento"}
          </button>
        </form>
      </section>

      {/* Búsqueda y Filtros Avanzados */}
      <section className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-3">
          {/* Barra de búsqueda */}
          <div className="flex gap-2">
            <input 
              className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
              placeholder="🔍 Buscar por descripción o categoría..." 
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <button 
              onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm transition"
            >
              {mostrarFiltrosAvanzados ? "✕" : "⚙️"}
            </button>
            <button 
              onClick={limpiarFiltros}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition"
            >
              🗑️ Limpiar
            </button>
          </div>

          {/* Filtros básicos */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">🔍 Todos los tipos</option>
              <option value="ingreso">💰 Ingreso</option>
              <option value="egreso">💸 Egreso</option>
              <option value="viatico">🚗 Viático</option>
            </select>
            <input className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
          </div>

          {/* Filtros avanzados */}
          {mostrarFiltrosAvanzados && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">Filtros Avanzados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input 
                  className="p-2 rounded-lg border text-sm" 
                  type="number" 
                  placeholder="💰 Monto mínimo" 
                  value={filtroMontoMin}
                  onChange={e => setFiltroMontoMin(e.target.value)}
                />
                <input 
                  className="p-2 rounded-lg border text-sm" 
                  type="number" 
                  placeholder="💰 Monto máximo" 
                  value={filtroMontoMax}
                  onChange={e => setFiltroMontoMax(e.target.value)}
                />
                <input 
                  className="p-2 rounded-lg border text-sm" 
                  type="date" 
                  placeholder="📅 Desde" 
                  value={filtroFechaInicio}
                  onChange={e => setFiltroFechaInicio(e.target.value)}
                />
                <input 
                  className="p-2 rounded-lg border text-sm" 
                  type="date" 
                  placeholder="📅 Hasta" 
                  value={filtroFechaFin}
                  onChange={e => setFiltroFechaFin(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Acciones Rápidas */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
            ⚡ Acciones Rápidas
          </h2>
          <button 
            onClick={() => setMostrarAccionesRapidas(!mostrarAccionesRapidas)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-lg text-sm transition"
          >
            {mostrarAccionesRapidas ? "✕ Cerrar" : "➕ Mostrar"}
          </button>
        </div>

        {mostrarAccionesRapidas && (
          <div className="space-y-4">
            {/* Montos comunes */}
            <div>
              <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-200">💵 Montos Comunes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {montosComunes.map((monto) => (
                  <button
                    key={monto}
                    onClick={() => usarMontoComun(monto)}
                    className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 p-2 rounded-lg text-sm font-medium transition"
                  >
                    C${monto.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Plantillas de movimientos frecuentes */}
            <div>
              <h3 className="font-semibold mb-2 text-gray-700 dark:text-gray-200">📋 Plantillas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setTipo("egreso");
                    setDescripcion("Almuerzo");
                    setCategoria("Comida");
                    setMetodoPago("efectivo");
                  }}
                  className="bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-800 dark:text-green-300 p-3 rounded-lg text-sm transition text-left"
                >
                  🍽️ Almuerzo (Comida)
                </button>
                <button
                  onClick={() => {
                    setTipo("egreso");
                    setDescripcion("Transporte");
                    setCategoria("Transporte");
                    setMetodoPago("efectivo");
                  }}
                  className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm transition text-left"
                >
                  🚗 Transporte
                </button>
                <button
                  onClick={() => {
                    setTipo("ingreso");
                    setDescripcion("Salario");
                    setCategoria("Trabajo");
                    setMetodoPago("tarjeta");
                  }}
                  className="bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-300 p-3 rounded-lg text-sm transition text-left"
                >
                  💰 Salario (Trabajo)
                </button>
                <button
                  onClick={() => {
                    setTipo("egreso");
                    setDescripcion("Servicios");
                    setCategoria("Servicios");
                    setMetodoPago("tarjeta");
                  }}
                  className="bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-800 dark:text-red-300 p-3 rounded-lg text-sm transition text-left"
                >
                  ⚡ Servicios
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recordatorios */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
            ⏰ Recordatorios
          </h2>
          <button 
            onClick={() => setMostrarRecordatorios(!mostrarRecordatorios)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded-lg text-sm transition"
          >
            {mostrarRecordatorios ? "✕ Cerrar" : "➕ Agregar"}
          </button>
        </div>

        {mostrarRecordatorios && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input 
                className="p-2 rounded-lg border text-sm" 
                placeholder="📝 Título del recordatorio" 
                value={nuevoRecordatorio.titulo}
                onChange={e => setNuevoRecordatorio(prev => ({...prev, titulo: e.target.value}))}
              />
              <input 
                className="p-2 rounded-lg border text-sm" 
                type="number" 
                placeholder="💵 Monto" 
                value={nuevoRecordatorio.monto}
                onChange={e => setNuevoRecordatorio(prev => ({...prev, monto: e.target.value}))}
              />
              <input 
                className="p-2 rounded-lg border text-sm" 
                type="date" 
                placeholder="📅 Fecha" 
                value={nuevoRecordatorio.fecha}
                onChange={e => setNuevoRecordatorio(prev => ({...prev, fecha: e.target.value}))}
              />
              <input 
                className="p-2 rounded-lg border text-sm" 
                placeholder="🏷️ Categoría" 
                value={nuevoRecordatorio.categoria}
                onChange={e => setNuevoRecordatorio(prev => ({...prev, categoria: e.target.value}))}
              />
            </div>
            <button 
              onClick={agregarRecordatorio}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm transition mt-3"
            >
              ✅ Agregar Recordatorio
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recordatorios.filter(r => r.activo).map((recordatorio) => (
            <div key={recordatorio.id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">{recordatorio.titulo}</h3>
                <button 
                  onClick={() => setRecordatorios(prev => prev.map(r => r.id === recordatorio.id ? {...r, activo: false} : r))}
                  className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
                >
                  ✕
                </button>
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <div>💵 C${recordatorio.monto.toFixed(2)}</div>
                <div>📅 {recordatorio.fecha}</div>
                <div>🏷️ {recordatorio.categoria}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* Saldo total */}
      <section className="bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 rounded-xl shadow-lg p-6 text-white text-center">
        <span className="text-green-100 dark:text-green-200 text-sm font-medium">💰 Saldo Total</span>
        <div className="text-3xl sm:text-4xl font-bold mt-1">C${saldoTotal.toFixed(2)}</div>
        <span className="text-green-100 dark:text-green-200 text-xs sm:text-sm mt-2 block">USD ${saldoUSD.toFixed(2)} (Tasa: 1 USD = {tasaDolar} C$)</span>
      </section>

      {/* Métricas avanzadas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl mb-2">💰</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">C${totalIngresos.toFixed(2)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-300">Total Ingresos</div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl mb-2">💸</div>
          <div className="text-lg font-bold text-red-600 dark:text-red-400">C${totalEgresos.toFixed(2)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-300">Total Egresos</div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">C${promedioGastos.toFixed(2)}</div>
          <div className="text-xs text-gray-600 dark:text-gray-300">Promedio por Gasto</div>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{categoriaMayorGasto}</div>
          <div className="text-xs text-gray-600 dark:text-gray-300">Mayor Gasto</div>
        </div>
      </section>

      {/* Presupuestos */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
            🎯 Presupuestos por Categoría
          </h2>
          <button 
            onClick={() => setMostrarPresupuestos(!mostrarPresupuestos)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition"
          >
            {mostrarPresupuestos ? "✕ Cerrar" : "➕ Agregar"}
          </button>
        </div>

        {mostrarPresupuestos && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                className="flex-1 p-2 rounded-lg border text-sm" 
                placeholder="🏷️ Categoría" 
                value={nuevoPresupuesto.categoria}
                onChange={e => setNuevoPresupuesto(prev => ({...prev, categoria: e.target.value}))}
              />
              <input 
                className="flex-1 p-2 rounded-lg border text-sm" 
                type="number" 
                placeholder="💵 Límite mensual" 
                value={nuevoPresupuesto.monto}
                onChange={e => setNuevoPresupuesto(prev => ({...prev, monto: e.target.value}))}
              />
              <button 
                onClick={agregarPresupuesto}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition"
              >
                ✅ Agregar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {progresoPresupuestos.map((presupuesto) => (
            <div key={presupuesto.categoria} className={`bg-white/60 dark:bg-gray-700/60 rounded-lg p-4 border-2 ${
              presupuesto.alerta ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm">{presupuesto.categoria}</span>
                {presupuesto.alerta && <span className="text-red-500 text-xs">⚠️ Alerta</span>}
              </div>
              <div className="text-lg font-bold mb-2">
                C${presupuesto.gastado.toFixed(2)} / C${presupuesto.limite.toFixed(2)}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    presupuesto.alerta ? 'bg-red-500' : presupuesto.porcentaje > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{width: `${Math.min(presupuesto.porcentaje, 100)}%`}}
                ></div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {presupuesto.porcentaje.toFixed(1)}% usado
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Metas de Ahorro */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
            🎯 Meta de Ahorro
          </h2>
          <button 
            onClick={() => setMostrarMetas(!mostrarMetas)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm transition"
          >
            {mostrarMetas ? "✕ Cerrar" : "➕ Configurar"}
          </button>
        </div>

        {mostrarMetas && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                className="flex-1 p-2 rounded-lg border text-sm" 
                placeholder="🎯 Descripción de la meta" 
                value={metas.descripcion}
                onChange={e => setMetas(prev => ({...prev, descripcion: e.target.value}))}
              />
              <input 
                className="flex-1 p-2 rounded-lg border text-sm" 
                type="number" 
                placeholder="💵 Objetivo de ahorro" 
                value={metas.objetivo || ""}
                onChange={e => setMetas(prev => ({...prev, objetivo: Number(e.target.value)}))}
              />
            </div>
          </div>
        )}

        {metas.objetivo > 0 && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 text-white text-center">
            <div className="text-lg font-semibold mb-2">{metas.descripcion || "Meta de Ahorro"}</div>
            <div className="text-3xl font-bold mb-2">C${metas.actual.toFixed(2)} / C${metas.objetivo.toFixed(2)}</div>
            <div className="w-full bg-white/20 rounded-full h-3 mb-2">
              <div 
                className="bg-white h-3 rounded-full transition-all"
                style={{width: `${Math.min(progresoMeta, 100)}%`}}
              ></div>
            </div>
            <div className="text-sm">
              {progresoMeta.toFixed(1)}% completado
              {progresoMeta >= 100 && <span className="ml-2">🎉 ¡Meta alcanzada!</span>}
            </div>
          </div>
        )}
      </section>
      
      {/* Gráficas de análisis */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfica de evolución temporal */}
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="font-bold mb-4 text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
            📈 Evolución del Saldo (7 días)
          </h2>
          <div className="w-full h-64">
            {datosEvolucion.some(d => d !== 0) ? (
              <Line data={chartDataEvolucion} options={chartOptionsEvolucion} />
            ) : (
              <div className="text-center text-gray-400 h-full flex items-center justify-center">
                <div>
                  <div className="text-4xl mb-2">📈</div>
                  <div>Sin datos de evolución</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gráfica circular por categorías */}
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h2 className="font-bold mb-4 text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
            🥧 Distribución por Categorías
          </h2>
          <div className="w-full h-64">
            {Object.keys(resumenPorCategoria).length > 0 ? (
              <Doughnut data={datosCircular} options={chartOptionsCircular} />
            ) : (
              <div className="text-center text-gray-400 h-full flex items-center justify-center">
                <div>
                  <div className="text-4xl mb-2">🥧</div>
                  <div>Sin datos para mostrar</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gráfica de barras original */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h2 className="font-bold mb-4 text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
          📊 Resumen por Categoría
        </h2>
        <div className="w-full h-64">
          {Object.keys(resumenPorCategoria).length > 0 ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <div className="text-center text-gray-400 h-full flex items-center justify-center">
              <div>
                <div className="text-4xl mb-2">📊</div>
                <div>Sin datos para mostrar</div>
              </div>
            </div>
          )}
        </div>
      </section>
      
      {/* Tabla de movimientos */}
      <section className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-x-auto">
        <h2 className="font-bold mb-4 text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2">
          📊 Historial de Movimientos
        </h2>
        <table className="min-w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-gray-100/80 dark:bg-gray-700/80">
              <th className="p-2 text-left font-semibold">📅 Fecha</th>
              <th className="p-2 text-left font-semibold">🎯 Tipo</th>
              <th className="p-2 text-left font-semibold">📄 Descripción</th>
              <th className="p-2 text-left font-semibold hidden sm:table-cell">🏷️ Categoría</th>
              <th className="p-2 text-right font-semibold">💵 Monto</th>
              <th className="p-2 text-left font-semibold hidden sm:table-cell">💳 Método</th>
              <th className="p-2 text-left font-semibold hidden sm:table-cell">🏦 Banco</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan={7} className="text-center p-4 text-gray-500">⏳ Cargando movimientos...</td></tr>
            ) : movimientosFiltrados.length === 0 ? (
              <tr><td colSpan={7} className="text-center p-4 text-gray-500">📭 No hay movimientos registrados</td></tr>
            ) : (
              movimientosFiltrados.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <td className="p-2">{m.fecha}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      m.tipo === 'ingreso' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      m.tipo === 'egreso' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {m.tipo === 'ingreso' ? '💰' : m.tipo === 'egreso' ? '💸' : '🚗'} {m.tipo}
                    </span>
                  </td>
                  <td className="p-2 font-medium">{m.descripcion}</td>
                  <td className="p-2 hidden sm:table-cell">{m.categoria}</td>
                  <td className={`p-2 text-right font-bold ${
                    m.tipo === 'ingreso' || m.tipo === 'viatico' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {m.tipo === 'ingreso' || m.tipo === 'viatico' ? '+' : '-'}C${Number(m.monto).toFixed(2)}
                  </td>
                  <td className="p-2 hidden sm:table-cell capitalize">{m.metodo_pago || "-"}</td>
                  <td className="p-2 hidden sm:table-cell capitalize">{m.banco || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
