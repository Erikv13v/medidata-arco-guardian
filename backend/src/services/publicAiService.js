const OpenAI = require('openai');

const MODELO = process.env.OPENAI_MODEL || 'gpt-5-mini';
const MAX_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS || 250);

const BASE_LEGAL = `
Base legal Ecuador - LOPDP:
- Art. 13: Derecho de acceso.
- Art. 14: Derecho de rectificación y actualización.
- Art. 15: Derecho de eliminación.
- Art. 16: Derecho de oposición.
- Art. 17: Derecho de portabilidad.
- Art. 19: Derecho de suspensión del tratamiento.
- Art. 25: Los datos de salud son categoría especial.
- Plazo general: 15 días desde la recepción completa de la solicitud.
`;

function textoSeguro(valor, limite = 700) {
  return String(valor || '').trim().slice(0, limite);
}

function detectarDerecho(derecho, mensaje) {
  const texto = `${derecho || ''} ${mensaje || ''}`.toLowerCase();

  if (texto.includes('acceso') || texto.includes('ver mis datos')) return 'Acceso';
  if (texto.includes('rectificación') || texto.includes('rectificacion') || texto.includes('corregir') || texto.includes('actualizar')) return 'Rectificación';
  if (texto.includes('eliminación') || texto.includes('eliminacion') || texto.includes('borrar') || texto.includes('suprimir')) return 'Eliminación';
  if (texto.includes('oposición') || texto.includes('oposicion') || texto.includes('oponer')) return 'Oposición';
  if (texto.includes('portabilidad') || texto.includes('transferir')) return 'Portabilidad';
  if (texto.includes('suspensión') || texto.includes('suspension') || texto.includes('limitación') || texto.includes('limitacion')) return 'Suspensión';
  if (texto.includes('filtración') || texto.includes('filtracion') || texto.includes('amenaza') || texto.includes('extorsión') || texto.includes('extorsion') || texto.includes('incidente')) return 'Incidente';

  return textoSeguro(derecho) || 'Orientación general';
}

function esPreguntaPermitida(mensaje, derecho) {
  const texto = `${derecho || ''} ${mensaje || ''}`.toLowerCase();

  const temasPermitidos = [
    'medidata', 'arco', 'pal', 'datos personales', 'dato personal',
    'solicitud', 'solicitudes', 'estado', 'ticket', 'paciente',
    'historia clínica', 'historia clinica', 'salud', 'clínica', 'clinica',
    'acceso', 'rectificación', 'rectificacion', 'eliminación', 'eliminacion',
    'oposición', 'oposicion', 'portabilidad', 'suspensión', 'suspension',
    'limitación', 'limitacion', 'incidente', 'filtración', 'filtracion',
    'amenaza', 'extorsión', 'extorsion', 'ley', 'lopdp', 'plazo',
    'emergencia', 'reporte', 'alerta'
  ];

  const temasBloqueados = [
    'código', 'codigo', 'programa', 'programar', 'javascript', 'python',
    'java', 'html', 'css', 'sql', 'tarea', 'deber', 'ensayo',
    'trabajo de clase', 'hazme el trabajo', 'resuelve mi tarea',
    'hack', 'hackear', 'virus', 'malware', 'phishing',
    'contraseña de otra persona', 'robar', 'bypass'
  ];

  const bloqueado = temasBloqueados.some(p => texto.includes(p));
  const permitido = temasPermitidos.some(p => texto.includes(p));

  if (bloqueado && !permitido) return false;
  if (!permitido && texto.length > 25) return false;

  return true;
}

function respuestaFueraContexto() {
  return 'Puedo ayudarte únicamente con temas de MediData, solicitudes ARCO+ PAL, datos personales, alertas de seguridad, estado de tickets y orientación básica sobre protección de datos. Para otras tareas, debes usar otro canal.';
}

