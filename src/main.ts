import { body, html, span , fromHTML} from "./html";
import { editor } from "./editor";
import { children, parse, prettyAST, type AST, type Span } from "./parser";
import { astmap } from "./lsp"


(async ()=>{
  let version = await fetch("/version").then(res => res.text())
  while (true){
    await new Promise(r => setTimeout(r, 100))
    try{
      if (await fetch("/version").then(res => res.text()) != version) window.location.reload()
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
    outview.el.textContent = prettyAST(ast)
  }catch(e){
    ast = undefined
    outview.el.textContent = e instanceof Error ? e.message : String(e)
  }
}, ()=> ast ? astmap(ast) : [])

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

// the main goal is to build a language with:

// first class support for types as values

// first class LSP programming in a straightforward way.


let x = 22 :: @number in
let y = 33 :: @number in

let foo = fn x => fn y => x in

(foo x y)



`)

  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", }),
  span("github", ()=>{
    window.open("https://github.com/dkormann/myeditor")
  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginLeft: "8px" }),

)
