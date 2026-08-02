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
check("mensaje «Es un DFA válido»", run("analyze().issues[0].html").includes("DFA válido"));

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
eq("traza de abba", run("runTokens(tokenize('abba').tokens).steps.map(s=>nameOf(s.from)+'-'+s.sym+'->'+nameOf(s.to))"),
   ["q0-a->q1","q1-b->q1","q1-b->q1","q1-a->q0"]);

console.log("\n=== 5. Tokenización de símbolos multicarácter ===");
run("model.alphabet=['a','ab']");
eq("«ab» usa coincidencia más larga", run("tokenize('ab').tokens"), ["ab"]);
eq("«aab» = a + ab", run("tokenize('aab').tokens"), ["a","ab"]);
run("loadModel(JSON.parse(JSON.stringify(EXAMPLE)))");

console.log("\n=== 6. Determinismo por construcción (reasignación) ===");
run("(()=>{const q0=model.states[0].id,q1=model.states[1].id;setDelta(q0,'b',q1);})()");
eq("δ(q0,b) ahora = q1", run("nameOf(model.delta[key(model.states[0].id,'b')])"), "q1");
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
   run("(()=>{const t=model.states.find(s=>s.name==='qtrap').id;return model.alphabet.every(a=>model.delta[key(t,a)]===t);})()"), true);
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
   run("(()=>{const t=model.states[model.states.length-1].id;return model.alphabet.every(a=>model.delta[key(t,a)]===t);})()"), true);
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

console.log(`\n──────────────────────────────\n  ${pass} correctas, ${fail} fallidas\n──────────────────────────────`);
process.exit(fail ? 1 : 0);