function respuestaFallback(mensaje, derecho) {
  const derechoDetectado = detectarDerecho(derecho, mensaje);

  const respuestas = {
    Acceso: 'Según el Art. 13 de la LOPDP, puedes solicitar acceso para conocer qué datos personales tuyos están siendo tratados. El plazo general de atención es de 15 días desde la recepción completa de la solicitud.',
    Rectificación: 'Según el Art. 14 de la LOPDP, puedes pedir rectificación o actualización cuando tus datos estén incorrectos, incompletos o desactualizados. Adjunta solo la información necesaria para corregirlos.',
    Eliminación: 'Según el Art. 15 de la LOPDP, puedes solicitar eliminación cuando corresponda la supresión de tus datos. El plazo general de atención es de 15 días desde que la solicitud esté completa.',
    Oposición: 'Según el Art. 16 de la LOPDP, puedes oponerte al tratamiento de tus datos cuando exista una razón válida relacionada con tu situación particular.',
    Portabilidad: 'Según el Art. 17 de la LOPDP, la portabilidad te permite pedir que tus datos sean entregados o transferidos en un formato utilizable cuando corresponda.',
    Suspensión: 'Según el Art. 19 de la LOPDP, puedes pedir suspensión o limitación del tratamiento cuando quieras restringir temporalmente el uso de tus datos.',
    Incidente: 'Si existe amenaza, filtración o extorsión con datos de salud, repórtalo como alerta de emergencia. MediData debe escalar el caso para revisión humana prioritaria.'
  };

  return respuestas[derechoDetectado] || 'Puedo orientarte sobre solicitudes ARCO+ PAL, datos personales, alertas de seguridad y estado de tickets dentro de MediData.';
}

function construirInstrucciones(derechoDetectado) {
  return `
Eres el agente IA público de MediData EC.
Solo respondes temas de MediData, ARCO+ PAL, datos personales, solicitudes, alertas, incidentes y LOPDP.
No generes código, tareas, ensayos, trabajos académicos, hacks ni respuestas fuera de MediData.
No pidas datos sensibles innecesarios.
Responde en español, máximo 5 líneas, claro, humano y profesional.
No des asesoría legal definitiva; entrega orientación general.
Si hay filtración, amenaza, extorsión o datos de salud, indica que debe escalarse a revisión humana prioritaria.

Contexto actual: ${derechoDetectado}

${BASE_LEGAL}
`;
}

async function responderIA({ mensaje, derecho }) {
  const pregunta = textoSeguro(mensaje);
  const derechoDetectado = detectarDerecho(derecho, pregunta);

  if (!pregunta) {
    return 'Escribe tu consulta sobre MediData, tus datos personales, una solicitud ARCO+ PAL o una alerta de seguridad.';
  }

  if (!esPreguntaPermitida(pregunta, derechoDetectado)) {
    return respuestaFueraContexto();
  }

  if (!process.env.OPENAI_API_KEY) {
    return respuestaFallback(pregunta, derechoDetectado);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: MODELO,
      instructions: construirInstrucciones(derechoDetectado),
      input: `Pregunta del usuario: ${pregunta}`,
      reasoning: { effort: 'minimal' },
      max_output_tokens: Math.max(MAX_TOKENS, 350),
      store: false,
    });

    const salida = String(response.output_text || '').trim();
    return salida || respuestaFallback(pregunta, derechoDetectado);
  } catch (error) {
    console.error('Error llamando IA pública:', error.message);
    return respuestaFallback(pregunta, derechoDetectado);
  }
}

async function resumirEmergenciaIA({ texto, nivelRiesgo, tipoCaso }) {
  const contenido = textoSeguro(texto, 1200);

  if (!contenido) {
    return 'Reporte de emergencia sin descripción suficiente. Requiere contacto humano para ampliar información.';
  }

  if (!process.env.OPENAI_API_KEY) {
    return `Resumen de emergencia: ${contenido.slice(0, 500)}`;
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.responses.create({
      model: MODELO,
      instructions: `
Eres el asistente interno de MediData para ordenar reportes de emergencia.
Convierte relatos alterados, rápidos o desordenados en un resumen profesional.
No inventes datos. No agregues diagnósticos. No ocultes amenazas.
Entrega máximo 6 líneas:
1. Resumen del incidente.
2. Datos o sistemas posiblemente afectados.
3. Riesgo principal.
4. Acción sugerida para el equipo interno.
`,
      input: `Nivel declarado: ${nivelRiesgo || 'No indicado'}
Tipo de caso: ${tipoCaso || 'No indicado'}
Relato de la víctima: ${contenido}`,
      reasoning: { effort: 'minimal' },
      max_output_tokens: 300,
      store: false,
    });

    const salida = String(response.output_text || '').trim();
    return salida || `Resumen de emergencia: ${contenido.slice(0, 500)}`;
  } catch (error) {
    console.error('Error resumiendo emergencia IA:', error.message);
    return `Resumen de emergencia: ${contenido.slice(0, 500)}`;
  }
}

module.exports = {
  responderIA,
  resumirEmergenciaIA,
};
