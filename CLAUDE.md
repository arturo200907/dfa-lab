# DFA·lab — editor y evaluador de autómatas finitos deterministas

> **Norma permanente: mantén este documento al día.**
> Después de **cada** cambio en el proyecto, y antes de dar el trabajo por
> terminado, actualiza `CLAUDE.md` en el mismo turno:
> 1. Añade la entrada correspondiente en **Registro de cambios** (al final).
> 2. Actualiza la sección que quede desfasada: *Funcionalidades y dónde viven*,
>    *Trampas conocidas*, *Escala tipográfica*, *Convenciones*…
> 3. Si el cambio invalida algo que este documento afirma, **corrígelo**; no
>    dejes dos versiones de la verdad conviviendo.
>
> El registro es para el **qué y el porqué**, no para el diff: el código ya
> cuenta el cómo. Anota sobre todo las decisiones y las trampas que costaría
> volver a descubrir.

## Propósito

**El objetivo principal de este proyecto es poder evaluar si un autómata finito
cumple con requisitos de diseño.** No es sólo un editor de diagramas: es una
herramienta de comprobación. Todo lo demás (lienzo, tabla, LaTeX) existe para
alimentar esa evaluación.

La herramienta trabaja en **dos modos**, con el mismo lienzo y la misma δ:
**AFD** (determinista) y **AFN** (no determinista, con transiciones ε). El
conmutador está en la barra de herramientas. El modo no es cosmético: decide
qué cuenta como defecto.

Los "requisitos de diseño" que la herramienta comprueba son de dos clases:

1. **Requisitos estructurales** — que el objeto sea de verdad lo que dice ser.
   Se verifican de forma automática y continua en la pestaña *Validación*.

   En **modo AFD**:
   - `δ : Q × Σ → Q` es una función **total** (definida para todo par `(q,a)`);
     los pares que faltan se marcan como error y se listan.
   - Existe **exactamente un** estado inicial.
   - Ningún par `(q,a)` con más de un destino y ninguna transición ε. El editor
     no deja crearlas en este modo, así que sólo pueden llegar de un archivo
     importado; si llegan, se reportan como error y se sugiere cambiar de modo.
   - `Σ` no contiene ε (nunca, en ningún modo).

   En **modo AFN**:
   - `δ : Q × (Σ ∪ {ε}) → P(Q)`. Que `δ(q,a) = ∅` o que tenga varios destinos
     **no** es un defecto: se informa (nivel *info*, azul), no se marca error.
   - Siguen siendo errores no tener estados, tener `Σ = ∅` o no tener inicial.
   - Si un AFN resulta ser determinista y total, la validación lo dice, para
     que sepas que puedes pasar a AFD sin perder nada.

   En los dos modos: higiene del autómata — estados **inalcanzables** desde
   `q0` (siguiendo también las ε) y estados **muertos** (desde los que nunca se
   alcanza `F`) se reportan como avisos, no como errores.

2. **Requisitos semánticos** — que `L(M)` sea el lenguaje que se pretendía.
   Aquí hay dos situaciones que conviene no mezclar:

   - Contra una descripción **en palabras** (campo *Lenguaje objetivo L*) el
     problema **no es decidible**. La herramienta ofrece el **simulador** (paso
     a paso, con traza y cinta), la **prueba por lotes** y la subpestaña
     **Prompt: evaluar M** (`buildPrompt`), que empaqueta el autómata en LaTeX
     junto con `L` y pide el **contraejemplo más corto**, distinguiendo falso
     positivo (`w ∈ L(M)`, `w ∉ L`) de falso negativo.
   - Contra una **expresión regular** (pestaña *Regex*) **sí es decidible**, y
     por eso esa pestaña no opina: decide. Se construye el AFN de `r` por el
     algoritmo de Kleene, se determinizan los dos autómatas y se recorre el
     producto en anchura. O son iguales, o sale el **contraejemplo más corto**
     con la misma clasificación de falso positivo / falso negativo — pero
     demostrado, no sugerido.

   **Es la comprobación más fuerte que da la herramienta**: si el enunciado se
   puede escribir como expresión regular, escríbela y usa esa pestaña.

Hay un tercer prompt, **Prompt: dibujo → quíntupla** (`buildVisionPrompt`), que
no evalúa: alimenta la evaluación. Sirve para que un LLM con visión lea la foto
de un diagrama hecho a mano y devuelva su quíntupla, lista para pegar en el
diálogo ⟨5⟩. Su instrucción central es **transcribir, no corregir**: si el LLM
"arregla" el autómata al leerlo, la evaluación posterior no vale nada. Por eso
las pistas que se le pasan (Σ y `L` actuales) van marcadas como material para
desambiguar la lectura, nunca para cambiar el dibujo. Si mantienes ese prompt,
preserva esa distinción.

