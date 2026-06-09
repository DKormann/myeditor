import { body, html, span , fromHTML} from "./html";
import { editor } from "./editor";
import { children, parse, prettyAST, type AST, type Span } from "./parser";
import { astmap, getdef } from "./lsp"
import {typeInfer, ANY} from "./runtime"


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


let Edit = editor(s=> {
    try{
      ast = parse(s)
      typeInfer(ast)
      outview.el.textContent = prettyAST(ast)

    }catch(e){
      ast = undefined
      outview.el.textContent = e instanceof Error ? e.message : String(e)
    }
  },
  ()=> ast ? astmap(ast) : [],
  (req) => {
    console.log("got req", req)
    let def = req.$ == "var" ? getdef(ast!, req) : undefined
    console.log("got def", def)
    if (def) Edit.setCursor({row: def.span.start.line-1, col: def.span.start.col-1})
  },
  (ast) => {
    return ast.$ + ": " + prettyAST(ast.type ?? ANY)
  }
)

body.style({
  padding: "44px",
  color: "white",
  backgroundColor: "black",
  fontFamily: "sans-serif",
})





.append(
  Edit.el,
  outview,

  span(" ⚙ about this", ()=>{
    Edit.setText(`
// This is a toy code editor still in development.

// the goal is to build a language with:


// first class supportt for types as values
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



`)

  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", }),
  span("github", ()=>{
    window.open("https://github.com/dkormann/myeditor")
  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginLeft: "8px" }),

)
