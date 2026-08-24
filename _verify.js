/* Arnés de verificación: carga el <script> de dfa-editor.html en un DOM simulado
   y recorre la lista de comprobación del plan. Ejecutar con:  node _verify.js   */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "dfa-editor.html"), "utf8");
const src = /<script>\r?\n([\s\S]*?)\r?\n<\/script>/.exec(HTML)[1];

/* ---------- DOM mínimo ---------- */
const ids = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const registry = new Map();

function mkEl(tag){
  const kids = [];
  const el = {
    tagName: String(tag).toUpperCase(), children: kids, dataset: {}, style: {},
    value: "", checked: false, id: "", _text: "", _html: "",
    classes: new Set(), attrs: {},
    get className(){ return [...this.classes].join(" "); },
    set className(v){ this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get textContent(){ return this._text; },
    set textContent(v){ this._text = String(v); kids.length = 0; },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); kids.length = 0; },
    classList: {
      add: (...c) => c.forEach(x => el.classes.add(x)),
      remove: (...c) => c.forEach(x => el.classes.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !el.classes.has(c) : !!f;
                          on ? el.classes.add(c) : el.classes.delete(c); return on; },
      contains: c => el.classes.has(c)
    },
    appendChild: n => { kids.push(n); return n; },
    append: (...n) => kids.push(...n),
    remove: () => {},
    setAttribute: (k, v) => { el.attrs[k] = String(v); },
    getAttribute: k => (k in el.attrs ? el.attrs[k] : null),
    removeAttribute: k => { delete el.attrs[k]; },
    addEventListener: () => {}, removeEventListener: () => {},
    querySelector: sel => q1(sel), querySelectorAll: sel => qAll(sel),
    closest: () => null, cloneNode: () => mkEl(tag), select: () => {}, focus: () => {},
    getBoundingClientRect: () => ({ width:1000, height:640, top:0, left:0, right:1000, bottom:640 }),
    click: () => {}
  };
  return el;
}
const q1  = sel => { const m = /^#([\w-]+)$/.exec(String(sel).trim()); return m ? (registry.get(m[1]) || null) : null; };
const qAll = () => [];

for(const id of ids){ const e = mkEl("div"); e.id = id; registry.set(id, e); }

const document = {
  body: mkEl("body"),
  createElement: mkEl, createElementNS: (ns, t) => mkEl(t),
  querySelector: q1, querySelectorAll: qAll, addEventListener: () => {},
  getElementById: id => registry.get(id) || null
};
const store = new Map();
const ctx = {
  document, console,
  window: { addEventListener: () => {}, innerWidth: 1600, innerHeight: 900 },
  innerWidth: 1600, innerHeight: 900,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null),
                  setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  navigator: { clipboard: { writeText: async () => {} } },
  URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
  Blob: function(){}, Image: function(){}, FileReader: function(){},
  XMLSerializer: function(){ this.serializeToString = () => "<svg/>"; },
  setTimeout, clearTimeout, JSON, Math, Date
};
ctx.window.addEventListener = () => {};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: "dfa-editor.js" });

/* ---------- utilidades de test ---------- */
const run = code => vm.runInContext(code, ctx);
let pass = 0, fail = 0;
function check(name, cond, extra){
  if(cond){ pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (extra !== undefined ? "  → " + JSON.stringify(extra) : "")); }
}
const eq = (name, got, want) => check(name + `  [${JSON.stringify(got)}]`, JSON.stringify(got) === JSON.stringify(want), got);

console.log("\n=== 1. Arranque y carga del ejemplo (paridad de «a») ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");
eq("|Q| = 2", run("model.states.length"), 2);
eq("|Σ| = 2", run("model.alphabet.length"), 2);
eq("q0 es inicial", run("nameOf(model.initial)"), "q0");
eq("F = {q0}", run("model.states.filter(s=>s.accepting).map(s=>s.name)"), ["q0"]);

console.log("\n=== 2. Aristas derivadas de δ ===");
eq("4 aristas (2 bucles + par recíproco)", run("deriveEdges().length"), 4);
eq("símbolos q0→q1", run("deriveEdges().find(e=>nameOf(e.from)=='q0'&&nameOf(e.to)=='q1').symbols"), ["a"]);
eq("bucle q0→q0 con b", run("deriveEdges().find(e=>e.from===e.to&&nameOf(e.from)=='q0').symbols"), ["b"]);
check("par recíproco → curvado", run(
  "(()=>{const p=new Set(deriveEdges().map(e=>e.from+SEP+e.to));const e=deriveEdges().find(x=>nameOf(x.from)=='q0'&&nameOf(x.to)=='q1');return p.has(e.to+SEP+e.from);})()"));
check("bucle: geometría distinta de recta", run(
  "(()=>{const a=getState(model.initial);return edgeGeometry(a,a,false).d.includes('C');})()"));
check("curva: usa Bézier cuadrática", run(
  "(()=>{const a=model.states[0],b=model.states[1];return edgeGeometry(a,b,true).d.includes('Q');})()"));

console.log("\n=== 3. δ total y validación ===");
eq("sin pares faltantes", run("missingPairs().length"), 0);
eq("0 errores de validación", run("analyze().errs"), 0);
eq("0 avisos", run("analyze().warns"), 0);
check("mensaje «Es un AFD válido»", run("analyze().issues[0].html").includes("AFD válido"));