Al tocar el código, mantén esta jerarquía: cualquier función nueva debería
acabar reforzando la evaluación, no sólo el dibujo.

## Archivos

| Archivo | Qué es |
|---|---|
| `dfa-editor.html` | **Toda** la aplicación: markup, CSS y JS en un único archivo. |
| `_verify.js`      | Arnés de pruebas para Node. Carga el `<script>` del HTML en un DOM simulado. |
| `CLAUDE.md`       | Este documento. Es un documento vivo: se actualiza con cada cambio (ver la norma de arriba). |

## Cómo ejecutar

- **La app**: abrir `dfa-editor.html` en el navegador. No hay build, ni
  dependencias, ni servidor. Funciona desde `file://`.
- **Las pruebas**: `node _verify.js` (sin dependencias; sale con código 1 si algo falla).

Ejecuta `node _verify.js` después de **cualquier** cambio en el `<script>`.
Son 278 comprobaciones en 28 secciones: modelo, aristas derivadas, simulador,
LaTeX/TikZ, validación, persistencia, import defensivo, paleta, parser de la
quíntupla, prompt de transcripción, generación con ida y vuelta, δ como
conjunto, modo AFN, simulación con ramas y ε, sintaxis de la expresión regular,
construcción de Kleene, equivalencia con contraejemplo y determinización.

Si añades una funcionalidad, añade también su sección de pruebas. El arnés ya ha
cazado dos defectos reales que la lectura del código no vio.

## Repositorio

> **Ojo (2026-08-23): esta copia no es un repositorio.** El directorio actual
> (`DFA-main`) no tiene `.git` — tiene toda la pinta de ser el ZIP descargado de
> la rama `main`. Aquí no funciona ningún `git`: para versionar estos cambios
> hay que copiarlos al clon de verdad, o clonar el repo y traer los archivos.
> Lo de abajo describe ese clon, no esta carpeta.

El proyecto es un repositorio git desde el 2026-08-02, rama `main`,
y se publica en **dos** remotos con el mismo contenido:

| Remoto | Repositorio | Visibilidad |
|---|---|---|
| `origin` | https://github.com/arturo200907/dfa-lab | público |
| `dfa`    | https://github.com/arturo200907/DFA     | privado |

`dfa/main` es el **upstream** de la rama local: un `git push` a secas va al repo
privado. Para actualizar el público hay que decirlo: `git push origin main`.
Empuja siempre a los dos o los dos historiales divergirán.

Pasa `node _verify.js` **antes** de cada commit: `dfa-lab` es público, así que el
HTML que se sube es el que alguien puede abrir directamente.

## Arquitectura

El `<script>` está dividido en secciones numeradas con banner de comentario
(`1. MODELO`, `2. UTILIDADES DE UI`, …, `14. PESTAÑAS…`). Respeta esa
numeración y coloca el código nuevo en su sección.

### La invariante central: δ es la única fuente de verdad

```js
model.delta[ key(q, a) ] = [q'…]   // key(q,a) = q + SEP + a, con SEP = "\u0000"
```

El valor es **siempre un array de destinos, y nunca vacío**: cuando un conjunto
se queda sin elementos se borra la clave, de modo que ningún recorrido de
`model.delta` se topa con un array vacío. En modo AFD ese array tiene como mucho
un elemento; el tipo es el mismo en los dos modos a propósito, para no tener dos
representaciones de lo mismo conviviendo.

Accesores (§1 y §4), úsalos en lugar de tocar `model.delta` a mano:

| Función | Para qué |
|---|---|
| `dsts(q,a)` | el array de destinos (vacío si no hay transición) |
| `dst(q,a)` | atajo del caso determinista: el único destino, o `undefined` |
| `setDsts(q,a,lista)` | primitiva: normaliza, ordena como `Q` y borra la clave si queda vacía |
| `setDelta(q,a,to)` | AFD: asigna reemplazando (y avisa con un toast de la reasignación) |
| `addDelta(q,a,to)` | AFN: añade un destino más |
| `toggleDelta(q,a,to)` | lo que usa la interfaz: en AFD reasigna, en AFN acumula |

Las **aristas del diagrama son una vista derivada** (`deriveEdges()` agrupa δ
por par origen/destino). De aquí salen dos consecuencias que hay que preservar:

- **El determinismo ya no lo garantiza la estructura de datos, sino el modo.**
  Antes la clave `(q,a)` sólo admitía un valor; ahora admite un conjunto, y
  quien impide el no determinismo en AFD es `toggleDelta`/`setDelta` más la
  validación. No introduzcas una estructura de aristas paralela: sigue habiendo
  una sola fuente de verdad.
