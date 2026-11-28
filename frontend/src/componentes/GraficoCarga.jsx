import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { TIPOS } from '../utilidades/catalogo.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const TINTA = '#1B2A31';
const ALERTA = '#A8382D';

/** Dibuja la línea vertical del Umbral sobre las barras. */
const lineaUmbral = {
  id: 'lineaUmbral',
  afterDatasetsDraw(chart, _args, opciones) {
    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(opciones.valor);
    if (x < chartArea.left || x > chartArea.right) return;
    ctx.save();
    ctx.strokeStyle = ALERTA;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top - 6);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ALERTA;
    ctx.font = '700 13px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Umbral ${opciones.valor}`, x, chartArea.top - 12);
    ctx.restore();
  },
};

/** Carga por Desarrollador y Tipo de trabajo, en barras apiladas (RF-10). */
export default function GraficoCarga({ indicadores, umbral }) {
  if (indicadores.length === 0) {
    return <p className="vacio">No hay peticiones abiertas con estos filtros.</p>;
  }

  const datos = {
    labels: indicadores.map((i) => i.nombre),
    datasets: TIPOS.map((tipo) => ({
      label: tipo.nombre,
      data: indicadores.map((i) => i.porTipo[tipo.clave]),
      backgroundColor: tipo.color,
      borderColor: '#FFFFFF',
      borderWidth: { right: 2 },
      borderSkipped: false,
      barThickness: 22,
    })),
  };

  const maximo = Math.max(umbral.maxPeticiones + 2, ...indicadores.map((i) => i.peticionesAbiertas + 1));

  const opciones = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? false : { duration: 400 },
    layout: { padding: { top: 24 } },
    scales: {
      x: {
        stacked: true,
        max: maximo,
        ticks: { stepSize: 1, color: '#55666E', font: { size: 13 } },
        grid: { color: '#E4EAEC' },
        title: { display: true, text: 'Peticiones abiertas', color: '#55666E', font: { size: 13 } },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: {
          font: (ctx) => ({ size: 14, weight: indicadores[ctx.index]?.superaUmbral ? '700' : '400' }),
          color: (ctx) => (indicadores[ctx.index]?.superaUmbral ? ALERTA : TINTA),
        },
      },
    },
    plugins: {
      lineaUmbral: { valor: umbral.maxPeticiones },
      legend: {
        position: 'bottom',
        align: 'start',
        labels: { boxWidth: 12, boxHeight: 12, color: TINTA, font: { size: 13 }, padding: 16 },
      },
      tooltip: {
        callbacks: {
          footer: (items) => `Total: ${indicadores[items[0].dataIndex].peticionesAbiertas} abiertas`,
        },
      },
    },
  };

  const alto = Math.max(220, indicadores.length * 44 + 110);
  const descripcion = indicadores
    .map((i) => `${i.nombre}: ${i.peticionesAbiertas}${i.superaUmbral ? ', sobre el umbral' : ''}`)
    .join('; ');

  return (
    <div className="grafico" style={{ height: alto }}>
      <Bar data={datos} options={opciones} plugins={[lineaUmbral]} aria-label={`Peticiones abiertas por desarrollador. ${descripcion}`} role="img" />
    </div>
  );
}
