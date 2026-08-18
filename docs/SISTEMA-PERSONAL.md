# Sistema personal — captura, foco y contenido

> **Documento de continuidad del plan global.** Kbia es la app de planificación de
> vida, así que este plan vive aquí — no en el repo de ninguna otra app.
> Versión visual: [Cuadro de reparto](https://claude.ai/code/artifact/f420ff06-31b8-4a07-ae25-846cc68f3e30).
> La parte de contenido en profundidad: `contenthub/docs/HUB-TEMAS.md`.
>
> Escrito el 2026-08-16. Marca claramente **qué está decidido** y **qué sigue
> pendiente**, porque casi todo el sistema está diseñado y sin arrancar.

## El diagnóstico, con datos

Kbia lleva **ocho meses parada**, y ese es el hecho que ordena todo lo demás:

| | |
|---|---|
| Áreas | 10 |
| Objetivos activos | 4 — **todos al 0 % de progreso** |
| Proyectos «activos» | 17 — **ninguno tocado desde el 21-dic-2025** |
| Hábitos activos | 12 — **último registro: 14-dic-2025** |
| Entradas de diario | 9 en total, la última el 16-dic-2025 |
| Contenidos | 2.012, de los cuales **2.006 entraron en dic-2025** en una carga masiva |

Reminders tampoco es la capa de ejecución: 26 recordatorios, 2 completions en 30
días, y dos de sus seis listas se llaman «Lista test» y «Lista sin Enter».

Mientras tanto, en esos mismos ocho meses: ContentHub entera (28.724 contenidos,
192 canales), el research de David Duarte (91 vídeos, 43,6 h, 94 fichas), DaDuSt,
cinco fases de Books, y el puente «Send to Kbia» —construido el 18-may-2026— por el
que han pasado **seis contenidos**.

**El diagnóstico:** no falta tiempo (12+ h/semana, 400+ horas en ocho meses que
produjeron mucho). Falta destino. **El sistema tiene un acelerador excelente y
ningún freno**, y la única pieza que podía frenar —Kbia— es justo la que está
muerta.

**Corolario incómodo y que hay que tener presente:** mejorar la captura empeora el
problema declarado. Cada pieza nueva aumenta la oferta de opciones; ninguna la
reduce.

---

## Lo que está decidido

### 1 · La regla que mata el rozamiento

> **Capturar y clasificar son dos actos distintos, separados en el tiempo, y los
> hacen personas distintas.** Tú capturas. Claude clasifica. Tú revisas después.

Dos frases operativas:

- **«Lo que sale de mi cabeza va a Entrada. Lo que sale de una pantalla ya está
  capturado.»** ContentHub ya traga los 192 canales solo.
- **El buzón guarda punteros, no contenido.** «Pasar a limpio las notas del martes»
  es una entrada válida.

### 2 · Vocabulario — cuatro niveles, y solo uno es escaso

| | Qué es | Cuántos | ¿Ocupa cupo? |
|---|---|---|---|
| **Área** | dominio de vida, no se acaba nunca | **las 10**, siempre | No |
| **Frente** | el proyecto o tema en curso, de meses | **3 personales + 2 de trabajo** | **Sí** |
| **Puesta a punto** | 2-4 sesiones y se cierra; suele dejar una rutina | las que quepan | No |
| **Rutina** | se repite y no termina: hábito o revisión | pocas, con racha | No |

- **Un frente no es un tipo de objeto: es un estado.** Kbia ya tiene ocho tipos de
  objeto y murió — la solución no puede ser un noveno.
- **Ocupa cupo lo que dura más de tres semanas o pide atención continuada.** Si el
  freno bloquea también lo pequeño y útil, el sistema se abandona en dos semanas.
- **El foco no se declara: se deduce.** Las áreas con foco son aquellas donde hay un
  frente abierto.
- 🔴 **Construir una app ocupa un frente.** Hoy es gratis —no aparece en ningún
  sitio, no compite con nada— y por eso se come las horas.

### 3 · Una sola tubería, dos presupuestos

Partir la ejecución entre trabajo y vida obligaría a decidir «¿esto es de trabajo?»
en cada captura: el rozamiento otra vez. El día es uno solo.

- **No se separa:** el buzón, la ejecución y el panel.
- **Sí se separa:** el cupo de frentes (3 personales + 2 de trabajo), porque las
  horas de trabajo son obligatorias y las 12+ semanales son elegidas.

**Decisión tomada: no se construye SAT.** Sería un segundo sitio donde viven
tareas, y dos sitios significa que ninguno se mantiene — es lo que pasó con Kbia y
la cabeza. Su función la cubre una lista `Trabajo · día a día` en Reminders.

### 4 · Reparto — qué va dónde

| Lo que aparece | Dónde vive | Quién |
|---|---|---|
| Idea, feedback, decisión, nota de papel — de trabajo o personal | Reminders › `Entrada` | **Tú** |
| Contenido de una fuente que sigues | ContentHub | automático |
| Acción concreta de esta semana | Reminders › lista del frente | Claude |
| Funciones del trabajo que no se cierran | Reminders › `Trabajo · día a día` | Claude |
| Compromiso: objetivo, proyecto, hábito | **Kbia** | Claude |
| Síntesis con evidencia sobre un tema | ficha del hub | Claude, tú lo decides |
| Estado técnico de las apps | HubIT | automático |

**Un objeto vive en un único sitio.** El proyecto está en Kbia; sus acciones de esta
semana son recordatorios que apuntan a él. Nunca las dos cosas.

### 5 · Estructura prevista en Reminders

`Entrada` (ya existe) · `P1 · P2 · P3` (frentes personales, secciones
`Ahora`/`Siguiente`/`Esperando`) · `T1 · T2` (frentes de trabajo) ·
`Trabajo · día a día` · `Rutinas` · `Barbecho` (con fecha de revisión) ·
`Archivo frío` · `Personal` y `Compra` (ya existen).

Diez etiquetas, una por área de Kbia, para que el enrutamiento a Kbia no necesite
traducción. Y la etiqueta **`#sin-revisar`** en todo lo que clasifique Claude — es
el patrón `origen: claude` que ya inventaste en el contrato de datos de DaDuSt,
con las herramientas que hay.

**Las listas de frente solo se crean cuando hay algo dentro. Que `P3` no exista es
el freno.**

### 6 · Seguimiento — dos mecánicas, no una

Lo que hace funcionar a Duolingo no es la racha: es que **viene a buscarte** —
notificación al móvil y un toque. Kbia había que ir a abrirla, y por eso murió con
12 hábitos configurados.

- **Racha → solo para rutinas.** Binarias y repetidas: misa, meditación,
  estiramientos, francés, cita de pareja, plan del finde.
- **Antigüedad → para frentes.** Un proyecto no avanza cada día; ponerle racha
  genera culpa y luego abandono. La presión correcta es «lleva 18 días sin
  tocarse», y el MCP de Reminders ya lo calcula (`scope: stale`).

### 7 · Criterio de fracaso, decidido de antemano

Cuatro semanas. Si sale rojo **no se insiste: se cambia el método.**

| Señal | Verde | Rojo — y qué significa |
|---|---|---|
| Capturas en `Entrada` | ≥10/semana | <3 dos semanas seguidas → el buzón no está en tu flujo. El fallo es de **acceso**, no de método |
| Etiquetas `#sin-revisar` | bajan cada semana | se acumulan → no te fías de la clasificación, o el volumen de revisión pesa |
| Frentes abiertos | ≤3+2 | suben → el freno es decorativo y hay que hacerlo físico |

---

## La cartera de apps, por área

| Área | Apps |
|---|---|
| **Salud** | LuukTrainer (4.493 días de métricas) · DaDuSt · Books |
| **Trabajo** | BSC · Salesforce · TLB |
| **Familia** | FamilIA · Torneo Verano-26 |
| **Religión** | DPAdT |
| **Sistema** (no compiten por cupo) | ContentHub · Kbia · Reminders · HubIT · spcapps-infra |
| Fuera de las cuatro | BetSoccer · GolfShot · Permiso Armas · Gurufocus (parada) |

**9 de 17 sirven a las cuatro áreas de foco. La cartera está bien alineada.** El
desajuste está en el consumo:

| Área en ContentHub | Contenidos | ¿Área de foco? |
|---|---|---|
| Tecnología & IA | 10.872 | Trabajo |
| Carrera | 8.432 | Trabajo |
| Negocio | 6.970 | Trabajo |
| Finanzas | 5.946 | **No** |
| Salud & Fitness | 2.836 | Salud |
| Espiritualidad & Religión | 594 | 11.º de 12 |
| **Familia** | **—** | **no existe el área** |

Dos de las cuatro áreas de foco están casi a cero, y Familia ni siquiera existe
como área en el clasificador. Eso no se arregla con triage: **se arregla añadiendo
fuentes.**

---

## El hallazgo del 18-ago: no falta diseño, falta uso

Leyendo el vault de Obsidian —3.107 notas, 556.000 palabras— buscando «cómo es su
vida», apareció otra cosa. **Este es el cuarto intento del mismo proyecto:**

| Cuándo | Dónde | Qué pasó |
|---|---|---|
| **3-dic-2025** | PARA dentro de Kbia (nota «KBai») | Escrito el 3, Kbia congelada el 14 |
| **17-mar-2026** | `PROPUESTA-REORGANIZACION.md` en Obsidian | Diseño completo: PARA + Zettelkasten + GTD, 10 carpetas, 8 flujos, 8 plantillas, dashboards. **Migración empezada y parada** |
| **16-ago-2026** | Este documento | Diseñado, sin arrancar |

La prueba de que la de marzo se quedó a medias sigue en el disco: `02 PROYECTOS`
tiene **1** nota y `Proyectos` tiene **400**; `05 ENTIDADES` tiene 73 y `Entidades`
398. Las dos estructuras conviven desde entonces.

**Ninguno de los tres se abandonó por malo.** El de marzo es más detallado que
este. Los tres se quedaron en el diseño.

Y hay un contraste dentro del propio vault que señala dónde está el fallo: **el
pipeline técnico sí funcionó** —audio → Whisper → enriquecimiento con Claude →
búsqueda semántica, 3.107 notas producidas—. Lo que nunca arrancó fue lo que
exige que Sergio haga algo cada semana: el weekly review y procesar el inbox.

**Corolario:** los tres intentos asumieron que el problema era *no tener dónde
ponerlo*. Nadie lo comprobó. Montar un cuarto sitio mejor no es la respuesta si
la hipótesis es falsa.

## La prueba de los 5 días · 18-23 agosto 2026

La más pequeña que distingue entre «me falta dónde ponerlo» y «no lo pongo».

> **Todo lo que se te ocurra —trabajo o personal— va a `Entrada`. Una línea.
> Del 18 al 23 de agosto. No se crea ninguna lista, ningún frente, ninguna
> etiqueta.**

Línea base: `Entrada` tenía **4 apuntes**, de los cuales 2 los puso Claude → **2
apuntes reales**.

| Resultado el 23 | Qué significa |
|---|---|
| ≥10 apuntes | Faltaba dónde ponerlo. Se monta la estructura. |
| 2-3 apuntes | No es la estructura. Diez listas no lo habrían arreglado. Buscar otra cosa. |

## Lo que sigue PENDIENTE

🔴 **Los tres frentes nunca se fijaron.** Es lo único que bloquea todo lo demás: sin
frentes declarados, el triage no tiene contra qué comparar y todo cae en Barbecho.
Propuesta sobre la mesa: `P1 · Gestión personal` (montar y probar este sistema),
`P2 · DaDuSt en uso` (cerrarla y usarla 30 días), `P3` **vacío a propósito** —
mirar un cupo libre y no llenarlo durante cuatro semanas dirá más que cualquier
métrica. Y `T1 · Proyectos de IA y assets`.

🔴 **La estructura de Reminders no está creada** y el triage no ha arrancado.
Se puede hacer **sin escribir una línea de código**: el MCP de Reminders ya está
conectado y expone crear, listar, mover, etiquetar, secciones y prioridad, además
de `scope: stale`. Cadencia acordada: **un día fijo a la semana + cuando lo pidas**,
con autonomía de **escribir directo, marcado con `#sin-revisar`**.

🟡 **Clasificar las apps dentro de Kbia** por área y objetivo. Efecto secundario
valioso: las que no encajen en ningún área activa quedan expuestas como candidatas
a decomisionar. Reparto con HubIT: **HubIT = estado técnico, Kbia = por qué existe
y a qué sirve.** Un enlace, nunca dos registros.

🟡 **Un panel visible** con frentes, días sin tocar, rachas, barbecho y estado de
Entrada, con enlace a cada app. En la fase 1 puede ser **un artefacto que Claude
regenera cada semana tras el triage** — cero código. Si a las seis semanas lo
consultas de verdad, entonces se construye en HubIT o en Kbia.

🟡 **Familia y Religión no tienen fuentes de contenido.** Son áreas de foco sin
tubería que las alimente.

🟡 **El lado del trabajo: ¿app nueva, o dentro de algo que ya existe?** El vault de
Obsidian tiene **1.674 minutas comerciales** —clientes, propuestas, presupuestos,
personas y empresas ya extraídas con front-matter— y es un corpus bueno **para el
trabajo**, no para la vida. Hoy no tiene sitio: Kbia es vida, ContentHub es
contenido externo, HubIT es estado técnico de las apps. Decidir si va a HubIT, a
una app nueva, o a ninguna parte. **Compite por cupo con lo demás, así que no se
abre hasta que haya un frente libre.**

🟡 **El diario, y el salto trabajo↔personal.** Sergio lo señala como fuente de
entropía y pérdida de foco en su día a día. Ojo: **parte ya está decidida** —«una
sola tubería, dos presupuestos»: no se separan buzón, ejecución ni panel; sí se
separa el cupo de frentes. Lo que **no** está resuelto es el diario: si se lleva
uno solo o dos, y cómo se registra un día que salta entre las dos cosas cada hora.
Es un problema común, con método y herramientas conocidas — merece análisis propio,
no improvisación.

---

## La parte de contenido, en una frase

ContentHub es el índice temático transversal a autores: entras por un área, abres
un tema, lees su explicación, ves qué aporta cada voz y saltas al vídeo en el
segundo exacto. **Estado a 16-ago: 99 temas, 762 citas, 99,6 % resueltas a
contenido propio, dos voces.**

Todo el detalle —invariantes del modelo, pipeline de un corpus, los cuatro pasos y
la estimación de ~34 sesiones— está en **`contenthub/docs/HUB-TEMAS.md`**. No se
duplica aquí a propósito.

Lo único que conviene retener desde el lado de la vida: **destilar un corpus cuesta
sesiones, y una sesión es el recurso escaso.** Por eso un canal-autor nuevo ocupa un
frente mientras se destila, y por eso el criterio de parada del research de Duarte
—*«cuando las respuestas se repiten, está maduro; no es un proyecto infinito»*— es
la misma regla que el cupo de frentes, aplicada al contenido.