- Para cambiar el autómata, escribe en `model.delta` (con los accesores) y llama
  a `commit()`. `commit()` re-renderiza todo lo derivado (lienzo, lista, tabla,
  LaTeX, validación, **veredicto de la regex**, simulador) y persiste en
  `localStorage`.

El modelo:

```js
{ formatVersion:2, kind:"dfa"|"nfa", alphabet:[sym], states:[{id,name,x,y,accepting}],
  initial:id, delta:{}, language, regex, regexPlus:"union"|"closure" }
```

`states[].id` es interno (`s1`, `s2`, …); `name` es lo que ve el usuario. Usa
`nameOf(id)` para mostrar. En el JSON exportado δ se serializa **anidada**
(`{ q: { a: q' } }` en AFD, `{ q: { a: [q1,q2] } }` en AFN) para que el archivo
sea legible; en AFD se escribe el destino suelto, así que **los .json de antes
siguen valiendo y los nuevos también los abre la versión vieja** mientras el
autómata sea determinista. `loadModel` lee las tres formas (escalar, array y el
formato plano heredado).

### Trampas conocidas (no las reintroduzcas)

- **`applyHighlight()` no re-renderiza el SVG.** Alterna clases sobre el DOM
  existente. Reconstruir el SVG desde un handler de *hover* eliminaría el
  elemento bajo el cursor y provocaría un bucle `mouseout`/`mouseover`.
- **Nada de `confirm()`/`alert()` nativos**: bloquean la página. Usa
  `confirmBox()` (promesa) y `toast()`.
- **Portapapeles**: `copyText()` cae a `execCommand("copy")` porque la Clipboard
  API está restringida en `file://`.
- **`loadModel` es defensivo**: descarta transiciones que apunten a estados o
  símbolos inexistentes, y anula un `initial` inválido. Mantenlo así.
- El orden de las alternativas en `ARROW` (parser de la quíntupla) importa: las
  largas primero, si no `=` se come el primer carácter de `=>`.
- **`mode` y `model.kind` son cosas distintas.** `mode` (global, §7) es la
  herramienta activa del lienzo — `select`/`add`/`connect`/`delete`.
  `model.kind` es AFD/AFN. No los mezcles ni renombres uno con el otro.
- **ε nunca está en Σ.** Es un símbolo de transición, no del alfabeto:
  `addSymbols` lo rechaza, `loadModel` lo filtra y el parser de la quíntupla lo
  quita avisando. Para las columnas hay dos funciones y no son intercambiables:
  `transSymbols()` (Σ ∪ {ε} en AFN, para el popover y la tabla en edición: es
  donde se crean las ε) y `deltaColumns(forEdit)` (esconde la columna ε si el
  autómata no usa ninguna, para que el LaTeX no se llene de ∅).
- **`+` en una expresión regular es ambiguo** (unión en Hopcroft, clausura
  positiva en casi todo lo demás) y **no se adivina por contexto**: lo decide el
  selector de la pestaña *Regex*, que se guarda en `model.regexPlus`. Adivinarlo
  acertaría a veces y fallaría en silencio otras, que es lo peor que puede pasar
  en una herramienta cuyo objetivo es decidir.
- `determinize()` mete el **subconjunto vacío como un estado más** (el sumidero).
  Es lo que hace que el AFD resultante sea total y que comparar dos autómatas
  sea un recorrido en anchura sin casos especiales. No lo "optimices" fuera.
- El AFD de `determinize()` **no se minimiza**, y no hace falta: la equivalencia
  se decide por el producto, no comparando estados.
- El simulador trabaja **siempre con conjuntos** de estados, también en AFD
  (donde son unitarios). Un `sim.steps[i].from` es un array, no un id.

## Funcionalidades y dónde viven

| Funcionalidad | Entrada en el código |
|---|---|
| Paleta arrastrable (estado / aceptación / dummy) | §7b, `dropPalette()` |
| Bucles (estado consigo mismo) | §7, `startEdgeDrag`/`mousemove`/`mouseup`, bandera `drag.self` |
| Quíntupla → autómata | §13b, `parseQuintuple()` + `modelFromSpec()` |
| Autómata → quíntupla | §13b, `tupleFromModel()` |
| Prompt para transcribir un dibujo | §10, `buildVisionPrompt()` |
| Validación de diseño | §12, `analyze()` |
| Modo AFD / AFN | §1 `model.kind`, §4 `setKind()` · `syncKindUI()` |
| δ con varios destinos | §1 `dsts`/`dst`, §4 `setDsts`/`addDelta`/`toggleDelta` |
| Simulación de un AFN (ramas y ε) | §11 `closureOf()`, `stepSet()`, `runTokens()` |
| Expresión regular y equivalencia | §13c `reParse()` · `thompson()` · `determinize()` · `dfaDiff()` · `regexReport()` |
| Regex → AFN por el algoritmo de Kleene | §13c `regexToNfa()` + `modelFromAuto()` |
| Determinización por subconjuntos | §13c `determinizeModel()` |
| Tamaño del panel inferior | §14 `applyUi()` · `setPanelHeight()` · `setFold()` |
| Export LaTeX / TikZ / prompts | §10 |
| Simulador y lotes | §11 |

