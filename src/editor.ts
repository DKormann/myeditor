import {div, html, p, span} from "./html"
import { getdef } from "./lsp"
import { Span, type AST, type SyntaxNode } from "./parser"

type Pos = { col: number, row: number }

const colorOf = (node: SyntaxNode | undefined): string => {
  if (node == undefined) return "#848484"
  if (node.$ === "comment") return "#6f7b86"
  if (node.$ === "number" || node.$ === "string" ) return "#d3af21"
  if (node.$ === "var") return "#f983ef"
  if (node.$ === "let" || node.$ == "function" ) return "#5b8fff"
  if (node.$ === "app") return "#50e37c"
  if (node.$ === "error") return "#ff0000"
  return "#ffffff"
}


export const editor = (oninput: (s:string)=>void,
  getAstMap : ()=> (SyntaxNode|undefined)[],
  goToDef : (ast: SyntaxNode) => void,
  hoverInfo: (ast: SyntaxNode) => string | undefined,

) => {

  let lines = localStorage.getItem("lines")?.split("\n") ?? [""]
  let cursor : Pos & {selection? : Pos} = {col:0, row:0};

  let el = html("pre")()
  .style({
    userSelect: "none",
    cursor: "text",
  })


  let hist : string[] = []
  let elements = new WeakMap<HTMLElement, {pos:Pos, ast?: SyntaxNode}>()
  let astmap: (SyntaxNode|undefined)[] = []

  let pless = (a: Pos, b: Pos) => a.row < b.row || (a.row == b.row && a.col < b.col)
  let plesseq = (a: Pos, b: Pos) => a.row < b.row || (a.row == b.row && a.col <= b.col)

  let selrange = () : undefined | [Pos, Pos] => {
    if (!cursor.selection) return undefined
    if (cursor.row == cursor.selection.row && cursor.col == cursor.selection.col) {
      cursor.selection = undefined
      return undefined
    }
    if (plesseq(cursor, cursor.selection)) return [cursor, cursor.selection]
    else return [cursor.selection, cursor]
  }

  const render = () => {
    let code = lines.join("\n")
    let scol = Math.min(cursor.col, lines[cursor.row]?.length ?? 0)

    let chars: HTMLElement[] = []


    let mkcolor = () => {
      chars.forEach((c, i)=>{
        let ast = astmap[i]
        let color = colorOf(ast)
        if (color) c.style.color = color
        else c.style.color = ""
        elements.get(c)!.ast = ast
      })
    }

    let range = selrange()


    el.replaceChilren(...lines.map((line,row)=>{
      let par = p(
        ...line.split("").concat(' ').map(
          (char,col)=>{

            let chr = span(char)
            .style( range && pless({row, col}, range[1]) && plesseq(range[0], {row, col}) ? {backgroundColor: "#8d96ff85", color: "black"} : {})
            .style(cursor.row === row && scol === col ? {boxShadow: "2px 0 0 0 white inset",} : {})
            chars.push(chr.el)
            elements.set(chr.el, {pos: {row, col}})
            return chr
          }
        ),
      ).style({margin: "0"})
      elements.set(par.el, {pos:{row, col: line.length}})
      return par
    }))

    mkcolor()

    if (hist[hist.length - 1] != code) {
      localStorage.setItem("lines", code)
      oninput(code)
      hist.push(code)
      astmap = getAstMap()
      mkcolor()
    }

  }



  window.addEventListener("keydown", e=>{
    let setCursor = (pos:Pos)=>{
      if (!e.shiftKey) cursor.selection = undefined
      else cursor.selection = cursor.selection || {row: cursor.row, col: cursor.col}
      cursor.col = pos.col
      cursor.row = pos.row
    }

    let clear_range = () => {
      let range = selrange()
      if (!range) return
      lines = [...lines.slice(0, range[0].row), lines[range[0].row].substring(0, range[0].col) + lines[range[1].row].substring(range[1].col), ...lines.slice(range[1].row + 1)]
      setCursor({row: range[0].row, col: range[0].col})
    }

    if (e.key.length === 1){
      if (e.metaKey){
        if (e.key == "z"){
          if (hist.length > 1){
            hist.pop()
            let last = hist[hist.length - 1]
            hist.pop()
            lines = last.split("\n")
            setCursor({row:0, col:0})
          }
          render()
        }
        if (e.key == "c"){
          let range = selrange()
          if (range){
            let text = lines.slice(range[0].row, range[1].row + 1).map((line, i) => {
              if (i == 0 && i == range[1].row - range[0].row) return line.substring(range[0].col, range[1].col)
              else if (i == 0) return line.substring(range[0].col)
              else if (i == range[1].row - range[0].row) return line.substring(0, range[1].col)
              else return line
            }).join("\n")
            navigator.clipboard.writeText(text)
          }
        }
        if (e.key == "v"){
          navigator.clipboard.readText().then(text => {
            let range = selrange()
            clear_range()
            let insertLines = text.split("\n")
            lines = [...lines.slice(0, cursor.row), lines[cursor.row].substring(0, cursor.col) + insertLines[0], ...insertLines.slice(1, -1), insertLines.length > 1 ? insertLines[insertLines.length - 1] + lines[cursor.row].substring(cursor.col) : lines[cursor.row].substring(cursor.col), ...lines.slice(cursor.row + 1)]
            setCursor({row: cursor.row + insertLines.length - 1, col: (insertLines.length > 1 ? insertLines[insertLines.length - 1].length : cursor.col + insertLines[0].length)})
          })
        }
        return
      }
      lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + e.key + lines[cursor.row].substring(cursor.col)
      setCursor({row: cursor.row, col: cursor.col + 1})
      cursor.selection = undefined
    }
    if (e.key === "Backspace"){
      let range = selrange()
      if (range){
        clear_range()

      }
      else if (e.metaKey && cursor.col > 0){
        lines = [...lines.slice(0, cursor.row), lines[cursor.row].substring( cursor.col), ...lines.slice(cursor.row + 1)]
        cursor.col = 0
      
      }else if (cursor.col > 0){
        cursor.col--
        lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + lines[cursor.row].substring(cursor.col + 1)
      }else if (cursor.row > 0){
        cursor.row--
        cursor.col = lines[cursor.row].length
        lines = [...lines.slice(0, cursor.row), lines[cursor.row] + lines[cursor.row + 1], ...lines.slice(cursor.row + 2)]
      }
    }

    if (e.key === "ArrowLeft"){
      if (e.metaKey){
        if (cursor.col > 0) setCursor({row: cursor.row, col: 0})
        else if (cursor.row > 0) setCursor({row: cursor.row - 1, col: lines[cursor.row - 1].length})
      }
      else if (cursor.col > 0) setCursor({row: cursor.row, col: cursor.col - 1})
      else if (cursor.row > 0) setCursor({row: cursor.row - 1, col: lines[cursor.row - 1].length})

    }
    if (e.key === "ArrowRight"){
      if (e.metaKey){
        if (cursor.col < lines[cursor.row].length) setCursor({row: cursor.row, col: lines[cursor.row].length})
        else if (cursor.row < lines.length - 1) setCursor({row: cursor.row + 1, col: 0})
      }
      else if (cursor.col < lines[cursor.row].length) setCursor({row: cursor.row, col: cursor.col + 1})
      else if (cursor.row < lines.length - 1) setCursor({row: cursor.row + 1, col: 0})
    }

    if (e.key === "ArrowUp"){
      if (e.metaKey) setCursor({row: 0, col: cursor.col})
      else if (cursor.row > 0) setCursor({row: cursor.row - 1, col: cursor.col})
    }
    if (e.key === "ArrowDown"){
      if (e.metaKey) setCursor({row: lines.length - 1, col: cursor.col})
      else if (cursor.row < lines.length - 1) setCursor({row: cursor.row + 1, col: cursor.col})
    }
    if (e.key === "Enter"){
      lines = [
        ...lines.slice(0, cursor.row),
        lines[cursor.row].substring(0, cursor.col),
        (lines[cursor.row].match(/^\s*/)?.[0] || "") + lines[cursor.row].substring(cursor.col),
        ...lines.slice(cursor.row + 1)]
      cursor.row++
      cursor.col = lines[cursor.row].match(/^\s*/)?.[0].length || 0
    }


    if (e.key.startsWith("Arrow")){
      e.preventDefault()
    }

    render()

  })


  let mousedown= false  

  window.addEventListener("mousedown", e=>{
    if (e.metaKey) {
      let ast = elements.get(e.target as HTMLElement)?.ast
      if (ast) goToDef(ast)
      return
    }
    mousedown = true
    if (elements.has(e.target as HTMLElement)){
      cursor = elements.get(e.target as HTMLElement)!.pos
      render()
    }
  })

  window.addEventListener("mouseover", e=>{
    if (mousedown) {
      if (elements.has(e.target as HTMLElement)){
        let pos = elements.get(e.target as HTMLElement)!.pos
        cursor.selection = cursor.selection || {row: cursor.row, col: cursor.col}
        cursor.row = pos.row
        cursor.col = pos.col
        render()
      }
    }else{
      let ast = elements.get(e.target as HTMLElement)?.ast
      if (ast) {
        let info = hoverInfo(ast)
        if (info) {
          let tooltip = div(info).style({
            position: "fixed",
            left: e.clientX + "px",
            bottom: (window.innerHeight - e.clientY + 10) + "px",
            backgroundColor: "#0a0a0a",
            color: "rgb(200, 200, 234)",
            border: "1px solid #ffffff55",
            padding: "8px 12px",
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: "1000",
            whiteSpace: "pre",
          })
          document.body.appendChild(tooltip.el)
          let remove = () => {
            tooltip.el.remove()
            window.removeEventListener("mousemove", move)
            window.removeEventListener("mouseout", out)
          }
          let move = (e: MouseEvent) => {
          if (e.metaKey) return remove()
            tooltip.style({
              left: e.clientX + "px",
              bottom: (window.innerHeight - e.clientY + 10) + "px",
            })
          }
          let out = (e: MouseEvent) => {
            if (e.relatedTarget === tooltip.el) return
            remove()
          }
          window.addEventListener("mousemove", move)
          window.addEventListener("mouseout", out)
        }
      }
    }
  })

  window.addEventListener("mouseup", e=> {
    mousedown = false
  })


  render()
  return {el,
    setText: (text:string) => {
      lines = text.split("\n")
      render()
    },
    setCursor: (pos: Pos) => {
      console.log("setting cursor to", pos)
      cursor = pos
      render()
    }
  }

  
}
