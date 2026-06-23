export type Pos = {offset: number, line: number, col: number}
export type Span = {start: Pos, end: Pos}

export type Tag <T extends string, C> = {$: T, content: C, span: Span, type?: AST}

export type Var = Tag<"var", {name: string}>
export type Comment = Tag<"comment", string>
export type Func = Tag<"function", {vars: Var[], body: AST}>

export type ErrorNode = Tag<"error", {message: string, content: string}>

export type Prim = Tag<"number", number> | Tag<"string", string>

export type AST =
  | Tag<"app", {fn: AST, args: AST[]}>
  | Var
  | Func
  | Prim
  | Tag<"let", {var: Var, value: AST, body: AST}>
  | Tag<"record", [Var, AST][]>
  | ErrorNode

export type SyntaxNode = AST | Comment
export type ParseResult = {ast: AST, comments: Comment[]}



const zeroPos = (): Pos => ({offset: 0, line: 1, col: 1})
const zeroSpan = (): Span => ({start: zeroPos(), end: zeroPos()})

export const mkAst = <T extends string, C>(tag: T, content: C, span: Span = zeroSpan()): Tag<T, C> => ({$: tag, content, span})

type TokenBase = {span: Span}

type Token =
  | (TokenBase & {type: "ident", value: string})
  | (TokenBase & {type: "number", value: number})
  | (TokenBase & {type: "string", value: string})
  | (TokenBase & {type: "symbol", value: "(" | ")" | "{" | "}" | "," | "=" | ":"})
  | (TokenBase & {type: "arrow"})
  | (TokenBase & {type: "comment", value: string})
  | (TokenBase & {type: "keyword", value: "let" | "in" | "fn"})
  | (TokenBase & {type: "error", message: string, content: string})

type TokenNoSpan = Token extends infer T ? T extends {span: Span} ? Omit<T, "span"> : never : never