### Paleta

Tres elementos arrastrables al lienzo (también funcionan con clic, que los
coloca en el centro de la vista):

- **Estado** — normal, no final.
- **Estado de aceptación** — nace con `accepting:true` (doble círculo).
- **Estado dummy** — el estado trampa clásico: no acepta y se cierra sobre sí
  mismo con **todos** los símbolos de Σ, de modo que δ siga siendo total.
  Es la contrapartida manual del botón *Completar δ con estado trampa*.
  **En modo AFN se oculta** (y con él el botón de completar δ): ahí δ parcial
  es legítima, y ofrecer un parche para algo que no está roto confunde.

### Bucles

Para conectar un estado consigo mismo: arrastrar desde el estado, **salir de
él** y volver a soltar encima. La bandera `drag.left` exige esa salida (con
histéresis: sale a `R+16`, vuelve a entrar a `R+8`) para que un simple clic no
se confunda con un bucle; mientras el puntero está de vuelta sobre el origen se
previsualiza el bucle real, no una recta.

### Quíntupla

`parseQuintuple()` es deliberadamente permisivo y **devuelve errores, no
excepciones**: `{ ok, errors[], warns[], spec }`. Acepta

- conjuntos `Q = {…}`, `Σ/Sigma/Alfabeto = {…}`, `q0/Inicial = …`,
  `F/Finales/Aceptacion = {…}`, `L = …` (va al lenguaje objetivo);
- la tupla en una línea: `M = ({q0,q1}, {a,b}, δ, q0, {q1})`;
- δ como `δ(q,a)=q'`, `(q,a)->q'`, `q,a->q'`, `q a -> q'`, `q a q'`;
- una tabla con `|` o tabuladores, con prefijos `->` y `*` en la primera columna;
- notación LaTeX (`\{`, `q_{0}`, `\delta`) y claves con o sin acentos;
- la basura típica de una respuesta de LLM: vallas ```` ``` ````, viñetas al
  principio de línea y notas en líneas que empiezan por `%` o `//`.

`Q`, `Σ`, `q0` y `F` son opcionales: se deducen de las transiciones. Coherente
con el propósito del proyecto, distingue **error** (no genera) de **aviso** (sí
genera). Y qué cae en cada saco **depende del modo**, que se le pasa como
segundo argumento (`parseQuintuple(texto, kind)`, por omisión el del modelo):

| | AFD | AFN |
|---|---|---|
| dos destinos para el mismo `(q,a)` | error | se acepta |
| `δ(q, ε) = …` | error | se acepta |
| δ parcial | aviso | ni eso: es normal |
| ε declarada dentro de Σ | error | aviso, y se quita de Σ |
| estado fuera de `Q` | error | error |

En modo AFN el lado derecho admite conjuntos: `δ(q0,a) = {q1,q2}`, y lo mismo
en las celdas de la tabla (`->q0 | {q1,q2} | ∅`). `modelFromSpec()` coloca los
estados en círculo, con el primero a la izquierda, y conserva la expresión
regular que hubiera escrita (la quíntupla no habla de ella).

### Expresión regular (§13c)

La pestaña *Regex* compara `L(M)` con `L(r)` y **decide**. La cadena de montaje:

```
r ──reParse──▶ AST ──thompson──▶ AFN ──┐
                                       ├──determinize──▶ AFD ──┐
M (el del lienzo) ─────────────────────┘                       ├─ dfaDiff
                                                               ┘  (anchura)
```

`dfaDiff` recorre en anchura los pares de estados de los dos AFD desde sus
iniciales; el primer par en el que uno acepta y el otro no da, por ser anchura,
**la cadena más corta** que separa los dos lenguajes. Si no aparece ninguno,
los lenguajes son iguales y eso es una demostración, no una muestra.

Sintaxis (la ayuda plegable de la pestaña la repite para el usuario):

- símbolos de Σ por coincidencia más larga, así que valen los multicarácter;
  `'x'` entrecomillado para un símbolo que choque con un operador (`'+'`);