console.log("\n=== 4. Simulador (L = nº par de «a») ===");
const sim = s => run(`(()=>{const t=tokenize(${JSON.stringify(s)});return t.badAt>=0?'badsym':runTokens(t.tokens).status;})()`);
eq("ε      → acepta", sim(""), "accept");
eq("bb     → acepta", sim("bb"), "accept");
eq("a      → rechaza (1 a)", sim("a"), "reject");
eq("aba    → acepta  (2 a)", sim("aba"), "accept");
eq("bab    → rechaza (1 a)", sim("bab"), "reject");
eq("abba   → acepta  (2 a)", sim("abba"), "accept");
eq("aa     → acepta  (2 a)", sim("aa"), "accept");
eq("aaa    → rechaza (3 a)", sim("aaa"), "reject");
eq("babab  → acepta  (2 a)", sim("babab"), "accept");
eq("bbabb  → rechaza (1 a)", sim("bbabb"), "reject");
eq("c      → símbolo fuera de Σ", sim("c"), "badsym");
eq("traza de abba", run("runTokens(tokenize('abba').tokens).steps.map(s=>setLabel(s.from)+'-'+s.sym+'->'+setLabel(s.to))"),
   ["q0-a->q1","q1-b->q1","q1-b->q1","q1-a->q0"]);

console.log("\n=== 5. Tokenización de símbolos multicarácter ===");
run("model.alphabet=['a','ab']");
eq("«ab» usa coincidencia más larga", run("tokenize('ab').tokens"), ["ab"]);
eq("«aab» = a + ab", run("tokenize('aab').tokens"), ["a","ab"]);
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");

console.log("\n=== 6. Determinismo por construcción (reasignación) ===");
run("(()=>{const q0=model.states[0].id,q1=model.states[1].id;setDelta(q0,'b',q1);})()");
eq("δ(q0,b) ahora = q1", run("nameOf(dst(model.states[0].id,'b'))"), "q1");
eq("el bucle q0→q0 desapareció", run("deriveEdges().filter(e=>e.from===e.to&&nameOf(e.from)=='q0').length"), 0);
eq("sigue habiendo un único destino para (q0,b)",
   run("Object.keys(model.delta).filter(k=>unkey(k)[0]===model.states[0].id&&unkey(k)[1]==='b').length"), 1);
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");

