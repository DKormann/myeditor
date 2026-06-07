import { body, html, span } from "./html";
import { editor } from "./editor";
import { children, parse, type AST, type Span } from "./parser";


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
let colormap: {color: string, span: Span}[] = []

const contains = (node: AST, offset: number) =>
  node.span.start.offset <= offset && offset < node.span.end.offset

const smallestAstAt = (node: AST, offset: number): AST | undefined => {
  if (!contains(node, offset)) return undefined
  for (let child of children(node)) {
    let match = smallestAstAt(child, offset)
    if (match) return match
  }
  return node
}

const colorOf = (node: AST): string | undefined => {
  if (node.$ === "number") return "#f5a623"
  if (node.$ === "string") return "#7ed321"
  if (node.$ === "builtin") return "#50e3c2"
  if (node.$ === "var") return "#4a90e2"
  if (node.$ === "let") return "#bd10e0"
  if (node.$ === "function") return "#d0021b"
  return undefined
}


const prettyAST = (node: AST): string =>{
  switch(node.$){
    case "number" : return node.content.toString()
    case "string" : return JSON.stringify(node.content)
    case "builtin": return node.content
    case "var": return node.content.name
    case "let": return `(let ${node.content.var} = ${prettyAST(node.content.value)} in ${prettyAST(node.content.body)})`
    case "function": return `(fn (${node.content.vars.map(v=>v.content.name).join(", ")}) => ${prettyAST(node.content.body)})`
    case "app": return `(${prettyAST(node.content.fn)} ${node.content.args.map(prettyAST).join(" ")})`
    case "annot": return `(${prettyAST(node.content.value)} : ${prettyAST(node.content.type)})`
    case "record": return `{${node.content.map(([k,v])=> `${k}: ${prettyAST(v)}`).join(", ")}}`
  }
}

const collectColormap = (node: AST): {color: string, span: Span}[] => {
  let kids = children(node)
  if (kids.length > 0) return kids.flatMap(collectColormap)
  let color = colorOf(node)
  return color ? [{color, span: node.span}] : []
}


let Edit = editor(s=> {
  try{
    ast = parse(s)
    colormap = collectColormap(ast).sort((a, b) => a.span.start.offset - b.span.start.offset)
    outview.el.textContent = prettyAST(ast)
  }catch(e){
    ast = undefined
    colormap = []
    outview.el.textContent = e instanceof Error ? e.message : String(e)
  }
}, (offset:number)=>{
  if (!ast) return undefined
  return smallestAstAt(ast, offset)
}, ()=>{
  return colormap
})

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
// This is a toy code editor still in development. [https://github.com/dkormann/myeditor]

// The main goal is to bring zig's comptime capabilities to a scripting language.

// also if possible I want to make the linter programmable from the code in a straightforward way.


`)
  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", }),


)