- concatenación por yuxtaposición (o `·`), unión `|` / `∪`, `*`, `⁺`, `?`;
- `ε`/`λ` para la cadena vacía y `∅` para el lenguaje vacío;
- precedencia `* ⁺ ?` > concatenación > unión;
- se admite el prefijo `r = ` porque es como se escribe en los apuntes.

`reParse()` devuelve `{ok, errors[], extra[], ast}` — errores, no excepciones,
como `parseQuintuple`: la expresión se analiza en cada pulsación de tecla y a
medio escribir casi nunca es válida. `extra` son los símbolos que la expresión
usa y no están en Σ: no es un error (la comparación se hace sobre Σ ∪ extra),
pero se avisa, porque casi siempre es una errata.

Dos usos más de la misma maquinaria:

- **Regex → AFN (Kleene)** — `regexToNfa()` dibuja en el lienzo el AFN de
  Thompson de la expresión. Sale con muchas ε a propósito: la gracia es ver la
  construcción. Los estados se colocan en **capas por distancia al inicial**
  (`modelFromAuto()`), no en círculo, porque los fragmentos de Thompson son
  cadenas largas; y se numeran en orden de lectura, para que el inicial sea
  `q0`. Ojo con el sentido de esto en la evaluación: el autómata generado es
  equivalente a `r` **por construcción**, así que comprobarlo contra `r` no
  demuestra nada — sirve para *ver* el AFN, o como punto de partida.
- **Determinizar (subconjuntos)** — `determinizeModel()` sustituye el AFN del
  lienzo por el AFD equivalente, con los estados nombrados por sus miembros
  (`{q0,q2}`). Es también la salida que se ofrece al pasar de modo AFN a AFD
  con un autómata que no es determinista.

## Convenciones

- **Español** en UI, comentarios y mensajes. Notación matemática correcta
  (`Q`, `Σ`, `δ`, `q₀`, `F`, `ε`, `⊥`).
- **Vanilla JS**, `"use strict"`, sin frameworks ni dependencias. No añadas
  ninguna: el archivo tiene que seguir abriéndose con doble clic.
- Helpers: `$`/`$$` (querySelector/All), `el(tag, attrs)` para SVG,
  `escHtml()` **siempre** antes de meter nombres de usuario en `innerHTML`.
- CSS por variables en `:root`. La tipografía es deliberadamente grande y de
  alto contraste (lienzo claro, UI oscura) porque el diagrama se proyecta y se
  lee en clase: **no reduzcas los tamaños de letra** sin motivo.
- El radio del nodo `R`, `CURVE` y `LOOP_H` están acoplados al tamaño de letra;
  si cambias uno, revisa `contentBBox()` y `edgeGeometry()`.

### Escala tipográfica

Estado actual, tras tres rondas de ampliación pedidas por el usuario. Si vuelves
a subirla, sube **todo el grupo** a la vez o la jerarquía se rompe.

| Zona | Elemento | px |
|---|---|---|
| Base | `body` | 19.5 |
| Lienzo | texto del nodo (`fontFor`, 2 caracteres) | 34 |
| Lienzo | etiqueta de arista | 26 |
| Panel | pestañas | 21 |
| Panel | tabla δ | 26 |
| Panel | bloques LaTeX/TikZ/prompt | 21 |
| Panel | entrada del simulador · cinta · traza | 28 · 32 · 24 |
| Panel | incidencias de validación | 21 |
| Lateral | chips de Σ · lista de estados | 22 · 22 |
| Lateral | títulos de sección · pistas | 16.5 · 17 |

Reglas de acompañamiento aprendidas al hacerlo:

- **El texto del nodo manda sobre la geometría.** Al subirlo hay que subir con
  él `R` (hoy 44), `LOOP_H`, `CURVE`, los marcadores de flecha, el radio del
  layout circular de `modelFromSpec()` y los márgenes de `contentBBox()`.
- El ancho del rectángulo blanco tras la etiqueta de arista se calcula a mano en
  `renderEdges()` (`length * 15.9 + 12`, ≈0.61 em por carácter en monoespaciada).
  Si cambias el tamaño de la etiqueta, recalcula ese factor.
- `fontFor()` reduce el cuerpo por tramos de longitud para que el nombre quepa
  en el círculo. Verificado numéricamente hasta 14 caracteres comparando el
  ancho del texto contra la cuerda del círculo a la altura de la línea base.
- Al crecer la letra hay que ensanchar contenedores: barra lateral 376px y panel
  inferior 410px de alto (una tabla δ de 4 estados a 26px ya no cabía en 370).
- Sólo dos elementos quedan por debajo de 15px, a propósito: la tecla rápida de
  los botones de la barra (14px) y la etiqueta de reasignación sobre un símbolo
  ya ocupado (12.5px).

### Tamaño del panel inferior