const tokenize = (code: string): {tokens: Token[], comments: Comment[], eof: Pos} => {
  let tokens: Token[] = []
  let comments: Comment[] = []
  let i = 0
  let line = 1
  let col = 1

  let isAlpha = (char: string) => /[A-Za-z_]/.test(char)
  let isDigit = (char: string) => /[0-9]/.test(char)
  let isIdent = (char: string) => /[A-Za-z0-9_]/.test(char)
  let pos = (): Pos => ({offset: i, line, col})
  let advance = () => {
    if (code[i] === "\n") {
      i++
      line++
      col = 1
    } else {
      i++
      col++
    }
  }
  let push = (token: TokenNoSpan, start: Pos) => {
    tokens.push({...token, span: {start, end: pos()}} as Token)
  }

  while (i < code.length) {
    let char = code[i]

    if (/\s/.test(char)) {
      advance()
      continue
    }

    if (char === "/" && code[i + 1] === "/") {
      let start = pos()
      advance()
      advance()
      while (i < code.length && code[i] !== "\n") advance()
      comments.push(mkAst("comment", code.slice(start.offset, i), {start, end: pos()}))
      continue
    }

    if (char === "=" && code[i + 1] === ">") {
      let start = pos()
      advance()
      advance()
      push({type: "arrow"}, start)
      continue
    }

    if ("(){}=,:".includes(char)) {
      let start = pos()
      let value = char as "(" | ")" | "{" | "}" | "," | "=" | ":"
      advance()
      push({type: "symbol", value}, start)
      continue
    }

    if (char === '"') {
      let start = pos()
      advance()
      let value = ""
      while (i < code.length) {
        let current = code[i]
        if (current === "\\") {
          let next = code[i + 1]
          if (next === undefined) {
            advance()
            push({type: "error", message: "Unterminated string escape", content: code.slice(start.offset, i)}, start)
            return {tokens, comments, eof: pos()}
          }
          let escaped = ({n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\"} as Record<string, string>)[next]
          value += escaped ?? next
          advance()
          advance()
          continue
        }
        if (current === '"') break
        value += current
        advance()
      }
      if (code[i] !== '"') {
        push({type: "error", message: "Unterminated string literal", content: code.slice(start.offset, i)}, start)
        return {tokens, comments, eof: pos()}
      }
      advance()
      push({type: "string", value}, start)
      continue
    }

    if (isDigit(char)) {
      let start = pos()
      let valueStart = i
      while (i < code.length && isDigit(code[i])) advance()
      push({type: "number", value: Number(code.slice(valueStart, i))}, start)
      continue
    }

    if (isAlpha(char)) {
      let start = pos()
      let valueStart = i
      while (i < code.length && isIdent(code[i])) advance()
      let value = code.slice(valueStart, i)
      if (value === "let" || value === "in" || value === "fn") push({type: "keyword", value}, start)
      else push({type: "ident", value}, start)
      continue
    }

    let start = pos()
    advance()
    push({type: "error", message: `Unexpected character: ${char}`, content: char}, start)
  }

  return {tokens, comments, eof: pos()}
}


export const buildAstMap = (ast: AST, comments: Comment[] = []): (SyntaxNode | undefined)[] => {

  let maxEnd = comments.reduce((m, c) => c.span.end.offset > m ? c.span.end.offset : m, ast.span.end.offset)
  let res: (SyntaxNode | undefined)[] = Array.from({length: maxEnd}, ()=>undefined)
  const walk = (node: AST) => {
    if (node.span.start == undefined) console.error("no start:", node)
    for (let i = node.span.start.offset; i < node.span.end.offset; i++) res[i] = node
    children(node).forEach(walk)
  }
  walk(ast)
  comments.forEach(comment => {
    for (let i = comment.span.start.offset; i < comment.span.end.offset; i++) res[i] = comment
  })
  return res
}


export const children = (node: AST): AST[] => {
  if (node.$ === "function") return [...node.content.vars, node.content.body]
  if (node.$ === "app") return [node.content.fn, ...node.content.args]
  if (node.$ === "let") return [node.content.var, node.content.value, node.content.body]
  if (node.$ === "record") return node.content.flatMap(([key, value]) => [key, value])
  return []
}

const mapAst = (ast: AST, f: <T extends AST>(x:T) =>T) :AST => {
  if (ast.$ === "function") return mkfun(ast.content.vars.map(v=> mapAst(v, f) as Var), mapAst(ast.content.body, f))
  if (ast.$ === "app") return mkapp(mapAst(ast.content.fn, f), ast.content.args.map(arg => mapAst(arg, f)))
  if (ast.$ === "let") return mklet(mapAst(ast.content.var, f) as Var, mapAst(ast.content.value, f), mapAst(ast.content.body, f))
  if (ast.$ === "record") throw new Error("Not implemented")
  if (ast.$ === "error") return ast
  return f(ast)
}


const stripSpans = (ast: AST): AST => mapAst(ast, (x) => ({$: x.$, content: x.content} as any))



export function parse(code: string) : {ast: AST, comments: Comment[]} {


  let tokenized = tokenize(code)
  let tokens = tokenized.tokens


  let idx = 0

  let take = (): Token | undefined => tokens[idx++]
  let peek = (): Token | undefined => tokens[idx]
  // let back = (): Token => {if (idx > 0) idx--}


  let nextIs = (type: Token["type"], value?: string): boolean => {
    let token = peek()
    if (!token || token.type !== type) return false
    if (value !== undefined) {
      if (!("value" in token)) return false
      return token.value === value
    }
    return true
  }

  let takeIs : typeof nextIs = (type: Token["type"], value?: string) => {
    let res = nextIs(type, value)
    if (res) take()
    return res
  }

  let asBinder = (term: AST): Var | ErrorNode => {
    if (term.$ === "var") return term
    if (term.$ === "app" && term.content.args.length === 1 && term.content.args[0].$ === "var"){
      let variable = term.content.args[0]
      variable.type = term.content.fn
      return variable
    }
    return mkAst("error", {message: "Expected binder (variable or annotated variable)", content: code.slice(term.span.start.offset, term.span.end.offset)}, term.span)
  }



  let go = ():AST => {

    let next = take()
    if (!next) return mkAst("error", {message: "unexpected end of input", content: ""})

    let mkspan = (ast:AST) => {
      ast.span = {
        start: next.span.start,
        end: tokens[Math.min(tokens.length, idx)-1]?.span.end,
      }
      console.log(ast.span)
      return ast
    }


    let mkerror = (msg: string)=> mkspan( mkAst("error", {message: msg, content: ""}))


    switch(next.type){
      case "number": return mkAst("number", next.value, next.span)
      case "ident": return mkAst("var", {name: next.value}, next.span)
      case "string": return mkAst("string", next.value, next.span)
      case "symbol": {
        if (next.value === "("){
          let items: AST[] = []
          while(!nextIs("symbol", ")")){
            if (!peek()) return mkAst("error", {message: "Unterminated parenthesized expression", content: code.slice(next.span.start.offset)}, next.span)
            items.push(go())
          }
          let close = take()!
          if (items.length === 0) return mkAst("error", {message: "Empty parentheses are not allowed", content: code.slice(next.span.start.offset, close.span.end.offset)}, {start: next.span.start, end: close.span.end})
          if (items.length === 1) return items[0]
          return mkAst("app", {fn: items[0], args: items.slice(1)}, {start: next.span.start, end: close.span.end})
        }
      }
  
      case "keyword": {
        if (next.value === "let") {

          let binder : AST;
          let value : AST;
          let body : AST;

          binder = asBinder(go());

          if (binder.$ == "error") return binder

          if (!takeIs ("symbol", "=")) return mkerror("expected (=)")
          
          value = go()
          if (!takeIs("keyword" , "in")) return mkerror("expected (in)")
          
          body = go()

          return mkspan(mklet(binder, value, body))
        }

        if (next.value === "fn") {
          let vars: Var[] = []
          while (!takeIs("arrow")){
            let binder = go()
            if (binder.$ === "error") return mkAst("function", {vars, body: binder}, {start: next.span.start, end: binder.span.end})
            else if (binder.$ === "var") vars.push(binder)
            else if (binder.$ === "app"){
              let {fn, args} = binder.content
              if (args.length == 1 && args[0].$ === "var"){
                binder = args[0]
                binder.type = fn
                vars.push(binder)
              }
            }else return mkAst("error", {message: "Expected function parameter", content: code.slice(binder.span.start.offset, binder.span.end.offset)}, binder.span)
          }
          let body = go()
          return mkAst("function", {vars, body}, {start: next.span.start, end: body.span.end})
        }
      }
    }
    return mkAst("error", {message: `Unexpected token: ${next.type}${"value" in next ? `(${String(next.value)})` : ""}`, content: code.slice(next.span.start.offset, next.span.end.offset)}, next.span)
  }

  let ast = go()
  // if (peek()) {
  //   let next = peek()!
  //   ast = mkAst("error", {message: `Unexpected extra input after expression: ${next.type}${ JSON.stringify(next)}`, content: code.slice(next.span.start.offset, next.span.end.offset)}, {start: ast.span.start, end: next.span.end})
  // }

  return {ast, comments: tokenized.comments}

}



export const parseAST = (code:string): AST => parse(code).ast



export const prettyAST = (node: AST): string =>{
  switch(node.$){
    case "number" : return node.content.toString()
    case "string" : return JSON.stringify(node.content)
    case "var": return node.content.name
    case "let": return `let ${prettyBinder(node.content.var)} = ${prettyAST(node.content.value)} in\n${prettyAST(node.content.body)}`
    case "function": return `fn ${node.content.vars.map(prettyBinder).join(" ")} => ${prettyAST(node.content.body)}`
    case "app": return `(${prettyAST(node.content.fn)} ${node.content.args.map(prettyAST).join(" ")})`
    case "record": return `{${node.content.map(([k, v]) => `${k.content.name}: ${prettyAST(v)}`).join(", ")}}`
    case "error": return `[ERROR: ${node.content.message}]`
  }
}

const hasShownType = (v: Var) => v.type && !(v.type.$ === "var" && v.type.content.name === "any")
const prettyBinder = (v: Var): string => hasShownType(v) ? `(${prettyAST(v.type!)} ${v.content.name})` : v.content.name



let stringify = (x: unknown) => JSON.stringify(x, null, 2)

const test_parse = (code: string, expected: AST) => {
  let ast = parseAST(code)

  let A = prettyAST(ast)
  let B = prettyAST(expected)

  if (A !== B) {
    console.error("Expected:", B)
    console.error("Got:     ", A)
    throw new Error(`Test failed for code: ${code}`)
  }
}

const test_span = (code: string, expected: Span) => {
  let ast = parseAST(code)
  if (JSON.stringify(ast.span) !== JSON.stringify(expected)) {

    console.error("Expected:", expected)
    console.error("Got:     ", ast.span)
    throw new Error(`Span test failed for code: ${code}`)
  }
}

export let mknum = (n: number) => mkAst("number", n)
export let mkstr = (s: string) => mkAst("string", s)
export let mkvar = (name: string) => mkAst("var", {name})
export let mkapp = (fn: AST, args: AST[]) => mkAst("app", {fn, args})
export let mklet = (v: string | Var, value: AST, body: AST) => mkAst("let", {var: typeof v === "string" ? mkvar(v) : v, value, body})
export let mkfun = (vars: (string | Var)[], body: AST) => mkAst("function", {vars: vars.map(v => typeof v === "string" ? mkvar(v) : v), body}) as Func
export let annot = (type: AST, value: AST) => mkAst("annot", {type, value})
// export let mkrecord = (fields: {[key : string] : AST}) => mkAst("record", Object.entries(fields).map(([k,v])=> [mkvar(k), v]))

Object.entries({
  "x": mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "let ix = 22 in ix": mklet("ix", mknum(22), mkvar("ix")),
  "fn x => x": mkfun(["x"], mkvar("x")),
  "let u = 4 in let v = 5 in u": mklet("u", mknum(4), mklet("v", mknum(5), mkvar("u"))),
  "let (number x) = 22 in x": mklet(Object.assign(mkvar("x"), {type: mkvar("number")}), mknum(22), mkvar("x")),
  "fn x y => x": mkfun(["x", "y"], mkvar("x")),
  "fn (number x) => x": mkfun([Object.assign(mkvar("x"), {type: mkvar("number")})], mkvar("x")),


}).forEach(([code, expected]) => test_parse(code, expected as AST))

test_span("let x = 22\nin x", {
  start: {offset: 0, line: 1, col: 1},
  end: {offset: 15, line: 2, col: 5},
})