console.log("\n=== 7. LaTeX ===");
const tex = run("buildTexFull()");
check("contiene la 5-tupla", tex.includes("M = (Q, \\Sigma, \\delta, q_0, F)"));
check("q0 → q_{0}", tex.includes("q_{0}"));
check("Q = { q_{0}, q_{1} }", tex.includes("Q = \\{ q_{0}, q_{1} \\}"));
check("Σ = { a, b }", tex.includes("\\Sigma = \\{ a, b \\}"));
check("F = { q_{0} }", tex.includes("F = \\{ q_{0} \\}"));
check("incluye el lenguaje objetivo", tex.includes("% Lenguaje objetivo:"));
check("entorno align*", tex.includes("\\begin{align*}") && tex.includes("\\end{align*}"));
eq("4 ecuaciones δ(q,a)=q'", (tex.match(/\\delta\(/g) || []).length, 4);
const arr = run("buildTexArray()");
check("array con 2 columnas", arr.includes("\\begin{array}{c|cc}"));
// q0 es inicial Y de aceptación → la etiqueta de fila es «\to {*}q_{0}»
check("marca → en el inicial", arr.includes("\\to {*}q_{0}"));
check("marca * sólo en los de aceptación", arr.includes("{*}q_{0}") && !arr.includes("{*}q_{1}"));
check("sin \\bot (δ total)", !arr.includes("\\bot"));
check("filas separadas por \\\\", arr.includes("\\\\"));

console.log("\n=== 8. Nombres de estado no estándar ===");
eq("q12 → q_{12}", run("texName('q12')"), "q_{12}");
eq("A → A", run("texName('A')"), "A");
eq("par_a → \\text{...} escapado", run("texName('par_a')"), "\\text{par\\_a}");
eq("símbolo '0' literal", run("texSym('0')"), "0");
eq("símbolo '#' escapado", run("texSym('#')"), "\\text{\\#}");

console.log("\n=== 9. δ parcial: se detecta y se refleja en todas las salidas ===");
run("(()=>{delete model.delta[key(model.states[1].id,'b')];commit();})()");
eq("1 par faltante", run("missingPairs().length"), 1);
eq("el par es (q1, b)", run("missingPairs().map(([q,a])=>nameOf(q)+','+a)"), ["q1,b"]);
check("validación marca error", run("analyze().errs") >= 1);
check("mensaje «δ no es total»", run("analyze().issues.map(i=>i.html).join()").includes("no es total"));
check("LaTeX muestra \\bot", run("buildTexArray()").includes("\\bot"));
check("LaTeX avisa de δ parcial", run("buildTexFull()").includes("δ es parcial"));
eq("simular «ab» → transición indefinida", sim("ab"), "undef");
check("el prompt avisa al LLM de δ parcial", run("buildPrompt()").includes("δ es parcial"));

console.log("\n=== 10. Completar con estado trampa ===");
run("$('#btnTrap').onclick()");
eq("δ vuelve a ser total", run("missingPairs().length"), 0);
eq("se creó qtrap", run("model.states.some(s=>s.name==='qtrap')"), true);
eq("qtrap absorbe (bucle en todo Σ)",
   run("(()=>{const t=model.states.find(s=>s.name==='qtrap').id;return model.alphabet.every(a=>dst(t,a)===t);})()"), true);
check("qtrap se reporta como estado muerto", run("analyze().issues.map(i=>i.html).join()").includes("muerto"));
eq("0 errores tras completar", run("analyze().errs"), 0);
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");

console.log("\n=== 11. Estados inalcanzables ===");
run("addState(500,300,'zz')");
check("se detecta 1 inalcanzable", run("analyze().issues.map(i=>i.html).join()").includes("inalcanzable"));
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");

console.log("\n=== 12. Prompt para el LLM ===");
const pr = run("buildPrompt()");
check("incluye el autómata en LaTeX", pr.includes("--- AUTÓMATA ---") && pr.includes("\\begin{array}"));
check("incluye L objetivo", pr.includes("número par de a"));
check("pide el contraejemplo más corto", pr.includes("CONTRAEJEMPLO MÁS CORTA"));
check("distingue falso positivo/negativo", pr.includes("falso positivo") && pr.includes("falso negativo"));

console.log("\n=== 13. TikZ ===");
const tz = run("buildTikz()");
check("usa la librería automata", tz.includes("automata"));
check("nodo initial", tz.includes("initial"));
check("nodo accepting", tz.includes("accepting"));
check("bucle → loop above", tz.includes("loop above"));
check("par recíproco → bend left", tz.includes("bend left"));
check("cierra el tikzpicture", tz.trim().endsWith("\\end{tikzpicture}"));

console.log("\n=== 14. Persistencia: ida y vuelta JSON ===");
run("model.states[0].x=-123; model.states[0].y=45; save()");
const before = run("JSON.stringify(model)");
run("loadModel(JSON.parse(localStorage.getItem(STORE_KEY)))");
eq("el modelo se conserva íntegro", run("JSON.stringify(model)"), before);
eq("posiciones conservadas", run("[model.states[0].x, model.states[0].y]"), [-123, 45]);
eq("autoguardado tras commit", store.has("dfa-editor-v1"), true);
check("las claves de δ sobreviven al JSON", run("Object.keys(model.delta).length") === 4);
eq("δ exportada en forma anidada legible", run("serializeModel().delta"),
   { s1:{ a:"s2", b:"s1" }, s2:{ a:"s1", b:"s2" } });
check("el JSON exportado no contiene \\u0000",
   !JSON.stringify(run("serializeModel()")).includes("\\u0000"));
run(`loadModel({states:[{id:'s1',name:'q0',x:0,y:0,accepting:true}],alphabet:['a'],
       initial:'s1', delta:{['s1'+SEP+'a']:'s1'}})`);
eq("sigue leyendo el formato plano heredado", run("Object.keys(model.delta).length"), 1);

console.log("\n=== 15. Import defensivo (datos corruptos) ===");
run(`loadModel({states:[{id:'x1',name:'A',x:0,y:0,accepting:true}],alphabet:['a'],
       initial:'NO_EXISTE', delta:{['x1'+SEP+'a']:'FANTASMA', ['x1'+SEP+'z']:'x1'}})`);
eq("descarta el destino inexistente", run("Object.keys(model.delta).length"), 0);
eq("descarta el inicial inválido", run("model.initial"), null);
eq("conserva el estado válido", run("model.states.length"), 1);
check("y lo reporta como error", run("analyze().errs") >= 1);

console.log("\n=== 16. Alfabeto ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE))); addSymbols('c d')");
eq("Σ = {a,b,c,d}", run("model.alphabet"), ["a","b","c","d"]);
eq("añadir Σ crea pares faltantes", run("missingPairs().length"), 4);
run("addSymbols('a')");
eq("no duplica «a»", run("model.alphabet.length"), 4);
run("addSymbols('ε')");
eq("rechaza ε", run("model.alphabet.includes('ε')"), false);
run("model.alphabet=['a','b']; for(const k in model.delta) if(!['a','b'].includes(unkey(k)[1])) delete model.delta[k]; commit()");
eq("volver a Σ={a,b} deja δ total", run("missingPairs().length"), 0);

console.log("\n=== 17. Render sin excepciones (tabla, LaTeX, validación, simulador) ===");
try{ run("commit()"); check("commit() completo sin errores", true); }
catch(e){ check("commit() completo sin errores", false, e.message); }
check("#texOut recibió contenido", String(run("$('#texOut').textContent")).length > 100);
check("#tableBox tiene la tabla", run("$('#tableBox').children.length") === 1);
check("#valOut tiene incidencias", run("$('#valOut').children.length") >= 1);
check("badge de validación en 0", run("$('#valBadge').textContent") === "0");

console.log("\n=== 18. Paleta: estado, aceptación y dummy ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");
run("dropPalette('normal', 0, 300)");
eq("«Estado» normal no acepta", run("model.states[model.states.length-1].accepting"), false);
run("dropPalette('accept', 200, 300)");
eq("«Estado de aceptación» entra en F", run("model.states[model.states.length-1].accepting"), true);
run("dropPalette('trap', 400, 300)");
eq("el dummy se llama qtrap", run("model.states[model.states.length-1].name"), "qtrap");
eq("el dummy nunca acepta", run("model.states[model.states.length-1].accepting"), false);
eq("el dummy es absorbente en todo Σ",
   run("(()=>{const t=model.states[model.states.length-1].id;return model.alphabet.every(a=>dst(t,a)===t);})()"), true);
// Recién soltado nadie apunta al dummy: la validación debe verlo inalcanzable.
check("el dummy recién soltado se reporta inalcanzable",
      run("analyze().issues.map(i=>i.html).join()").includes("inalcanzable"));
// En cuanto se le redirige una transición pasa a ser un estado muerto (trampa).
run("(()=>{const t=model.states.find(s=>s.name==='qtrap').id;setDelta(model.states[0].id,'a',t);})()");
check("con una transición entrante pasa a ser estado muerto",
      run("analyze().issues.map(i=>i.html).join()").includes("muerto"));
run("dropPalette('trap', 600, 300)");
eq("un segundo dummy no choca de nombre", run("model.states[model.states.length-1].name"), "qtrap2");
eq("uniqueName respeta los nombres libres", run("uniqueName('zz')"), "zz");
eq("la paleta coloca en la posición pedida",
   run("(()=>{const s=model.states.find(s=>s.name==='qtrap');return [s.x,s.y];})()"), [400, 300]);

console.log("\n=== 19. Parser de la quíntupla ===");
const P = txt => run(`parseQuintuple(${JSON.stringify(txt)})`);

const p1 = P(`Q = {q0, q1, q2}
Σ = {a, b}
q0 = q0
F = {q2}
L = { w : w termina en ab }
δ(q0, a) = q1
δ(q0, b) = q0
δ(q1, a) = q1
δ(q1, b) = q2
δ(q2, a) = q1
δ(q2, b) = q0`);
eq("quíntupla canónica: sin errores", p1.errors, []);
eq("Q leído", p1.spec.Q, ["q0","q1","q2"]);
eq("Σ leído", p1.spec.S, ["a","b"]);
eq("q0 leído", p1.spec.q0, "q0");
eq("F leído", p1.spec.F, ["q2"]);
eq("6 transiciones", p1.spec.delta.length, 6);
check("L va al lenguaje objetivo", p1.spec.language.includes("termina en ab"));
eq("δ total ⇒ sin avisos", p1.warns, []);

eq("acepta «->», «,» y espacios como notación de δ",
   P("Q={A,B}\nΣ={0,1}\nq0=A\nF={B}\nA, 0 -> B\n(A,1) => A\nB 0 -> B\nB 1 A").errors, []);
eq("acepta d(...) y delta(...)",
   P("Q={A}\nΣ={0}\nq0=A\nF={}\nd(A,0)=A").errors, []);

const pt = P(`Σ = {a, b}
δ    | a  | b
->q0 | q1 | q0
*q1  | q1 | q0`);
eq("tabla: sin errores", pt.errors, []);
eq("tabla: Q deducido de las filas", pt.spec.Q, ["q0","q1"]);
eq("tabla: «->» marca el inicial", pt.spec.q0, "q0");
eq("tabla: «*» marca la aceptación", pt.spec.F, ["q1"]);
eq("tabla: 4 transiciones", pt.spec.delta.length, 4);

const pi = P("q0 a q1\nq0 b q0\nq1 a q1\nq1 b q0");
eq("deduce Q sin declararlo", pi.spec.Q, ["q0","q1"]);
eq("deduce Σ sin declararlo", pi.spec.S, ["a","b"]);
eq("sin inicial declarado ⇒ toma el primero", pi.spec.q0, "q0");
check("y avisa de ello", pi.warns.join().includes("estado inicial"));

const pm = P("M = ({q0,q1}, {a,b}, δ, q0, {q1})\nδ(q0,a)=q1\nδ(q0,b)=q0\nδ(q1,a)=q1\nδ(q1,b)=q0");
eq("tupla en una línea: sin errores", pm.errors, []);
eq("tupla en una línea: Q", pm.spec.Q, ["q0","q1"]);
eq("tupla en una línea: F", pm.spec.F, ["q1"]);

const pnd = P("Q={A,B}\nΣ={0}\nq0=A\nF={B}\nδ(A,0)=A\nδ(A,0)=B");
check("rechaza el no determinismo", pnd.ok === false);
check("y lo explica", pnd.errors.join().includes("No determinista"));

const pbad = P("Q={A}\nΣ={0}\nq0=A\nF={B}\nδ(A,0)=Z");
check("detecta F fuera de Q", pbad.errors.join().includes("F contiene"));
check("detecta destino fuera de Q", pbad.errors.join().includes("«Z» no está en Q"));

check("δ parcial ⇒ aviso, no error",
  (()=>{ const r = P("Q={A,B}\nΣ={0,1}\nq0=A\nF={B}\nδ(A,0)=B");
         return r.ok && r.warns.join().includes("δ es parcial"); })());
check("rechaza ε en Σ", P("Q={A}\nΣ={a, ε}\nq0=A\nF={}\nδ(A,a)=A").errors.join().includes("ε"));
check("señala la línea que no entiende", P("Q={A}\nesto no es nada").errors.join().includes("Línea 2"));
eq("q_{0} de LaTeX se normaliza a q0",
   P("Q = \\{ q_{0} \\}\nΣ = {a}\nq0 = q_{0}\nF = {}\n\\delta(q_{0}, a) = q_{0}").spec.Q, ["q0"]);
eq("acepta claves en español (Estados/Alfabeto/Inicial/Finales)",
   P("Estados = {A,B}\nAlfabeto = {x}\nInicial = B\nFinales = {A}\nδ(A,x)=B\nδ(B,x)=A").spec.q0, "B");

console.log("\n=== 19b. Prompt «dibujo → quíntupla» y robustez ante salidas de LLM ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");
const vp = run("buildVisionPrompt()");
check("dice que transcriba, no que corrija", vp.includes("no lo que crees que debería estar"));
check("explica el círculo doble = aceptación", vp.includes("Círculo doble"));
check("explica la flecha suelta = inicial", vp.includes("marca el inicial"));
check("explica el lazo = transición a sí mismo", vp.includes("vuelve a él"));
check("prohíbe inventar transiciones", vp.includes("NO los inventes"));
check("pide avisar del no determinismo", vp.includes("rompe el determinismo"));
check("prohíbe los subíndices q₀", vp.includes("no q₀"));
check("pide sólo el bloque, sin ```", vp.includes("nada de ```"));
check("ofrece «%» para las notas", vp.includes("empiecen por «%»"));
check("incluye Σ actual como pista", vp.includes("Σ = {a, b}"));
check("incluye L objetivo como pista", vp.includes("número par de a"));
check("acota las pistas a desambiguar", vp.includes("nunca para cambiar lo que está dibujado"));
// El ejemplo incrustado en el prompt debe ser válido para el propio parser.
const vex = vp.slice(vp.indexOf("Q = {q0, q1, q2}"), vp.indexOf("REGLAS DEL FORMATO")).trim();
eq("el ejemplo del prompt se parsea sin errores", run(`parseQuintuple(${JSON.stringify(vex)}).errors`), []);
eq("…y describe un DFA con δ total", run(`parseQuintuple(${JSON.stringify(vex)}).warns`), []);

// Salida típica de un LLM: vallas ```, viñetas y notas con %
const llm = "```\n" +
  "Q = {A, B}\n- Σ = {0, 1}\nq0 = A\nF = {B}\n" +
  "· δ(A, 0) = B\nδ(A, 1) = A\nδ(B, 0) = B\nδ(B, 1) = A\n" +
  "```\n% El símbolo de la flecha inferior no se leía bien; supuse 1.";
const pl = P(llm);
eq("ignora las vallas ``` y las viñetas", pl.errors, []);
eq("lee los 2 estados", pl.spec.Q, ["A","B"]);
eq("lee las 4 transiciones", pl.spec.delta.length, 4);
eq("ignora las notas con %", pl.warns, []);

console.log("\n=== 20. Generación del modelo desde la quíntupla ===");
run(`loadModel(modelFromSpec(parseQuintuple(${JSON.stringify(
`Q = {q0, q1, q2}
Σ = {a, b}
q0 = q0
F = {q2}
δ(q0,a)=q1
δ(q0,b)=q0
δ(q1,a)=q1
δ(q1,b)=q2
δ(q2,a)=q1
δ(q2,b)=q0`)}).spec))`);
eq("|Q| = 3", run("model.states.length"), 3);
eq("δ total tras generar", run("missingPairs().length"), 0);
eq("0 errores de validación", run("analyze().errs"), 0);
eq("F = {q2}", run("model.states.filter(s=>s.accepting).map(s=>s.name)"), ["q2"]);
eq("«ab» se acepta (termina en ab)", sim("ab"), "accept");
eq("«aab» se acepta", sim("aab"), "accept");
eq("«aba» se rechaza", sim("aba"), "reject");
eq("«b» se rechaza", sim("b"), "reject");
check("los estados no se solapan (layout circular)", run(
  "model.states.every((s,i)=>model.states.every((t,j)=>i===j||Math.hypot(s.x-t.x,s.y-t.y)>2*R))"));
eq("el volcado del modelo vuelve a parsearse sin errores",
   run("parseQuintuple(tupleFromModel()).errors"), []);
eq("ida y vuelta: mismo |δ|",
   run("parseQuintuple(tupleFromModel()).spec.delta.length"), 6);
eq("ida y vuelta: mismo Q", run("parseQuintuple(tupleFromModel()).spec.Q"),
   run("model.states.map(s=>s.name)"));

console.log("\n=== 21. δ como conjunto de destinos · modo AFN ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA)))");
eq("el ejemplo se carga en modo AFN", run("model.kind"), "nfa");
eq("δ(q0,a) = {q0,q1}", run("dsts(model.states[0].id,'a').map(nameOf)"), ["q0","q1"]);
eq("δ(q1,a) = ∅", run("dsts(model.states[1].id,'a')"), []);
eq("1 par no determinista", run("nondetPairs().length"), 1);
eq("ninguna transición ε todavía", run("epsTransitions().length"), 0);
eq("Σ ∪ {ε} etiqueta las transiciones en AFN", run("transSymbols()"), ["a","b","ε"]);
eq("sin transiciones ε, la columna ε no se muestra", run("deltaColumns(false)"), ["a","b"]);
eq("…pero sí al editar la tabla (es donde se crean)", run("deltaColumns(true)"), ["a","b","ε"]);
run("addDelta(model.states[1].id, EPS, model.states[2].id)");
eq("en cuanto hay una ε, la columna aparece sola", run("deltaColumns(false)"), ["a","b","ε"]);
check("y el LaTeX la incluye", run("buildTexArray()").includes("varepsilon"));
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA)))");
eq("la celda muestra el conjunto", run("cellText(dsts(model.states[0].id,'a'))"), "{q0, q1}");
eq("la celda vacía es ∅ en AFN", run("cellText([])"), "∅");
eq("3 aristas derivadas (q0→q0, q0→q1, q1→q2)", run("deriveEdges().length"), 3);
run("setDsts(model.states[0].id,'b',[model.states[1].id,model.states[1].id,model.states[0].id])");
eq("setDsts quita repetidos y ordena como Q", run("dsts(model.states[0].id,'b').map(nameOf)"), ["q0","q1"]);
run("setDsts(model.states[0].id,'b',['FANTASMA'])");
eq("setDsts descarta destinos inexistentes ⇒ borra la clave",
   run("(key(model.states[0].id,'b') in model.delta)"), false);