La tabla δ a 26px y el lienzo se disputan la pantalla, así que el panel tiene
tres mandos, y los tres se recuerdan entre sesiones en `localStorage`
(clave `dfa-editor-ui`, aparte del autómata):

- **arrastrar la barra gris** (`#grip`) para el alto — el mínimo bajó de 90 a
  56px; **doble clic** en ella pliega y despliega;
- **− / +** achican y agrandan el panel a saltos de 70px (`PANEL_STEP`);
- **▾ / ▴** pliega el panel dejando sólo la barra de pestañas — al pulsar
  cualquier pestaña se despliega solo;
- **Aa** activa el **modo compacto**: una hoja de estilos bajo `#panel.compact`
  que reduce la tipografía **sólo dentro del panel** (tabla 19px, código 16px,
  cinta 22px…).

El modo compacto es la única excepción admitida a la regla de no reducir los
tamaños de letra: es **opt-in**, está apagado por omisión y no toca el lienzo,
que es lo que se proyecta.

## Registro de cambios

### 2026-08-23

**Modo AFN, expresión regular y algoritmo de Kleene.** Tres peticiones del
usuario en la misma sesión: poder crear AFN, poder escribir una expresión
regular equivalente y ver si se cumple, y poder construir el AFN de una
expresión por el algoritmo de Kleene. De paso, mandos para el tamaño del panel.
Las pruebas pasaron de **165 a 278**.

**δ pasa a ser multivaluada.** El cambio de fondo: `model.delta[key(q,a)]` ya no
es un id, es un **array de ids que nunca está vacío**. Se valoró mantener el
escalar en AFD y el array en AFN, y se descartó: son dos representaciones de lo
mismo conviviendo, justo lo que este documento prohíbe. El tipo es uniforme y lo
que cambia es el **modo** (`model.kind`), que decide qué se admite. El precio
fue tocar los ~30 sitios que leían δ, y hubo que actualizar 5 pruebas que daban
por hecho el escalar; el resto pasó sin tocarlas, que era la señal de que el
refactor no se había llevado nada por delante.

- Lo que **no** cambió: el JSON. En AFD se sigue serializando el destino suelto
  (`{ q: { a: q' } }`), así que los archivos viejos y los nuevos son los mismos
  mientras el autómata sea determinista.
- `setDsts()` **borra la clave** cuando el conjunto queda vacío. Es la invariante
  que hace que `for(const k in model.delta)` siga siendo seguro en todas partes.
- Volver de AFN a AFD no mutila δ: si el autómata no es determinista, se ofrece
  determinizarlo. Rechazar la oferta deja el modo como estaba.

**Pestaña Regex: la primera comprobación semántica decidible.** Hasta ahora todo
lo semántico terminaba en «pregúntale a un LLM». Comparar `L(M)` con una
expresión regular sí es decidible, así que la pestaña no opina: Kleene/Thompson,
subconjuntos y recorrido en anchura del producto. El primer par de estados con
aceptación distinta da el contraejemplo **más corto**, con el mismo vocabulario
de falso positivo / falso negativo que ya usaba el prompt. El apartado
*Propósito* se reescribió para que esa distinción quede en el sitio de siempre.

Decisiones y trampas de esta parte:
- **El `+` no se adivina.** Unión (Hopcroft) y clausura positiva conviven en los
  apuntes. Adivinar por contexto acertaría a veces y fallaría en silencio otras,
  que en una herramienta que decide es el peor fallo posible: lo elige el
  usuario en un selector y se guarda en el modelo.
- El AFD de subconjuntos incluye **el conjunto vacío como estado**: así es total
  y el producto se recorre sin casos especiales. No se minimiza, y no hace falta.
- Un símbolo que la expresión usa y no está en Σ **no es un error**: se compara
  sobre Σ ∪ extras y se avisa. Si fuera error, el aviso más útil (la errata) se
  perdería detrás de un mensaje de sintaxis.
- Hay tope (`DET_LIMIT`) para no colgar el navegador con un 2^|Q| desbocado.

**Kleene → lienzo.** `regexToNfa()` dibuja el AFN de Thompson. Se colocan los
estados en capas por distancia al inicial en vez de en círculo (los fragmentos
de Thompson son cadenas largas) y se numeran en orden de lectura: la primera
versión los numeraba por orden de construcción y el inicial acababa llamándose
`q6`, que no hay quien lo explique en clase. Aviso que conviene no perder: ese
AFN es equivalente a `r` **por construcción**, así que comprobarlo contra `r` no
demuestra nada del diseño del alumno.

