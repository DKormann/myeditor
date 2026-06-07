import {div, html, p, span} from "./html"

type Pos = { col: number, row: number }


export const editor = (oninput: (s:string)=>void) => {

  let lines = localStorage.getItem("lines")?.split("\n") || ['','"hello world"', '']
  let cursor:Pos = {col:0, row:0}
  let el = html("pre")()
  .style({
    userSelect: "none",
  })


  let hist : string[] = []

  let elements = new WeakMap<HTMLElement, Pos>()
  let setCursor = (pos:Pos) => {cursor = pos; render()}

  const render = () => {
    console.log("render")
    let code = lines.join("\n")
    if (hist[hist.length - 1] != code) {
      localStorage.setItem("lines", code)
      oninput(code)
      hist.push(code)
    }

    let scol = Math.min(cursor.col, lines[cursor.row].length)

    el.replaceChilren(...lines.map((line,row)=>{
      let par = p(
        ...line.split("").concat(' ').map(
          (char,col)=>{
            let chr = span(char, (e)=> elements.set(chr.el, {row, col}) )
            .style((row == cursor.row && col == scol) ? {backgroundColor: "white", color: "black"} : {})
            return chr
          }
        ),
        e=>elements.set(par.el, {row, col: line.length})
      ).style({margin: "0"})
      return par
    }
  ))}


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
        return
      }
      lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + e.key + lines[cursor.row].substring(cursor.col)
      cursor.col++
      render()
    }
    if (e.key === "Backspace"){
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

  window.addEventListener("click", e=>{
    if (elements.has(e.target as HTMLElement)){
      setCursor(elements.get(e.target as HTMLElement)!)
    }
  })

  render()
  return {el, setText: (text:string) => {
    lines = text.split("\n")
    setCursor({row:0, col:0})
    render()
  }}

  
}