check("δ nunca guarda arrays vacíos",
   run("Object.keys(model.delta).every(k=>Array.isArray(model.delta[k])&&model.delta[k].length>0)"));
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA))); toggleDelta(model.states[0].id,'b',model.states[1].id)");
eq("toggleDelta acumula en AFN", run("dsts(model.states[0].id,'b').map(nameOf)"), ["q0","q1"]);
run("toggleDelta(model.states[0].id,'b',model.states[1].id)");
eq("y vuelve a quitarlo", run("dsts(model.states[0].id,'b').map(nameOf)"), ["q0"]);
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE))); toggleDelta(model.states[0].id,'b',model.states[1].id)");
eq("en AFD toggleDelta reasigna, no acumula", run("dsts(model.states[0].id,'b').map(nameOf)"), ["q1"]);

console.log("\n=== 21b. Validación en modo AFN ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA)))");
eq("0 errores", run("analyze().errs"), 0);
eq("0 avisos", run("analyze().warns"), 0);
check("dice que es un AFN válido", run("analyze().issues[0].html").includes("AFN válido"));
check("informa del no determinismo sin llamarlo error",
      run("analyze().issues.map(i=>i.lv+':'+i.html).join()").includes("info:") &&
      run("analyze().issues.map(i=>i.html).join()").includes("no deterministas"));