**Tamaño del panel.** Arrastrar la barra (mínimo 56px), botones **− / +** por
pasos, plegado (también con doble clic en la barra) y un modo **compacto** que
reduce la tipografía sólo dentro del panel. Es la única excepción a la regla de
no reducir los tamaños de letra: es opt-in, está apagado por omisión y no toca
el lienzo, que es lo que se proyecta. Los ajustes se recuerdan en
`localStorage` bajo `dfa-editor-ui`, aparte del autómata.

La primera versión de estos mandos eran tres glifos sueltos (`Aa`, `▁`, `▾`) en
la barra de pestañas, y el usuario dijo directamente que **faltaba la opción de
achicar el panel**: estaba, pero un glifo suelto ahí no lo encuentra nadie. Se
rehicieron como un grupo con recuadro y rótulo «Panel». Vale la pena recordarlo
antes de volver a colgar un control de un icono a secas.

**Trampa que costó un rato**: en los scripts de parcheo, `String.replace(str,str)`
interpreta `$$` en el reemplazo como un `$` literal, así que un `$$(".tab")` se
convirtió en `$(".tab")` y sólo lo cazó la prueba de humo. Si vuelves a parchear
el archivo con un script, usa la forma con función: `replace(a, () => b)`.

**Verificación.** 278/278. Secciones nuevas: 21 (δ como conjunto), 21b
(validación en AFN), 22 (simulación con ramas y ε), 23 (sintaxis de la regex),
24 y 24b (Kleene y veredicto), 25 (regex → lienzo y determinización),
26 (persistencia del AFN) y 27 (quíntupla en AFN). Además, una prueba de humo
aparte recorrió las rutas de interfaz que el arnés no toca (popover con ε, tabla
editable del AFN, prompts, panel) buscando excepciones.

**Limitación, otra vez**: no se ha abierto en un navegador de verdad. Todo está
comprobado a nivel de función y de DOM simulado, pero los gestos de ratón y el
aspecto real de la pestaña *Regex* no se han visto.

### 2026-08-03

**Segundo remoto: `arturo200907/DFA` (privado).** El usuario pidió subir el
proyecto a un repositorio llamado `DFA`; ya existía en su cuenta, vacío y
privado. Se añadió como remoto `dfa` y se empujó `main` tal cual (los tres
archivos, los dos commits). `node _verify.js` antes de empujar: 165/165.

Decisiones y trampas:
- **No se tocó `origin`.** `dfa-lab` (público) sigue existiendo con el mismo
  contenido; borrarlo o renombrarlo no era lo que se pidió.
- **El `-u` del push cambió el upstream a `dfa/main`**, así que a partir de
  ahora `git push` sin argumentos va al repo **privado**. Está documentado
  arriba, pero es justo el tipo de detalle que muerde: si el público se queda
  atrás, es por esto.
- Al repo `DFA` se le puso la misma descripción que a `dfa-lab`; su visibilidad
  privada se dejó como el usuario la había creado.
- Dos remotos con el mismo proyecto es, en el fondo, dos versiones de la verdad
  esperando a divergir. Si uno de los dos sobra, mejor archivarlo que mantener
  el doble push.

### 2026-08-02

**El proyecto pasa a git y a GitHub.** El directorio, que hasta ahora eran tres
archivos sueltos sin control de versiones, se inicializó como repositorio (rama
`main`) y se publicó como **público** en `arturo200907/dfa-lab`, con los tres
archivos tal cual estaban y un único commit inicial. Se ejecutó `node _verify.js`
antes de commitear: 165/165.

Decisiones que conviene recordar:
- **Sin `.gitignore`**: no hay build, ni `node_modules`, ni artefactos. Añadir
  uno vacío de contenido sólo sería ruido. Si algún día aparece algo generado,
  ese es el momento de crearlo.
- **`CLAUDE.md` se sube.** Es la documentación real del proyecto y no contiene
  nada privado; al ser público hace también de README de facto. No se creó un
  `README.md` aparte para no tener dos versiones de la verdad conviviendo — lo
  que este mismo documento prohíbe.
- Git avisa de la conversión LF→CRLF al hacer `add`; es el comportamiento normal
  de `core.autocrlf` en Windows y no altera lo que se sube.

### 2026-07-31

Punto de partida: `dfa-editor.html` (lienzo, tabla δ, LaTeX/TikZ, simulador,
validación, persistencia) y `_verify.js` con 94 pruebas. Todo lo de abajo se
añadió en esta sesión; las pruebas pasaron de **94 a 165**.

**`CLAUDE.md` — creado.** Con el propósito del proyecto declarado por el
usuario: *evaluar si un DFA cumple con requisitos de diseño*. Se desarrolla en
requisitos estructurales (automáticos, pestaña *Validación*) y semánticos
(lenguaje objetivo + simulador + prompt), porque esa distinción es la que
ordena qué hace cada parte de la app.

