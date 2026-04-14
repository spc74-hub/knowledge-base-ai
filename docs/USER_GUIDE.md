# Kbia — Guia de Usuario

**Version:** 3.0
**Fecha:** Abril 2026

---

## Tabla de Contenidos

1. [Inicio y autenticacion](#inicio-y-autenticacion)
2. [Dashboard](#dashboard)
3. [Gestion de contenido](#gestion-de-contenido)
4. [Explorador](#explorador)
5. [Busqueda](#busqueda)
6. [Notas](#notas)
7. [Full Notes (Notas completas)](#full-notes)
8. [Chat con IA](#chat-con-ia)
9. [Diario personal](#diario-personal)
10. [Habitos](#habitos)
11. [Areas de responsabilidad](#areas-de-responsabilidad)
12. [Proyectos](#proyectos)
13. [Objetivos](#objetivos)
14. [Modelos mentales](#modelos-mentales)
15. [Acciones](#acciones)
16. [Taxonomia y tags](#taxonomia-y-tags)
17. [Grafo de conocimiento](#grafo-de-conocimiento)
18. [Importacion de contenido](#importacion-de-contenido)
19. [Quick Save](#quick-save)
20. [Pipeline de procesamiento](#pipeline-de-procesamiento)
21. [Uso de API y costes](#uso-de-api-y-costes)
22. [API Keys](#api-keys)
23. [Expertos](#expertos)
24. [Modo movil (PWA)](#modo-movil-pwa)
25. [Configuracion](#configuracion)
26. [FAQ](#faq)

---

## Inicio y autenticacion

### Login
1. Accede a https://kbia.spcapps.com
2. Introduce email y contrasena
3. El sistema genera un token JWT valido por 7 dias
4. El token se almacena en localStorage del navegador

### Registro
1. Desde la pantalla de login, haz clic en "Registrarse"
2. Introduce email, contrasena (minimo 6 caracteres) y nombre opcional
3. Tras el registro, se inicia sesion automaticamente

### Cerrar sesion
- Haz clic en el boton de logout en el menu lateral
- Se eliminan los tokens del navegador

---

## Dashboard

El Dashboard es la pagina principal tras iniciar sesion. Muestra un resumen de toda tu actividad.

### KPIs superiores
- Fila de indicadores clave: Areas, Modelos Mentales, Objetivos, Proyectos, Notas, Diario, Habitos, Contenidos, Acciones pendientes
- Cada KPI es clickeable y abre la seccion correspondiente
- Los KPIs se pueden reordenar con drag & drop (se guarda en localStorage)

### Widgets de contenido
- **Vista General:** Contenido reciente con titulo, tipo y fecha
- **Notas rapidas:** Ultimas notas creadas
- **Full Notes:** Ultimas notas completas
- Cada widget permite crear nuevos items directamente
- Clic en un item abre un popup con detalle rico

### Panel de habitos del dia
- Muestra los habitos programados para hoy
- Permite marcar como completados directamente desde el dashboard

### Guardado rapido
- Boton "+" para guardar una URL rapidamente
- Introduce la URL y el sistema la procesa en background

---

## Gestion de contenido

### Tipos de contenido soportados
| Tipo | Fuente | Que se extrae |
|------|--------|---------------|
| `web` | Articulos, blogs, noticias | Texto completo, metadata, Open Graph |
| `youtube` | Videos de YouTube | Transcripcion, metadata (duracion, canal, views) |
| `tiktok` | Videos de TikTok | Descripcion, hashtags, usuario |
| `twitter` | Tweets y threads | Texto, menciones, hashtags (limitado) |
| `pdf` | Documentos PDF | Texto extraido |
| `note` | Notas internas | Contenido rico del editor |
| `apple_notes` | Apple Notes importadas | Contenido HTML parseado |

### Guardar contenido nuevo
1. Desde Dashboard o la pagina de Import, introduce una URL
2. El sistema detecta automaticamente el tipo de contenido
3. Se inicia el pipeline de procesamiento:
   - Fetch del contenido (scraping)
   - Generacion de resumen con Claude AI
   - Clasificacion automatica (Schema.org + IAB)
   - Extraccion de entidades y conceptos
   - Generacion de embedding vectorial
4. El contenido aparece en tu biblioteca una vez procesado

### Editar contenido
- Desde el detalle de cualquier contenido puedes:
  - Editar titulo y notas personales
  - Anadir/quitar tags de usuario
  - Cambiar la clasificacion de usuario
  - Marcar como favorito o archivar
  - Actualizar el nivel de madurez
  - Vincular a proyectos, areas o carpetas

### Nivel de madurez
El contenido evoluciona por estos estados:
- **Captured:** Recien guardado, sin revisar
- **Organized:** Revisado y categorizado manualmente
- **Synthesized:** Integrado con tus notas y conocimiento

### Operaciones masivas
- Archivar/desarchivar multiples items
- Eliminar multiples items
- Actualizar madurez en lote
- Reprocesar contenido (regenerar resumen, clasificacion, embedding)

---

## Explorador

Accede desde el menu lateral: **Explorar**

### Pestanas
- **Contents:** Todo el contenido guardado
- **Notes:** Tus notas (quick notes + full notes)

### Panel de filtros (lateral izquierdo)
Filtros facetados con conteo de resultados:
- **Tipo de contenido:** web, youtube, tiktok, twitter, pdf, note
- **Categorias IAB:** Tier 1, 2 y 3
- **Conceptos:** Extraidos por IA
- **Entidades:** Personas, organizaciones, productos
- **Tags de usuario:** Etiquetas personales
- **Tags de taxonomia:** Tags heredados por reglas
- **Estado de procesamiento:** pending, completed, failed
- **Nivel de madurez:** captured, organized, synthesized
- **Favoritos:** Solo favoritos
- **Con comentarios:** Solo items con notas del usuario
- **Rango de fecha:** Filtro temporal
- **Visitas:** Filtro por conteo de visitas

### Resultados
- Cards con titulo, resumen, tipo, metadata
- Boton de favorito rapido
- Quick View popup para ver detalle sin cambiar de pagina

---

## Busqueda

### Busqueda de texto (full-text)
- Barra de busqueda en el header
- Busca en titulo, resumen, contenido completo, conceptos y tags
- Resultados rankeados por relevancia

### Busqueda semantica
- Entiende el significado, no solo palabras exactas
- Ejemplo: "articulos sobre inteligencia artificial aplicada a medicina" encontrara resultados aunque no contengan esas palabras exactas
- Usa embeddings vectoriales y cosine similarity

### Busqueda global
- Busca en todas las entidades: contenidos, notas, proyectos, areas, objetivos, modelos mentales

---

## Notas

Accede desde el menu lateral: **Notas**

### Quick Notes (Notas rapidas)
Notas ligeras para capturar ideas rapidamente.

**Tipos de nota:**
- Reflexion, Idea, Pregunta, Conexion, Journal, Shopping

**Prioridades:**
- Urgent, Important, A, B, C

**Crear nota:**
1. Clic en "Nueva Nota"
2. Selecciona tipo y prioridad
3. Escribe titulo y contenido (editor rico)
4. Vincula a contenidos, proyectos, modelos mentales u objetivos (opcional)
5. Anade tags (opcional)

**Filtros disponibles:**
- Por tipo de nota (inclusion o exclusion)
- Por vinculacion (sueltas, vinculadas a contenido/proyecto/modelo/objetivo)
- Por prioridad
- Por estado (favorito, fijada, completada)

**Acciones:**
- Fijar/desfijar nota
- Marcar como completada/incompleta
- Cambiar prioridad
- Eliminar

---

## Full Notes

Accede desde el menu lateral: **Full Notes**

Notas completas con editor rico (TipTap).

### Editor rico
Funcionalidades del editor:
- **Texto:** Negrita, cursiva, subrayado, tachado, subindice, superindice
- **Encabezados:** H1, H2, H3
- **Listas:** Ordenadas, desordenadas, listas de tareas con checkbox
- **Tablas:** Crear y editar tablas con celdas y headers
- **Colores:** Color de texto y color de fondo/resaltado
- **Links:** Insertar y editar enlaces
- **Alineacion:** Izquierda, centro, derecha
- **Texto placeholder:** Texto de marcador de posicion

### Backlinks
1. En el editor, usa el boton de enlace (backlink)
2. Busca la nota a vincular
3. Se crea un enlace bidireccional
4. La nota destino muestra la referencia inversa

### Gestion
- Lista con busqueda y ordenacion (por fecha de actualizacion, creacion o titulo)
- Orden ascendente/descendente
- Marcar como favorita

---

## Chat con IA

Accede desde el menu lateral: **Chat**

### Como funciona
El chat usa RAG (Retrieval Augmented Generation):
1. Escribes una pregunta
2. El sistema busca contenidos relevantes en tu knowledge base usando embeddings
3. Claude AI responde basandose en TU contenido guardado
4. La respuesta incluye citaciones con links a las fuentes

### Sesiones
- Crea multiples sesiones de chat
- Cada sesion mantiene su historial
- Puedes eliminar sesiones

### Ejemplos de preguntas utiles
- "Que he aprendido sobre marketing digital?"
- "Resume mis notas sobre productividad"
- "Que videos tengo sobre programacion en Python?"
- "Cuales son las tendencias principales en mis articulos de tecnologia?"

---

## Diario personal

Accede desde el menu lateral: **Mi Diario**

### Estructura del dia

#### Seccion matinal
- **Intencion del dia:** Que quieres lograr hoy
- **Energia matinal:** high / medium / low
- **Contenido inspiracional:** Cita, refran, reto, pregunta o palabra del dia (se puede refrescar)
- **Big Rocks:** 1-3 objetivos principales del dia. Pueden ser:
  - Texto libre
  - Vinculados a un objetivo existente
  - Vinculados a un proyecto existente

#### Durante el dia
- **Energia:** Seguimiento a mediodia, tarde y noche
- **Tareas diarias:** Lista de checkbox
- **Compromisos:** Con hora asociada
- **Capturas rapidas:** Ideas con timestamp. Se pueden convertir en notas

#### Reflexion nocturna
- **Victorias:** Lista de logros del dia
- **Aprendizajes:** Que has aprendido hoy (texto)
- **Gratitudes:** Lista de 3+ cosas por las que estas agradecido
- **Fracasos/Retos:** Que no salio bien (texto)
- **Perdon:** Practica en tres niveles:
  - A mi mismo
  - A otros
  - Situaciones
- **Que haria diferente:** Reflexion (texto)
- **Nota para manana:** Mensaje a tu yo del futuro
- **Valoracion del dia:** 1-10
- **Palabra del dia:** Una palabra que resuma tu dia

### Cerrar el dia
- Boton "Cerrar dia" marca la jornada como completada
- El dia muestra iconos de completado (manana/dia/noche)

### Resumen con IA
1. Clic en "Generar Resumen IA"
2. Claude analiza tu dia: patrones emocionales, temas recurrentes, sugerencias
3. Puedes guardar el resumen como nota standalone

### Navegacion
- Mini calendario para navegar entre dias
- Historial de entradas
- Estadisticas de racha (dias consecutivos)

### Habitos en el diario
- Los habitos programados aparecen en el diario
- Puedes marcarlos como completados desde la vista del diario

---

## Habitos

Accede desde el menu lateral: **Habitos**

### Crear un habito
1. Clic en "Nuevo Habito"
2. Configura:
   - **Nombre y descripcion**
   - **Frecuencia:** Diaria, semanal o personalizada (dias especificos)
   - **Momento del dia:** Manana, Tarde, Noche, Cualquier momento
   - **Objetivo:** Conteo diario (ej: 10.000 pasos) o tiempo
   - **Area vinculada:** Asociar a un area de responsabilidad
   - **Icono y color**

### Registrar completado
Para cada habito puedes registrar:
- **Completado:** El habito se realizo
- **Saltado:** No se realizo (con nota opcional)

### Calendario visual
- Vista de calendario con historial de completados
- Colores indican el estado de cada dia
- Clic en cualquier dia para ver/editar

### Estadisticas
- Porcentaje de cumplimiento por periodo (semana, mes, ano)
- Desglose por area
- Racha actual y mejor racha
- Estadisticas individuales por habito

### Archivar habitos
- Los habitos que ya no son relevantes se pueden archivar (no eliminar)

---

## Areas de responsabilidad

Accede desde el menu lateral: **Areas**

Organizacion de tu vida en dominios (trabajo, salud, familia, etc.) siguiendo el metodo PARA.

### Crear area
1. Clic en "Nueva Area"
2. Define nombre, descripcion, icono y color
3. Estado: activa o inactiva

### Dentro de un area
- **Sub-areas:** Subdivide en temas mas especificos
- **Acciones:** Tareas asociadas al area
- **Modelos mentales:** Frameworks de pensamiento vinculados
- **Objetivos vinculados:** Enlaza objetivos al area
- **Proyectos vinculados:** Enlaza proyectos al area
- **Habitos vinculados:** Habitos asociados al area
- **Notas vinculadas:** Notas relevantes al area

### Reordenar
- Drag & drop para reordenar areas
- Orden se persiste en servidor

---

## Proyectos

Accede desde el menu lateral: **Proyectos**

### Vista de arbol
- Proyectos organizados en jerarquia padre-hijo
- Expandir/colapsar nodos
- Drag & drop para reordenar

### Crear proyecto
1. Clic en "Nuevo Proyecto"
2. Define nombre, descripcion, color, icono
3. Selecciona proyecto padre (opcional) y area vinculada (opcional)
4. Estado: active, on_hold, completed, archived
5. Deadline opcional

### Dentro de un proyecto
- **Contenidos vinculados:** Articulos, videos, etc. relacionados
- **Sub-proyectos:** Proyectos hijos en la jerarquia
- **Notas vinculadas:** Notas relevantes
- **Acciones:** Tareas del proyecto (checkbox)
- **Modelos mentales:** Frameworks aplicados
- **Objetivos vinculados:** Metas asociadas
- **Favorito:** Marcar para acceso rapido

---

## Objetivos

Accede desde el menu lateral: **Objetivos**

### Horizontes temporales
- **Lifetime:** Metas de vida
- **Yearly:** Anuales
- **Quarterly:** Trimestrales
- **Monthly:** Mensuales
- **Weekly:** Semanales
- **Daily:** Diarios

### Crear objetivo
1. Clic en "Nuevo Objetivo"
2. Define titulo, descripcion, horizonte, fecha objetivo
3. Vincula a area y objetivo padre (opcional)
4. Color e icono personalizables

### Dentro de un objetivo
- **Progreso:** 0-100% manual
- **Acciones:** Tareas para alcanzar el objetivo
- **Contenidos vinculados:** Material de referencia
- **Proyectos vinculados:** Proyectos que contribuyen al objetivo
- **Modelos mentales:** Frameworks relevantes
- **Notas vinculadas:** Reflexiones y planificacion

---

## Modelos mentales

Accede desde el menu lateral: **Modelos Mentales**

Frameworks de pensamiento (ej: First Principles, Pareto, Inversion).

### Catalogo
- Coleccion de modelos mentales predefinidos
- Activa los que quieras usar

### Crear modelo personalizado
1. Clic en "Nuevo Modelo"
2. Define nombre, slug, descripcion y notas
3. Personaliza color e icono

### Dentro de un modelo
- **Contenidos vinculados:** Ejemplos de aplicacion del modelo
- **Notas vinculadas:** Tus reflexiones sobre el modelo
- **Acciones:** Pasos para practicar el modelo

---

## Acciones

Accede desde el menu lateral: **Acciones**

Vista centralizada de TODAS las acciones (tareas) de la app.

### Agrupacion
Las acciones se agrupan por su origen:
- Acciones de Areas
- Acciones de Proyectos
- Acciones de Objetivos
- Acciones de Modelos Mentales

### Funcionalidades
- Crear nuevas acciones para cualquier entidad
- Marcar como completadas/pendientes
- Editar titulo
- Eliminar
- Filtrar por tipo padre
- Mostrar/ocultar completadas
- Secciones colapsables

---

## Taxonomia y tags

### Taxonomia automatica (IA)
Cada contenido se clasifica automaticamente en:
- **Schema.org:** Tipo de contenido (Article, VideoObject, etc.)
- **IAB Taxonomy:** Categoria tematica en 3 niveles (ej: Technology > AI > Machine Learning)
- **Conceptos:** Lista de temas clave
- **Entidades:** Personas, organizaciones, lugares, productos

### Tags de usuario
- Tags libres que tu pones a cualquier contenido
- Se pueden usar como filtro en el explorador

### Tags de taxonomia (personalizados)
Accede desde: **Tags**
- Crea reglas para etiquetar automaticamente contenido
- Tipos: category, person, organization, product, concept
- Cada tag tiene color personalizable
- Match por tipo y valor de taxonomia

### Explorador de taxonomia
Accede desde: **Taxonomia**
- Navega el arbol jerarquico de clasificaciones
- Ve cuantos items hay en cada nodo
- Expande nodos para ver contenido asociado

---

## Grafo de conocimiento

Accede desde el menu lateral: **Grafo de Conocimiento**

Visualizacion interactiva de las relaciones entre entidades de tu knowledge base.

### Nodos
- **Personas** (azul)
- **Organizaciones** (verde)
- **Productos** (amarillo)
- **Conceptos** (morado)

### Interaccion
- Tamano del nodo = cantidad de conexiones
- Clic en un nodo para ver contenido relacionado
- Filtros para mostrar/ocultar tipos de nodo
- Slider de minimo de conexiones
- Filtrado por tags

---

## Importacion de contenido

Accede desde el menu lateral: **Importar**

### Modos de importacion

**URL individual:**
- Pega una URL y el sistema la procesa completamente

**Cola de URLs:**
- Pega multiples URLs (una por linea)
- Se anaden a la cola de procesamiento en background

**CSV:**
- Sube un fichero CSV con columnas de URLs
- Usa la plantilla disponible en `/import_template.csv`

**Subida de ficheros:**
- Sube PDFs, documentos, imagenes
- Se parsean y procesan como contenido

**Google Drive:**
- Conecta tu cuenta de Google
- Sincroniza ficheros desde Drive
- Transcripcion de audio disponible

### Apple Notes
Accede desde: **Importar Apple Notes**
- Importa notas de Apple Notes
- Por carpeta o todas a la vez
- El HTML se parsea y se guarda como contenido

### Deteccion de duplicados
- El sistema detecta URLs ya guardadas
- No permite duplicados por usuario

---

## Quick Save

Accede desde: **Quick Save**

Metodos para guardar contenido rapidamente desde cualquier sitio:

### Bookmarklet
1. Ve a la pagina Quick Save
2. Arrastra el bookmarklet a tu barra de marcadores
3. Desde cualquier web, haz clic en el bookmarklet
4. El contenido se guarda automaticamente

### iOS Shortcut
1. Sigue las instrucciones en la pagina Quick Save
2. Configura el shortcut con tu API key
3. Comparte cualquier URL al shortcut para guardar

---

## Pipeline de procesamiento

Accede desde: **Procesamiento**

### Estado del pipeline
- Contenido pendiente de procesar
- Contenido con errores de procesamiento
- Estadisticas de procesamiento

### Acciones
- Reprocesar items fallidos individualmente
- Reintentar todos los fallidos en lote
- Proceso masivo de contenido pendiente

### Proceso automatico
El batch processor se ejecuta cada 15 minutos:
1. **Fase 1:** Descarga contenido de URLs pendientes (raw_content)
2. **Fase 2:** Proceso IA (resumen, clasificacion, embedding)

---

## Uso de API y costes

Accede desde: **Uso**

### Metricas
- **Tokens consumidos:** Por proveedor (OpenAI vs Anthropic)
- **Coste en USD:** Desglose por operacion
- **Llamadas:** Conteo de llamadas a API
- **Tendencia diaria:** Grafico de uso en el tiempo

### Desglose
- Por operacion (clasificacion, resumen, embedding, chat)
- Por proveedor
- Rango de fechas configurable (default: 30 dias)

---

## API Keys

Accede desde: **Configuracion > API Keys**

### Crear API Key
1. Define un nombre para la key
2. Se genera una key con prefijo `kb_`
3. Copia la key (solo se muestra una vez)
4. Usa la key en el header `X-API-Key` o como Bearer token

### Gestionar keys
- Ver keys existentes (solo prefijo visible)
- Ultimo uso registrado
- Eliminar keys

---

## Expertos

Accede desde: **Expertos**

Gestiona perfiles de personas con areas de expertise.

- Crear expertos con nombre y categorias de expertise
- Marcar como activos/inactivos
- Filtrar por categorias
- Util para organizar a quien consultar sobre que temas

---

## Modo movil (PWA)

### Instalacion
1. Abre https://kbia.spcapps.com en el navegador movil
2. "Anadir a pantalla de inicio"
3. La app se instala como PWA

### Vistas moviles disponibles
Las rutas `/m/*` ofrecen interfaces optimizadas para movil:
- **Dashboard movil:** KPIs y acciones rapidas
- **Notas:** Lista y creacion de notas rapidas
- **Full Notes:** Lista, creacion y edicion con editor rico
- **Contenidos:** Explorar con filtros y paginacion
- **Habitos:** Marcar completados
- **Diario:** Entrada diaria completa
- **Acciones:** Lista de tareas

### Navegacion movil
- Barra inferior con 6 pestanas
- Interfaz tactil optimizada
- Modales y popups adaptados
- Soporte de modo oscuro

---

## Configuracion

### Tema
- Modo claro / oscuro
- Toggle disponible en toda la app

### Guia integrada
Accede desde: **Guia**
- Instrucciones de uso
- Tutoriales por seccion
- Changelog de la app

---

## FAQ

### El contenido no se procesa
- Verifica que la URL sea accesible publicamente
- Algunos sitios bloquean scraping (Twitter es limitado)
- Revisa la pagina de Procesamiento para ver errores
- Reprocesa el item si fallo

### No encuentro mi contenido
- Usa la busqueda semantica con terminos diferentes
- Revisa los filtros activos en el explorador
- Busca por fecha de guardado
- Comprueba si esta archivado

### El resumen de IA no es preciso
- La calidad depende del contenido extraido
- Para TikTok y Twitter, la extraccion puede ser limitada
- Reprocesa el item si el contenido bruto es correcto

### Como exporto mis datos?
- Funcionalidad en desarrollo
- Los datos estan en PostgreSQL y son accesibles directamente

### Como funciona el Quick Save?
- El bookmarklet inyecta tu token JWT en la peticion
- La URL se guarda y se procesa en background
- Recibiras una confirmacion visual

---

*Ultima actualizacion: Abril 2026*