check("δ(q,a) = ∅ no es un defecto en AFN",
      run("analyze().issues.map(i=>i.html).join()").includes("no</b> es un defecto"));
check("hay pares sin destino (que en AFD serían error)", run("missingPairs().length") > 0);
// El mismo autómata declarado AFD sí debe protestar.
run("model.kind='dfa'");
check("el mismo δ en modo AFD da error de determinismo",
      run("analyze().issues.map(i=>i.html).join()").includes("No es determinista"));
run("model.kind='nfa'");

console.log("\n=== 22. Simulación de un AFN (ramas y ε) ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA)))");
eq("ab    → acepta", sim("ab"), "accept");
eq("aab   → acepta", sim("aab"), "accept");
eq("bbab  → acepta", sim("bbab"), "accept");
eq("aba   → rechaza", sim("aba"), "reject");
eq("b     → rechaza", sim("b"), "reject");
eq("ε     → rechaza", sim(""), "reject");
eq("la traza lleva conjuntos",
   run("runTokens(tokenize('aab').tokens).steps.map(s=>setLabel(s.to))"),
   ["{q0, q1}","{q0, q1}","{q0, q2}"]);
run(`loadModel({kind:'nfa',alphabet:['a'],initial:'s1',
  states:[{id:'s1',name:'q0',x:0,y:0,accepting:false},{id:'s2',name:'q1',x:200,y:0,accepting:true}],
  delta:{s1:{'ε':['s2']}}})`);