**Paleta arrastrable** (§7b). Tres elementos en la barra lateral: *Estado*,
*Estado de aceptación* y *Estado dummy*. Se arrastran al lienzo (HTML5 DnD, con
realce del área de destino) y también responden al clic, colocándose en el
centro de la vista.
- El *dummy* es el estado trampa: no acepta y se cierra sobre sí mismo con todo
  Σ, para que δ siga siendo total. Es la contrapartida manual del botón
  *Completar δ con estado trampa*.
- `addState()` recibió un cuarto parámetro `opts` y se le extrajo `uniqueName()`,
  que evita el choque de nombres (`qtrap`, `qtrap2`, …).
- Matiz de validación que conviene recordar: un dummy recién soltado sale como
  **inalcanzable**, no como *muerto*; sólo pasa a muerto cuando algo apunta a él.
  Una prueba lo daba por muerto y estaba mal la prueba, no el código.

**Bucles: conectar un estado consigo mismo** (§7). Se arrastra desde el estado,
se sale de él y se suelta encima. Requiere la salida previa (bandera
`drag.left`, con histéresis `R+16` / `R+8`) para no confundir un clic con un
bucle. Mientras el puntero vuelve sobre el origen se previsualiza el bucle real
en lugar de una recta hacia su propio centro. La banda de arrastre pasó a
`pointer-events:none` para que no intercepte el `mouseup` sobre el nodo.

**Generador de quíntupla** (§13b). Botón `⟨5⟩ Quíntupla` → diálogo con área de
texto, ayuda de formatos plegable, *Ejemplo*, *Volcar el DFA actual* y
*Generar DFA*. Detalles que costaron decidirse:
- `parseQuintuple()` devuelve `{ok, errors, warns, spec}` en vez de lanzar; así
  el diálogo muestra todos los problemas juntos y con número de línea.
- La separación **error / aviso** sigue el propósito del proyecto: no genera si
  el objeto no puede ser un DFA (no determinismo, estado fuera de `Q`, ε en Σ),
  pero sí genera avisando si δ es parcial o hubo que asumir el inicial — porque
  ver el defecto en pantalla es justamente para lo que sirve la herramienta.
- `#modal` (confirmación) subió a `z-index:120` para quedar por encima del
  diálogo de la quíntupla, que puede invocarlo.
- **Bug encontrado por las pruebas**: en el regex `ARROW`, la alternativa `=`
  iba antes que `=>` y se comía su primer carácter, dejando `> A` como nombre de
  estado. Las alternativas largas van primero.

**Prompt «dibujo → quíntupla»** (§10, `buildVisionPrompt()`). Para que un LLM
con visión lea la foto de un diagrama hecho a mano y devuelva la quíntupla lista
para pegar. Accesible desde dos sitios: botón en el diálogo ⟨5⟩ (donde se pega
el resultado) y subpestaña del panel LaTeX (para leerlo antes de copiar).
- Su instrucción central es **transcribir, no corregir**, y es deliberada: un
  LLM tiende a completar la transición que falta o a deducir el inicial, y si lo
  hace estarías evaluando su arreglo en vez de tu diagrama.
- Por eso le pide **denunciar** los defectos (pares (q,a) ausentes, dos flechas
  con el mismo símbolo, inicial múltiple o ausente) en líneas que empiezan por
  `%`, que el parser ya ignoraba.
- La subpestaña anterior pasó a llamarse *Prompt: evaluar M*: con dos prompts,
  «Prompt para LLM» se quedaba ambiguo.
- El ejemplo incrustado en el prompt **se verifica contra el propio parser** en
  las pruebas, para que no pueda desactualizarse respecto al formato aceptado.

**Robustez del parser ante salidas de LLM.** Ignora las vallas ```` ``` ```` y
las viñetas (`-`, `·`, `•`) al principio de línea. Sin esto, el pegado más
habitual fallaba con error de sintaxis.

**Tipografía, tres rondas.** Ver *Escala tipográfica*. La última fue específica
del panel inferior y la barra lateral.

**Verificación.** El arnés se amplió a 165 pruebas (sección 18 paleta, 19
parser, 19b prompt de visión y robustez, 20 generación e ida y vuelta).
Comprobaciones adicionales hechas fuera del arnés: balance de etiquetas HTML,
ausencia de IDs duplicados, llaves de CSS equilibradas y encaje numérico del
texto del nodo dentro del círculo.

**Limitación de esta sesión**: la extensión de Chrome no estaba conectada, así
que **nada se verificó visualmente en un navegador**. La capa de eventos de
ratón (arrastre de la paleta, gesto del bucle) está comprobada a nivel de
función y de referencias del DOM, pero no ejercitada con clics reales.
