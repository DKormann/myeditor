export type Pos = {offset: number, line: number, col: number}
export type Span = {start: Pos, end: Pos}

export type Tag <T extends string, C> = {$: T, content: C, span: Span}

export type Var = Tag<"var", {name: string}>

export type AST =
  | Tag<"function", {vars: Var[], body: AST}>
  | Tag<"app", {fn: AST, args: AST[]}>
  | Var
  | Tag<"number", number>
  | Tag<"string", string>
  | Tag<"builtin", string>
  | Tag<"let", {var: Var, value: AST, body: AST}>
  | Tag<"annot", {type: AST, value: AST}>
  | Tag<"record", [Var, AST][]>


export const prettyAST = (node: AST): string =>{
  switch(node.$){
    case "number" : return node.content.toString()
    case "string" : return JSON.stringify(node.content)
    case "builtin": return node.content
    case "var": return node.content.name
    case "let": return `let ${node.content.var.content.name} = ${prettyAST(node.content.value)} in\n${prettyAST(node.content.body)}`
    case "function": return `fn ${node.content.vars.map(v=>v.content.name).join(" ")} => ${prettyAST(node.content.body)}`
    case "app": return `(${prettyAST(node.content.fn)} ${node.content.args.map(prettyAST).join(" ")})`
    case "annot": return `${prettyAST(node.content.value)} :: ${prettyAST(node.content.type)}`
    case "record": return `{${node.content.map(([k, v]) => `${k.content.name}: ${prettyAST(v)}`).join(", ")}}`
  }
}


const zeroPos = (): Pos => ({offset: 0, line: 1, col: 1})
const zeroSpan = (): Span => ({start: zeroPos(), end: zeroPos()})

const mkAst = <T extends string, C>(tag: T, content: C, span: Span = zeroSpan()): Tag<T, C> => ({$: tag, content, span})

type TokenBase = {span: Span}

type Token =
  | (TokenBase & {type: "ident", value: string})
  | (TokenBase & {type: "builtin", value: string})
  | (TokenBase & {type: "number", value: number})
  | (TokenBase & {type: "string", value: string})
  | (TokenBase & {type: "symbol", value: "(" | ")" | "{" | "}" | "," | "=" | ":"})
  | (TokenBase & {type: "annot"})
  | (TokenBase & {type: "arrow"})
  | (TokenBase & {type: "keyword", value: "let" | "in" | "fn"})

