// Envía avisos al celular de los comercios (me gusta, comentarios, seguidores y novedades).
// Lo ejecuta GitHub cada 5 minutos. No necesita plan de pago de Firebase.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();
const SITE = 'https://anunciatecr.com/';
const VENTANA = 30 * 60 * 1000; // revisa 30 min hacia atrás y evita repetidos con la lista "enviados"

async function tokensDe(uids) {
  const out = [];
  const lista = [...new Set(uids)].filter(Boolean);
  for (let i = 0; i < lista.length; i += 10) {
    const q = await db.collection('pushTokens').where('uid', 'in', lista.slice(i, i + 10)).get();
    q.forEach(d => out.push(d.id));
  }
  return out;
}

async function enviar(uids, title, body) {
  const tokens = await tokensDe(uids);
  for (let i = 0; i < tokens.length; i += 500) {
    const lote = tokens.slice(i, i + 500);
    const r = await admin.messaging().sendEachForMulticast({
      tokens: lote,
      notification: { title, body },
      webpush: { fcmOptions: { link: SITE }, notification: { icon: SITE + 'icon-192.png' } }
    });
    await Promise.all(r.responses.map((x, k) =>
      (!x.success && /not-registered|invalid-registration/.test(x.error?.code || ''))
        ? db.collection('pushTokens').doc(lote[k]).delete() : null));
    console.log(`Enviados ${r.successCount} de ${lote.length}: ${title}`);
  }
}

(async () => {
  const ahora = Date.now();
  const stRef = db.doc('config/pushState');
  const st = (await stRef.get()).data() || {};
  const desde = (st.lastTs || ahora - 10 * 60 * 1000) - VENTANA;
  const yaEnviados = new Set(st.sent || []);
  const nuevos = [];

  // 1) Interacciones: me gusta, comentarios, seguidores
  const ev = await db.collection('events').where('ts', '>', desde).get();
  const porNegocio = {};
  ev.forEach(d => {
    const e = d.data();
    if (!['lk', 'cm', 'fw'].includes(e.type) || yaEnviados.has(d.id)) return;
    nuevos.push(d.id);
    (porNegocio[e.bid] = porNegocio[e.bid] || []).push(e);
  });
  for (const [bid, lista] of Object.entries(porNegocio)) {
    const b = await db.doc('businesses/' + bid).get();
    const owner = b.exists && b.data().owner;
    if (!owner) continue;
    let title, body;
    if (lista.length === 1) {
      const e = lista[0], quien = e.name || 'Alguien';
      [title, body] = {
        lk: ['Nuevo me gusta', `A ${quien} le gustó tu publicación`],
        cm: ['Nuevo comentario', `${quien} comentó: ${(e.text || '').slice(0, 80)}`],
        fw: ['Nuevo seguidor', `${quien} empezó a seguir tu negocio`]
      }[e.type];
    } else {
      title = 'Novedades en tu negocio';
      body = `Tienes ${lista.length} interacciones nuevas. Entra a ver.`;
    }
    await enviar([owner], title, body);
  }

  // 2) Novedades del administrador (van a todos los comercios aprobados)
  const an = await db.collection('announcements').where('ts', '>', desde).get();
  for (const d of an.docs) {
    if (yaEnviados.has('a' + d.id)) continue;
    nuevos.push('a' + d.id);
    const a = d.data();
    const negs = await db.collection('businesses').where('status', '==', 'approved').get();
    await enviar(negs.docs.map(x => x.data().owner), a.t || 'Novedad de AnunciateCR', (a.d || '').slice(0, 120));
  }

  await stRef.set({ lastTs: ahora, sent: [...yaEnviados, ...nuevos].slice(-500) });
  console.log('Listo. Interacciones y novedades nuevas:', nuevos.length);
})().catch(e => { console.error(e); process.exit(1); });