eq("la ε-clausura del inicial arrastra q1", run("closureOf([model.initial]).map(nameOf)"), ["q0","q1"]);
eq("ε se acepta por la transición vacía", sim(""), "accept");
eq("«a» bloquea todas las ramas", sim("a"), "blocked");
eq("1 transición ε detectada", run("epsTransitions().length"), 1);

console.log("\n=== 23. Sintaxis de la expresión regular ===");
const RP = (r, alpha, plusUnion) => run(`reParse(${JSON.stringify(r)}, ${JSON.stringify(alpha||["a","b"])}, ${plusUnion === undefined ? true : plusUnion})`);
check("(a|b)*ab es válida", RP("(a|b)*ab").ok);
eq("la raíz es una concatenación", RP("(a|b)*ab").ast.t, "cat");
eq("precedencia: ab|c = (ab)|c", [RP("ab|c",["a","b","c"]).ast.t, RP("ab|c",["a","b","c"]).ast.a.t], ["alt","cat"]);
eq("precedencia: ab* = a(b*)", RP("ab*").ast.b.t, "star");
check("paréntesis sin cerrar ⇒ error", RP("(ab").ok === false);
check("«*» sin operando ⇒ error", RP("*a").ok === false);
check("«|» sin operando ⇒ error", RP("a|").ok === false);
check("expresión vacía ⇒ error, no excepción", RP("").ok === false);
check("basura no cuelga el parser", RP("))((").errors.length > 0);
eq("símbolo fuera de Σ: se avisa pero se acepta", RP("abc").extra, ["c"]);
check("ε y ∅ se reconocen", RP("ε|∅").ok);
eq("«+» como unión", RP("a+b", ["a","b"], true).ast.t, "alt");
eq("«+» como clausura positiva", RP("a+", ["a","b"], false).ast.t, "plus");
eq("comillas para un símbolo que choca con un operador",
   RP("'+'", ["+"], true).ast, { t:"sym", v:"+" });
