"""Copia de seguridad de Firestore: guarda cada colección en un archivo JSON.
IMPORTANTE: este script NUNCA imprime el contenido de los datos, solo cuántos documentos hay
(los registros de GitHub son públicos). Los archivos se cifran después, en el flujo de trabajo.
"""
import os, sys, json, base64, datetime

SALIDA = os.environ.get('SALIDA', 'respaldo')
# Si un negocio-base queda en 0 documentos, algo anda mal: mejor fallar que guardar una copia vacía.
OBLIGATORIAS = ['businesses']

def limpiar(v):
    """Convierte tipos de Firestore (fechas, bytes, referencias) a algo que JSON entiende."""
    if isinstance(v, dict): return {k: limpiar(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [limpiar(x) for x in v]
    if isinstance(v, (datetime.datetime, datetime.date)): return {'__fecha__': v.isoformat()}
    if isinstance(v, (bytes, bytearray)): return {'__bytes__': base64.b64encode(bytes(v)).decode()}
    if hasattr(v, 'path') and hasattr(v, 'id'): return {'__ref__': v.path}
    if hasattr(v, 'latitude') and hasattr(v, 'longitude'): return {'__geo__': [v.latitude, v.longitude]}
    return v

def respaldar(db, salida=SALIDA):
    os.makedirs(salida, exist_ok=True)
    resumen = {}
    for col in db.collections():
        docs = {d.id: limpiar(d.to_dict()) for d in col.stream()}
        with open(os.path.join(salida, col.id + '.json'), 'w', encoding='utf-8') as f:
            json.dump(docs, f, ensure_ascii=False)
        resumen[col.id] = len(docs)
        print(f'{col.id}: {len(docs)} documentos')
    for c in OBLIGATORIAS:
        if resumen.get(c, 0) == 0:
            print(f'ERROR: la colección {c} salió vacía. No se guarda la copia.')
            sys.exit(1)
    with open(os.path.join(salida, '_resumen.json'), 'w', encoding='utf-8') as f:
        json.dump({'fecha': datetime.datetime.utcnow().isoformat() + 'Z', 'colecciones': resumen}, f, indent=1)
    return resumen

if __name__ == '__main__':
    import firebase_admin
    from firebase_admin import credentials, firestore
    firebase_admin.initialize_app(credentials.Certificate(json.loads(os.environ['FIREBASE_SERVICE_ACCOUNT'])))
    respaldar(firestore.client())
