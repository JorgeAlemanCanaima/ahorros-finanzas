"use client";
import { useState, useEffect } from "react";
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
  // Aquí se implementará la lógica en los siguientes pasos
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados para filtros
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMes, setFiltroMes] = useState("");

  // Filtrar movimientos según los filtros
  const movimientosFiltrados = movimientos.filter((m) => {
    const coincideTipo = filtroTipo ? m.tipo === filtroTipo : true;
    const coincideMes = filtroMes
      ? m.fecha && m.fecha.startsWith(filtroMes)
      : true;
    return coincideTipo && coincideMes;
  });

  // Calcular saldo total
  const saldoTotal = movimientosFiltrados.reduce((acc, m) => {
    if (m.tipo === "ingreso" || m.tipo === "viatico") return acc + Number(m.monto);
    else return acc - Number(m.monto);
  }, 0);

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
      
      {/* Filtros */}
      <section className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <select className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">🔍 Todos los tipos</option>
          <option value="ingreso">💰 Ingreso</option>
          <option value="egreso">💸 Egreso</option>
          <option value="viatico">🚗 Viático</option>
        </select>
        <input className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} />
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
