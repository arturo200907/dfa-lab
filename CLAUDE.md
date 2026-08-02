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

**El objetivo principal de este proyecto es poder evaluar si un DFA cumple con
requisitos de diseño.** No es sólo un editor de diagramas: es una herramienta de
comprobación. Todo lo demás (lienzo, tabla, LaTeX) existe para alimentar esa
evaluación.

Los "requisitos de diseño" que la herramienta comprueba son de dos clases:

1. **Requisitos estructurales** — que el objeto sea de verdad un DFA. Se
   verifican de forma automática y continua en la pestaña *Validación*:
   - `δ : Q × Σ → Q` es una función **total** (definida para todo par `(q,a)`);
     los pares que faltan se marcan como error y se listan.
   - Existe **exactamente un** estado inicial.
   - El **determinismo está garantizado por construcción** (ver Arquitectura):
     la clave `(q,a)` sólo admite un destino, así que es imposible dibujar un NFA.
   - `Σ` no contiene ε.
   - Higiene del autómata: estados **inalcanzables** desde `q0` y estados
     **muertos** (desde los que nunca se alcanza `F`) se reportan como avisos,
     no como errores — un estado muerto es legítimo si actúa de trampa.

2. **Requisitos semánticos** — que `L(M)` sea el lenguaje que se pretendía.
   Esto no es decidible sin una especificación, así que la herramienta ofrece
   tres vías complementarias:
   - El campo **Lenguaje objetivo L** de la barra lateral, en palabras o notación.
   - El **simulador** (paso a paso, con traza y cinta) y la **prueba por lotes**,
     para contrastar cadenas concretas contra la intención.
   - La subpestaña **Prompt: evaluar M** (`buildPrompt`), que empaqueta el
     autómata en LaTeX junto con `L` y pide el **contraejemplo más corto**,
     distinguiendo falso positivo (`w ∈ L(M)`, `w ∉ L`) de falso negativo.

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
Son 165 comprobaciones en 21 secciones: modelo, aristas derivadas, simulador,
LaTeX/TikZ, validación, persistencia, import defensivo, paleta, parser de la
quíntupla, prompt de transcripción y generación con ida y vuelta.

Si añades una funcionalidad, añade también su sección de pruebas. El arnés ya ha
cazado dos defectos reales que la lectura del código no vio.

## Repositorio

El proyecto vive en **https://github.com/arturo200907/dfa-lab** (público, rama
`main`). El directorio de trabajo es un repositorio git desde el 2026-08-02.

Pasa `node _verify.js` **antes** de cada commit: al ser público, el HTML que se
sube es el que alguien puede abrir directamente.

## Arquitectura

El `<script>` está dividido en secciones numeradas con banner de comentario
(`1. MODELO`, `2. UTILIDADES DE UI`, …, `14. PESTAÑAS…`). Respeta esa
numeración y coloca el código nuevo en su sección.

### La invariante central: δ es la única fuente de verdad

```js
model.delta[ key(q, a) ] = q'    // key(q,a) = q + SEP + a, con SEP = "\u0000"
```

Las **aristas del diagrama son una vista derivada** (`deriveEdges()` agrupa δ
por par origen/destino). De aquí salen dos consecuencias que hay que preservar:

- **El no determinismo es imposible por construcción.** La clave `(q,a)` sólo
  admite un valor. Asignar un símbolo ya usado lo *reasigna* y avisa con un
  toast; nunca duplica. No introduzcas una estructura de aristas paralela.
- Para cambiar el autómata, escribe en `model.delta` y llama a `commit()`.
  `commit()` re-renderiza todo lo derivado (lienzo, lista, tabla, LaTeX,
  validación, simulador) y persiste en `localStorage`.

El modelo:

```js
{ formatVersion, alphabet:[sym], states:[{id,name,x,y,accepting}], initial:id, delta:{}, language }
```

`states[].id` es interno (`s1`, `s2`, …); `name` es lo que ve el usuario. Usa
`nameOf(id)` para mostrar. En el JSON exportado δ se serializa **anidada**
(`{ q: { a: q' } }`) para que el archivo sea legible; `loadModel` sigue leyendo
el formato plano heredado.

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

## Funcionalidades y dónde viven

| Funcionalidad | Entrada en el código |
|---|---|
| Paleta arrastrable (estado / aceptación / dummy) | §7b, `dropPalette()` |
| Bucles (estado consigo mismo) | §7, `startEdgeDrag`/`mousemove`/`mouseup`, bandera `drag.self` |
| Quíntupla → autómata | §13b, `parseQuintuple()` + `modelFromSpec()` |
| Autómata → quíntupla | §13b, `tupleFromModel()` |
| Prompt para transcribir un dibujo | §10, `buildVisionPrompt()` |
| Validación de diseño | §12, `analyze()` |
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
con el propósito del proyecto, distingue **error** (no genera: no determinismo,
estado fuera de `Q`, ε en Σ) de **aviso** (sí genera: δ parcial, inicial
asumido). `modelFromSpec()` coloca los estados en círculo, con el primero a la
izquierda.

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

## Registro de cambios

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
