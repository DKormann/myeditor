import { body, html, span , fromHTML} from "./html";
import { editor } from "./editor";
import { parse, prettyAST, type AST, type Span, type SyntaxNode } from "./parser";
import { getdef } from "./lsp"
import { run, ANY } from "./runtime"


if (window.location.origin.includes("localhost"))(async ()=>{
  let version = await fetch("/version").then(res => res.text())
  .catch(e=>"0")
  while (true){
    await new Promise(r => setTimeout(r, 100))
    try{
      if (await fetch("/version").then(res => res.text()).catch(e=>"0")!= version) window.location.reload()
    }catch(e){break;}
  }
})();



let outview = html('pre')().style({
  borderTop: "1px solid white",
  paddingTop: "16px",
})

let ast: AST | undefined
let currentAstMap: (SyntaxNode | undefined)[] = []


let code:string = ''

let Edit = editor(s=> {
    try{
      let parsed = parse(s)
      ast = parsed.ast
      currentAstMap = parsed.astmap
      code = s
      let res = run(ast)
      outview.el.textContent = prettyAST(res)

    }catch(e){
      ast = undefined
      currentAstMap = []
      outview.el.textContent = e instanceof Error ? e.message : String(e)
    }
  },
  ()=> currentAstMap,
  (req) => {
    let def = req.$ == "var" ? getdef(ast!, req) : undefined
    if (def) Edit.setCursor({row: def.span.start.line-1, col: def.span.start.col-1})
  },
  (node) => {
    if (node.$ === "comment") return undefined

    return node.$ + ": " + (node.type ? prettyAST(node.type) : (node.$ == "var" ? prettyAST(getdef(ast!, node)?.type ?? ANY) : "XX"))
  }
)

body.style({
  padding: "44px",
  color: "white",
  backgroundColor: "black",
  fontFamily: "sans-serif",
})


let buttn = (t:string, onClick:() => void) => span(t, onClick).style({color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginRight: "8px"})

let about_text = `
// This is a toy code editor still in development.

// the goal is to build a language with:

// extremely minimal syntax
// first class support for types as values
// first cass LSP programng in a straightforward way.


let x = (number 22) in
let y = (number 33) in

let u = (string "hllo") in
let r = {x:22} in

let id = fn x=> x in
let id_type = fn f => fn x =>(number (f (number x))) in
let typed_id = (id_type id) in



let foo = fn x g => fn y => x in

let str = {e: 44} in

let str_e = (str {e}) in

str_e
`

body.append(
  Edit.el,
  outview,
  buttn("about", () => Edit.setText(about_text)),
  buttn("github", () => window.open("https://github.com/dkormann/myeditor"))
)