const tokenize = (code: string): Token[] => {
  let tokens: Token[] = []
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
  let push = (token: Omit<Token, "span">, start: Pos) => {
    tokens.push({...token, span: {start, end: pos()}} as Token)
  }

  while (i < code.length) {
    let char = code[i]

    if (/\s/.test(char)) {
      advance()
      continue
    }

    if (char === "/" && code[i + 1] === "/") {
      advance()
      advance()
      while (i < code.length && code[i] !== "\n") advance()
      continue
    }

    if (char === ":" && code[i + 1] === ":") {
      let start = pos()
      advance()
      advance()
      push({type: "annot"}, start)
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

    if (char === "@") {
      let start = pos()
      advance()
      let valueStart = i
      while (i < code.length && isIdent(code[i])) advance()
      if (valueStart === i) throw new Error("Expected builtin name after @")
      push({type: "builtin", value: code.slice(valueStart, i)}, start)
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
          if (next === undefined) throw new Error("Unterminated string escape")
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
      if (code[i] !== '"') throw new Error("Unterminated string literal")
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

    throw new Error(`Unexpected character: ${char}`)
  }

  return tokens
}

class Parser {
  private i = 0

  constructor(private tokens: Token[]) {}

  parse(): AST {
    let ast = this.parseExpr()
    if (this.peek()) throw new Error(`Unexpected token at end: ${this.describe(this.peek())}`)
    return ast
  }

  private parseExpr(): AST {
    if (this.isKeyword("let")) return this.parseLet()
    if (this.isKeyword("fn")) return this.parseFunction()
    return this.parseAnnot()
  }

  private parseLet(): AST {
    let start = this.expectKeyword("let").span.start
    let name = this.expectToken("ident")
    this.expectSymbol("=")
    let value = this.parseExpr()
    this.expectKeyword("in")
    let body = this.parseExpr()
    return mkAst("let", {var: mkAst("var", {name:name.value}, name.span), value, body}, {start, end: body.span.end})
  }

  private parseFunction(): AST {
    let start = this.expectKeyword("fn").span.start
    let vars: Var[] = []
    while (this.peek()?.type === "ident") {
      let ident = this.expectToken("ident")
      vars.push(mkAst("var", {name: ident.value}, ident.span))
    }
    if (vars.length === 0) throw new Error("Function requires at least one parameter")
    this.expectArrow()
    let body = this.parseExpr()
    return mkAst("function", {vars, body}, {start, end: body.span.end})
  }

  private parseAnnot(): AST {
    let value = this.parseAtom()
    while (this.peek()?.type === "annot") {
      this.expectToken("annot")
      let type = this.parseExpr()
      value = mkAst("annot", {type, value}, {start: value.span.start, end: type.span.end})
    }
    return value
  }

  private parseAtom(): AST {
    let token = this.peek()
    if (!token) throw new Error("Unexpected end of input")

    if (token.type === "ident") {
      this.i++
      return mkAst("var", {name: token.value}, token.span)
    }

    if (token.type === "builtin") {
      this.i++
      return mkAst("builtin", token.value, token.span)
    }

    if (token.type === "number") {
      this.i++
      return mkAst("number", token.value, token.span)
    }

    if (token.type === "string") {
      this.i++
      return mkAst("string", token.value, token.span)
    }

    if (this.isSymbol("(")) return this.parseParens()
    if (this.isSymbol("{")) return this.parseRecord()

    throw new Error(`Unexpected token: ${this.describe(token)}`)
  }

  private parseParens(): AST {
    let open = this.expectSymbol("(")
    let items: AST[] = []
    while (!this.isSymbol(")")) {
      if (!this.peek()) throw new Error("Unterminated parenthesized expression")
      items.push(this.parseExpr())
    }
    let close = this.expectSymbol(")")
    if (items.length === 0) throw new Error("Empty parentheses are not allowed")
    if (items.length === 1) return items[0]
    return mkAst("app", {fn: items[0], args: items.slice(1)}, {start: open.span.start, end: close.span.end})
  }

  private parseRecord(): AST {
    let open = this.expectSymbol("{")
    let fields: [Var, AST][] = []

    while (!this.isSymbol("}")) {
      let name = this.expectToken("ident")
      let key = mkAst("var", {name: name.value}, name.span)
      let value = this.isSymbol(":")
        ? (this.expectSymbol(":"), this.parseExpr())
        : key
      fields.push([key, value])
      if (this.isSymbol(",")) this.i++
      else break
    }

    let close = this.expectSymbol("}")
    return mkAst("record", fields, {start: open.span.start, end: close.span.end})
  }

  private peek(): Token | undefined {
    return this.tokens[this.i]
  }

  private isKeyword(value: "let" | "in" | "fn"): boolean {
    let token = this.peek()
    return token?.type === "keyword" && token.value === value
  }

  private isSymbol(value: "(" | ")" | "{" | "}" | "," | "=" | ":"): boolean {
    let token = this.peek()
    return token?.type === "symbol" && token.value === value
  }

  private expectToken<K extends Token["type"]>(type: K): Extract<Token, {type: K}> {
    let token = this.peek()
    if (!token || token.type !== type) throw new Error(`Expected ${type}, got ${this.describe(token)}`)
    this.i++
    return token as Extract<Token, {type: K}>
  }

  private expectKeyword(value: "let" | "in" | "fn") {
    let token = this.peek()
    if (token?.type !== "keyword" || token.value !== value) throw new Error(`Expected keyword ${value}, got ${this.describe(token)}`)
    this.i++
    return token
  }

  private expectSymbol(value: "(" | ")" | "{" | "}" | "," | "=" | ":") {
    let token = this.peek()
    if (token?.type !== "symbol" || token.value !== value) throw new Error(`Expected '${value}', got ${this.describe(token)}`)
    this.i++
    return token
  }

  private expectArrow() {
    return this.expectToken("arrow")
  }

  private expectIdent(): string {
    return this.expectToken("ident").value
  }

  private describe(token: Token | undefined): string {
    if (!token) return "end of input"
    if ("value" in token) return `${token.type}(${String(token.value)})`
    return token.type
  }
}

export const parse = (code:string):AST => new Parser(tokenize(code)).parse()

export const children = (node: AST): AST[] => {
  if (node.$ === "function") return [...node.content.vars, node.content.body]
  if (node.$ === "app") return [node.content.fn, ...node.content.args]
  if (node.$ === "let") return [node.content.var, node.content.value, node.content.body]
  if (node.$ === "annot") return [node.content.value, node.content.type]
  if (node.$ === "record") return node.content.flatMap(([key, value]) => [key, value])
  return []
}

const stripSpans = (ast: AST): unknown => {
  if (ast.$ === "function") return {$: ast.$, content: {vars: ast.content.vars.map(stripSpans), body: stripSpans(ast.content.body)}}
  if (ast.$ === "app") return {$: ast.$, content: {fn: stripSpans(ast.content.fn), args: ast.content.args.map(stripSpans)}}
  if (ast.$ === "let") return {$: ast.$, content: {var: stripSpans(ast.content.var), value: stripSpans(ast.content.value), body: stripSpans(ast.content.body)}}
  if (ast.$ === "annot") return {$: ast.$, content: {type: stripSpans(ast.content.type), value: stripSpans(ast.content.value)}}
  if (ast.$ === "record") return {$: ast.$, content: ast.content.map(([name, value]) => [stripSpans(name), stripSpans(value)])}
  return {$: ast.$, content: ast.content}
}


let stringify = (x: unknown) => JSON.stringify(x, null, 2)

const test_parse = (code: string, expected: AST) => {
  let ast = parse(code)

  if (JSON.stringify(stripSpans(ast)) !== JSON.stringify(stripSpans(expected))) {
    console.error("Test failed for code:", code)
    console.error("Expected:", stringify(stripSpans(expected)))
    console.error("Got:", stringify(stripSpans(ast)))
    throw new Error(`Test failed for code: ${code}`)
  } else {
    // console.log("Test passed for code:", code)
  }
}

const test_span = (code: string, expected: Span) => {
  let ast = parse(code)
  if (JSON.stringify(ast.span) !== JSON.stringify(expected)) {
    console.error("Span test failed for code:", code)
    console.error("Expected:", expected)
    console.error("Got:", ast.span)
    throw new Error(`Span test failed for code: ${code}`)
  } else {
    // console.log("Span test passed for code:", code)
  }
}

let mknum = (n: number) => mkAst("number", n)
let mkstr = (s: string) => mkAst("string", s)
let mkvar = (name: string) => mkAst("var", {name})
let mkapp = (fn: AST, args: AST[]) => mkAst("app", {fn, args})
let mklet = (v: string, value: AST, body: AST) => mkAst("let", {var: mkvar(v), value, body})
let mkfun = (vars: string[], body: AST) => mkAst("function", {vars: vars.map(mkvar), body})
let annot = (type: AST, value: AST) => mkAst("annot", {type, value})
let builtin = (name: string) => mkAst("builtin", name)
let mkrecord = (fields: {[key : string] : AST}) => mkAst("record", Object.entries(fields).map(([k,v])=> [mkvar(k), v]))

Object.entries({
  "x": mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "@foo": mkAst("builtin", "foo"),
  "let x = 22 in x": mklet("x", mknum(22), mkvar("x")),
  "x :: @number": annot(builtin("number"), mkvar("x")),
  "{a: 22, b: x}": mkrecord({a: mknum(22), b: mkvar("x")}),
  "fn x => x": mkfun(["x"], mkvar("x")),
  "fn x y => x": mkfun(["x", "y"], mkvar("x")),
  "{e:22}" : mkrecord({e: mknum(22)}),
  "{e}": mkrecord({e: mkvar("e")}),
  "//comment\n22": parse("22"),

}).forEach(([code, expected]) => test_parse(code, expected as AST))

test_span("let x = 22\nin x", {
  start: {offset: 0, line: 1, col: 1},
  end: {offset: 15, line: 2, col: 5},
})
