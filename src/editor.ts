import {div, html, p, span} from "./html"
import { Span, type AST } from "./parser"

type Pos = { col: number, row: number }


const colorOf = (node: AST | undefined): string => {
  if (node == undefined) return "#848484"

  if (node.$ === "number" || node.$ === "string" || node.$ ==  "builtin") return "#d3af21"
  if (node.$ === "var") return "#f983ef"
  if (node.$ === "let" || node.$ == "function" || node.$ == "annot") return "#5b8fff"
  if (node.$ === "app") return "#50e37c"
  return "#ffffff"
}



export const editor = (oninput: (s:string)=>void, getAstMap : ()=> AST[] ) => {

  let lines = localStorage.getItem("lines")?.split("\n") || `
let x = 22 :: @number in
let y = 33 :: @number in
(@add x y)
`.split("\n")
  let cursor : Pos & {selection? : Pos} = {col:5, row:5, selection: {col: 4, row: 3}
}
  let el = html("pre")()
  .style({
    userSelect: "none",
  })


  let hist : string[] = []

  let elements = new WeakMap<HTMLElement, Pos>()
  let setCursor = (pos:Pos) => {cursor = pos; render()}

  let astmap: AST[] = []

  let plesseq = (a: Pos, b: Pos) => a.row < b.row || (a.row == b.row && a.col <= b.col)

  let selrange = () : undefined | [Pos, Pos] => {
    if (!cursor.selection) return undefined
    if (plesseq(cursor, cursor.selection)) return [cursor, cursor.selection]
    else return [cursor.selection, cursor]
  }

  const render = () => {
    let code = lines.join("\n")
    let scol = Math.min(cursor.col, lines[cursor.row].length)

    let chars: HTMLElement[] = []


    let mkcolor = () => {
      chars.forEach((c, i)=>{
        let ast = astmap[i]
        let color = colorOf(ast)
        if (color) c.style.color = color
        else c.style.color = ""
      })
    }

    let range = selrange()
    console.log(range)


    el.replaceChilren(...lines.map((line,row)=>{
      let par = p(
        ...line.split("").concat(' ').map(
          (char,col)=>{

            let chr = span(char)
            .style( range && plesseq({row, col}, range[1]) && plesseq(range[0], {row, col}) ? {backgroundColor: "#8d96ff85", color: "black"} : {})
            .style(
              cursor.row === row && scol === col ? {backgroundColor: "#ffffff", color: "black"} : {}
            )
            chars.push(chr.el)
            elements.set(chr.el, {row, col})
            return chr
          }
        ),
      ).style({margin: "0"})
      elements.set(par.el, {row, col: line.length})
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



  let clear_range = () => {
    let range = selrange()
    if (!range) return
    lines = [...lines.slice(0, range[0].row), lines[range[0].row].substring(0, range[0].col) + lines[range[1].row].substring(range[1].col), ...lines.slice(range[1].row + 1)]
    setCursor(range[0])
  }

  window.addEventListener("keydown", e=>{
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
      cursor.col++
      render()
    }
    if (e.key === "Backspace"){
      let range = selrange()
      if (range){
        clear_range() 
      }
      if (e.metaKey && cursor.col > 0){
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
        if (cursor.col > 0) {
          cursor.col = 0
        }else if (cursor.row > 0){
          cursor.row--
          cursor.col = lines[cursor.row].length
        }
      }
      else if (cursor.col > 0){
        cursor.col--
      }else if (cursor.row > 0){
        cursor.row--
        cursor.col = lines[cursor.row].length
      }
    }
    if (e.key === "ArrowRight"){
      if (e.metaKey) {
        if (cursor.col < lines[cursor.row].length) cursor.col = lines[cursor.row].length
        else if (cursor.row < lines.length - 1){
          cursor.row++
          cursor.col = 0
        }
      }
      else if (cursor.col < lines[cursor.row].length) cursor.col++
      else if (cursor.row < lines.length - 1){
        cursor.row++
        cursor.col = 0
      }
    }
    if (e.key === "ArrowUp"){
      if (e.metaKey) cursor.row = 0
      else if (cursor.row > 0) cursor.row--
    }
    if (e.key === "ArrowDown"){
      if (e.metaKey) cursor.row = lines.length - 1
      else if (cursor.row < lines.length - 1) cursor.row++
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
    mousedown = true
    if (elements.has(e.target as HTMLElement))
      setCursor(elements.get(e.target as HTMLElement)!)
  })

  window.addEventListener("mouseover", e=>{
    if (!mousedown) return
    if (elements.has(e.target as HTMLElement)){
      let pos = elements.get(e.target as HTMLElement)!
      cursor.selection = cursor.selection || {row: cursor.row, col: cursor.col}
      cursor.row = pos.row
      cursor.col = pos.col

      render()

    }
  })

  window.addEventListener("mouseup", e=> mousedown = false)


  render()
  return {el, setText: (text:string) => {
    lines = text.split("\n")
    setCursor({row:0, col:0})
    render()
  }}

  
}