eq("símbolos multicarácter por coincidencia más larga",
   RP("ab", ["a","ab"], true).ast, { t:"sym", v:"ab" });

console.log("\n=== 24. Kleene/Thompson y equivalencia ===");
const reAcc = (r, w, alpha, plusUnion) => run(`(()=>{
  const A = ${JSON.stringify(alpha || ["a","b"])};
  const pr = reParse(${JSON.stringify(r)}, A, ${plusUnion === undefined ? true : plusUnion});
  if(!pr.ok) return "ERROR: " + pr.errors[0];
  const D = determinize(thompson(pr.ast), A);
  let i = D.start;
  for(const c of ${JSON.stringify(w)}) i = D.trans[i].get(c);
  return D.accept.has(i);
})()`);
eq("(a|b)*ab acepta «ab»",  reAcc("(a|b)*ab","ab"),  true);
eq("(a|b)*ab acepta «bbab»",reAcc("(a|b)*ab","bbab"),true);
eq("(a|b)*ab rechaza «aba»",reAcc("(a|b)*ab","aba"), false);
eq("(a|b)*ab rechaza ε",    reAcc("(a|b)*ab",""),    false);
eq("a* acepta ε",           reAcc("a*",""),          true);
eq("a* acepta «aaa»",       reAcc("a*","aaa"),       true);
eq("a⁺ rechaza ε",          reAcc("a+","", ["a","b"], false), false);
eq("a⁺ acepta «a»",         reAcc("a+","a",["a","b"], false), true);
eq("a? acepta ε y «a»", [reAcc("a?",""), reAcc("a?","a")], [true,true]);
eq("a? rechaza «aa»",       reAcc("a?","aa"),        false);
eq("∅ no acepta ni ε",      reAcc("∅",""),           false);
eq("ε acepta sólo la cadena vacía", [reAcc("ε",""), reAcc("ε","a")], [true,false]);
eq("(ab)* acepta «abab»",   reAcc("(ab)*","abab"),   true);
eq("(ab)* rechaza «aba»",   reAcc("(ab)*","aba"),    false);

console.log("\n=== 24b. Veredicto sobre el autómata del lienzo ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA)))");
eq("AFN «termina en ab» ≡ (a|b)*ab", run("regexReport().state"), "ok");
run("model.regex='r = (a|b)*ab'");
eq("se admite el prefijo «r = » de los apuntes", run("regexReport().state"), "ok");
run("model.regex='(a|b)*ba'");
const dif = run("regexReport()");
eq("con (a|b)*ba ya no coinciden", dif.state, "diff");
eq("el contraejemplo tiene longitud 2", dif.word.length, 2);
check("y está en un lado sólo", dif.inM !== dif.inR);
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE))); model.regex='b*(ab*ab*)*'; model.regexPlus='union'");
eq("AFD «nº par de a» ≡ b*(ab*ab*)*", run("regexReport().state"), "ok");
run("model.regex='(bb)*'");
const dif2 = run("regexReport()");
eq("con (bb)* el contraejemplo más corto es «b»", dif2.word.join(""), "b");
eq("«b» lo acepta el autómata pero no la expresión: falso positivo",
   [dif2.inM, dif2.inR], [true, false]);
run("model.regex='(a|b'");
eq("expresión mal escrita ⇒ estado de error", run("regexReport().state"), "error");
run("model.regex='c*'");
check("símbolo fuera de Σ ⇒ se avisa", run("regexReport().warns").join().includes("no están en Σ"));
run("model.regex=''");
eq("sin expresión ⇒ sin veredicto", run("regexReport().state"), "empty");
try{ run("renderRegex()"); check("renderRegex() no lanza", true); }
catch(e){ check("renderRegex() no lanza", false, e.message); }

