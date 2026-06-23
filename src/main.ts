



import { body, html, span , fromHTML, h2, div} from "./html";
import { editor } from "./editor";
import { buildAstMap, parse, type AST, type Span, type SyntaxNode, prettyAST} from "./parser";
import { getdef } from "./lsp"
import { ANY, run } from "./runtime"
import { color } from "./html";



const about_text : string = `

// This is a toy code editor still in development.

// the goal is to build a language with:

// extremely minimal syntax
// first class support for types as values
// first cass LSP programng in a straightforward way.

// hover over x to see its inferred type
let n = 22 in

// this is how types are annotated. types are essentially just functions over values.
let k = (number 33) in
let u = (string "hllo") in

// untyped id
let id = fn x => x in

// number typed id
let idn = fn x => (number x) in

// type of number -> number
let T = fn f => fn (number x) => (number (f x)) in

let _id = (T id) in

//let bad = (_id "e") in

let r = (id "2") in

// this is will result in type error.
// let BAD = (idn_ "2") in

(number st)
`;




let outview = html('pre')().style({
  borderTop: "1px solid "+color.color,
  paddingTop: "16px",
})

let ast: AST | undefined
let currentAstMap: (SyntaxNode | undefined)[] = []


let code:string = ''

let Edit = editor(
  localStorage.getItem("lines") ?? about_text,
  (code)=> {
    try{

      let parsed = parse(code)
      ast = parsed.ast
      code = code
      
      let res = run(ast)

      currentAstMap = buildAstMap(ast, parsed.comments)

      outview.el.textContent = prettyAST(res)
      localStorage.setItem("lines", code)

    }catch(e){
      ast = undefined
      currentAstMap = []
      console.error(e)
      outview.el.textContent = e instanceof Error ? e.message : String(e)
    }
  },
  ()=> currentAstMap,
  (req) => {
    let def = req.$ == "var" ? getdef(ast!, req) : undefined
    if (def) Edit.setCursor({row: def.span.start.line-1, col: def.span.start.col-1})
  },
  (node) => {
    if (node.$ === "comment") return ['', []]

    let str = (node.$ + ": ")
    let map : (SyntaxNode | undefined)[] = str.split('').map(c=> undefined)

    let ast:AST = node.type ? node.type : ANY

    let co = prettyAST(ast)
    // map.push(...parse(co).astmap)
    str += co

    return [str, map]
  }
)




body.style({padding: "44px",fontFamily: "sans-serif",})


let buttn = (t:string, onClick:() => void) => span(t, onClick).style({color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginRight: "8px"})

body.append(
  div(
    span('✈︎').style({fontSize: "3em", marginRight: "8px"}),
    span("MiG").style({fontSize: "1.5em", fontWeight: "bold", fontFamily: "monospace"})
  ).style({display: "flex", alignItems: "center", marginBottom: "16px", color: "gray"}),

  Edit.el,
  outview,
  buttn("about", () => Edit.setText(about_text)),
  buttn("github", () => window.open("https://github.com/dkormann/myeditor"))
)