console.log("\n=== 25. Regex → AFN en el lienzo (Kleene) y determinización ===");
run("model.states=[]; model.delta={}; model.initial=null; model.regex='(a|b)*ab'; model.regexPlus='union'; regexToNfa()");
eq("el autómata construido está en modo AFN", run("model.kind"), "nfa");
check("usa transiciones ε (es Thompson)", run("epsTransitions().length") > 0);
check("un único estado de aceptación", run("model.states.filter(s=>s.accepting).length") === 1);
eq("por construcción, L(M) = L(r)", run("regexReport().state"), "ok");
eq("y simula bien: «ab» acepta", sim("ab"), "accept");
eq("«aba» rechaza", sim("aba"), "reject");
check("los estados no se solapan (capas por distancia)", run(
  "model.states.every((s,i)=>model.states.every((t,j)=>i===j||Math.hypot(s.x-t.x,s.y-t.y)>2*R))"));
run("determinizeModel()");
eq("tras determinizar, modo AFD", run("model.kind"), "dfa");
eq("δ es total", run("missingPairs().length"), 0);
eq("0 errores de validación", run("analyze().errs"), 0);
eq("el AFD sigue siendo equivalente a la expresión", run("regexReport().state"), "ok");
eq("«bbab» acepta", sim("bbab"), "accept");
eq("«ba» rechaza", sim("ba"), "reject");
check("los subconjuntos se nombran con sus miembros",
      run("model.states.some(s=>s.name.startsWith('{'))"));

console.log("\n=== 26. Persistencia del AFN ===");
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE_NFA))); save()");
run("loadModel(JSON.parse(localStorage.getItem(STORE_KEY)))");
eq("el modo sobrevive al JSON", run("model.kind"), "nfa");
eq("δ se serializa anidada con conjuntos", run("serializeModel().delta"),
   { s1:{ a:["s1","s2"], b:["s1"] }, s2:{ b:["s3"] } });
eq("la regex y el papel de «+» sobreviven", [run("model.regex"), run("model.regexPlus")],
   ["(a|b)*ab", "union"]);
eq("δ(q0,a) sigue teniendo 2 destinos", run("dsts(model.states[0].id,'a').length"), 2);
run(`loadModel({kind:'dfa',alphabet:['a'],initial:'s1',
  states:[{id:'s1',name:'q0',x:0,y:0,accepting:true},{id:'s2',name:'q1',x:100,y:0,accepting:false}],
  delta:{s1:{a:['s1','s2'],'ε':['s2']}}})`);
eq("un AFN cargado como AFD conserva un solo destino", run("dsts('s1','a').length"), 1);
eq("y pierde la transición ε", run("epsTransitions().length"), 0);
eq("ε nunca entra en Σ al cargar",
   run("(()=>{loadModel({kind:'nfa',alphabet:['a','ε'],states:[{id:'s1',name:'q0',x:0,y:0,accepting:true}],initial:'s1',delta:{}});return model.alphabet;})()"),
   ["a"]);

console.log("\n=== 27. Quíntupla en modo AFN ===");
const PN = txt => run(`parseQuintuple(${JSON.stringify(txt)}, "nfa")`);
const pn1 = PN("Q={q0,q1,q2}\nΣ={a,b}\nq0=q0\nF={q2}\nδ(q0,a)={q0,q1}\nδ(q0,b)=q0\nδ(q1,b)=q2");
eq("AFN: la quíntupla se lee sin errores", pn1.errors, []);
eq("δ(q0,a) = {q0,q1} da 2 transiciones", pn1.spec.delta.length, 4);
check("δ parcial no se avisa en AFN", !pn1.warns.join().includes("parcial"));
eq("el spec recuerda el modo", pn1.spec.kind, "nfa");
const pn2 = PN("Q={A,B}\nΣ={a}\nq0=A\nF={B}\nδ(A,ε)=B\nδ(A,a)=A");
eq("AFN: acepta transiciones ε", pn2.errors, []);
check("la ε no se cuela en Σ", pn2.spec.S.includes("ε") === false);
check("Σ = {a, ε} ⇒ aviso y se limpia",
      PN("Q={A}\nΣ={a,ε}\nq0=A\nF={}\nδ(A,a)=A").warns.join().includes("ε"));
check("en modo AFD la ε sigue siendo un error",
      run(`parseQuintuple("Q={A,B}\\nΣ={a}\\nq0=A\\nF={B}\\nδ(A,ε)=B", "dfa")`).errors.join().includes("ε"));
const pn3 = PN("δ    | a       | b\n->q0 | {q0,q1} | q0\n*q1  | ∅       | q1");
eq("tabla con conjuntos y ∅: sin errores", pn3.errors, []);
eq("tabla: 4 transiciones", pn3.spec.delta.length, 4);
run(`loadModel(modelFromSpec(parseQuintuple("Q={q0,q1}\\nΣ={a}\\nq0=q0\\nF={q1}\\nδ(q0,a)={q0,q1}", "nfa").spec))`);
eq("el modelo generado está en modo AFN", run("model.kind"), "nfa");
eq("y δ(q0,a) tiene 2 destinos", run("dsts(model.states[0].id,'a').length"), 2);
eq("el volcado del AFN se vuelve a parsear sin errores",
   run(`parseQuintuple(tupleFromModel(), "nfa").errors`), []);
eq("ida y vuelta: mismo número de transiciones",
   run(`parseQuintuple(tupleFromModel(), "nfa").spec.delta.length`), 2);

console.log(`\n──────────────────────────────\n  ${pass} correctas, ${fail} fallidas\n──────────────────────────────`);
process.exit(fail ? 1 : 0);
