
export type Env = {binder: Var, value: AST, next: Env} | [Env, Env] | null

export type Pos = {offset: number, line: number, col: number}
export type Span = {start: Pos, end: Pos}

export type Tag <T extends string, C> = {$: T, content: C, span: Span, type?: AST}

export type Var = Tag<"var", {name: string}>
export type Comment = Tag<"comment", string>
export type Func = Tag<"function", {vars: Var[], body: AST, env? :Env}>

export type ErrorNode = Tag<"error", {message: string, content: string}>

export type AST =
  | Tag<"app", {fn: AST, args: AST[]}>
  | Var
  | Func
  | Tag<"number", number>
  | Tag<"string", string>
  | Tag<"let", {var: Var, value: AST, body: AST}>
  | Tag<"record", [Var, AST][]>
  | ErrorNode

export type SyntaxNode = AST | Comment
export type ParseResult = {ast: AST, comments: Comment[], astmap: (SyntaxNode | undefined)[]}

const hasShownType = (v: Var) => v.type && !(v.type.$ === "var" && v.type.content.name === "any")
const prettyBinder = (v: Var): string => hasShownType(v) ? `(${prettyAST(v.type!)} ${v.content.name})` : v.content.name

export const prettyEnv = (env: Env) => "[[" + _prettyEnv(env)

const  _prettyEnv = ((env:Env) : string => (env === null) ? "]]"
  : (Array.isArray(env)) ? "[[" + _prettyEnv(env[0]) + " | [[" + _prettyEnv(env[1])
  : env.binder.content.name + ", " + _prettyEnv(env.next));
export const prettyAST = (node: AST): string =>{

  switch(node.$){
    case "number" : return node.content.toString()
    case "string" : return JSON.stringify(node.content)
    case "var": return node.content.name
    case "let": return `let ${prettyBinder(node.content.var)} = ${prettyAST(node.content.value)} in\n${prettyAST(node.content.body)}`
    case "function": return `${node.content.env? "ENV: [["+ prettyEnv(node.content.env) : ""}fn ${node.content.vars.map(prettyBinder).join(" ")} => ${prettyAST(node.content.body)}`
    case "app": return `(${prettyAST(node.content.fn)} ${node.content.args.map(prettyAST).join(" ")})`
    case "record": return `{${node.content.map(([k, v]) => `${k.content.name}: ${prettyAST(v)}`).join(", ")}}`
    case "error": return `[ERROR: ${node.content.message}]`
  }
}


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

class Parser {
  private i = 0

  constructor(private tokens: Token[], private source: string, private eof: Pos) {}

  parse(): AST {
    let ast = this.parseExpr()
    if (this.peek()) {
      let start = this.peek()!.span.start
      let end = this.tokens[this.tokens.length - 1]?.span.end ?? start
      return this.errorNode("Unexpected extra input after expression", {start, end}, this.source.slice(start.offset, end.offset))
    }
    return ast
  }

  private parseExpr(): AST {
    if (this.isKeyword("let")) return this.parseLet()
    if (this.isKeyword("fn")) return this.parseFunction()
    return this.parseAtom()
  }

  private parseLet(): AST {
    let start = this.expectKeyword("let").span.start
    let variable = this.parseLetBinder()
    if (variable.$ === "error") return variable

    let value: AST
    if (this.isSymbol("=")) {
      this.expectSymbol("=")
      value = this.parseExpr()
    } else {
      value = this.peek() ? this.wrapError("Expected '=' after let binding name", this.parseExpr()) : this.errorHere("Expected '=' after let binding name")
    }

    let body: AST
    if (this.isKeyword("in")) {
      this.expectKeyword("in")
      body = this.parseExpr()
    } else {
      body = this.peek() ? this.wrapError("Expected keyword in after let binding", this.parseExpr()) : this.errorHere("Expected keyword in after let binding")
    }

    return mkAst("let", {var: variable, value, body}, {start, end: body.span.end})
  }

  private parseFunction(): AST {
    let start = this.expectKeyword("fn").span.start
    let vars: Var[] = []
    while (this.peek()?.type === "ident" || this.isSymbol("(")) {
      let binder = this.parseBinder()
      if (binder.$ === "error") return mkAst("function", {vars, body: binder}, {start, end: binder.span.end})
      vars.push(binder)
    }
    let body: AST
    if (vars.length === 0) {
      if (this.matchToken("arrow")) body = this.wrapError("Function requires at least one parameter", this.parseExpr())
      else body = this.peek() ? this.wrapError("Function requires at least one parameter", this.parseExpr()) : this.errorHere("Function requires at least one parameter", start)
    } else if (!this.matchToken("arrow")) {
      body = this.peek() ? this.wrapError("Expected '=>' after function parameters", this.parseExpr()) : this.errorHere("Expected '=>' after function parameters")
    } else {
      body = this.parseExpr()
    }
    return mkAst("function", {vars, body}, {start, end: body.span.end})
  }

  private parseAtom(): AST {
    let token = this.peek()
    if (!token) return this.errorHere("Unexpected end of input")

    if (token.type === "ident") {
      this.i++
      return mkAst("var", {name: token.value}, token.span)
    }


    if (token.type === "number") {
      this.i++
      return mkAst("number", token.value, token.span)
    }

    if (token.type === "string") {
      this.i++
      return mkAst("string", token.value, token.span)
    }
    if (token.type === "error") {
      this.i++
      return mkAst("error", {message: token.message, content: token.content}, token.span)
    }

    if (this.isSymbol("(")) return this.parseParens()
    if (this.isSymbol("{")) return this.parseRecord()

    this.i++
    return this.errorNode(`Unexpected token: ${this.describe(token)}`, token.span)
  }

  private parseParens(): AST {
    let open = this.expectSymbol("(")
    let items: AST[] = []
    while (!this.isSymbol(")")) {
      if (!this.peek()) {
        let end = items.length > 0 ? items[items.length - 1].span.end : open.span.end
        return this.errorNode("Unterminated parenthesized expression", {start: open.span.start, end}, this.source.slice(open.span.start.offset, end.offset))
      }
      items.push(this.parseExpr())
    }
    let close = this.expectSymbol(")")
    if (items.length === 0) return this.errorNode("Empty parentheses are not allowed", {start: open.span.start, end: close.span.end}, this.source.slice(open.span.start.offset, close.span.end.offset))
    if (items.length === 1) return items[0]
    return mkAst("app", {fn: items[0], args: items.slice(1)}, {start: open.span.start, end: close.span.end})
  }

  private parseRecord(): AST {
    let open = this.expectSymbol("{")
    let fields: [Var, AST][] = []

    while (!this.isSymbol("}")) {
      if (!this.peek()) {
        let end = fields.length > 0 ? fields[fields.length - 1][1].span.end : open.span.end
        return this.errorNode("Unterminated record", {start: open.span.start, end}, this.source.slice(open.span.start.offset, end.offset))
      }
      let name = this.matchToken("ident")
      if (!name) {
        let token = this.peek()!
        this.i++
        return this.errorNode(`Expected record field name, got ${this.describe(token)}`, {start: open.span.start, end: token.span.end}, this.source.slice(open.span.start.offset, token.span.end.offset))
      }
      let key = mkAst("var", {name: name.value}, name.span)
      let value = this.isSymbol(":")
        ? (this.expectSymbol(":"), this.isSymbol("}") ? this.errorHere("Expected record field value after ':'") : this.parseExpr())
        : key
      fields.push([key, value])
      if (this.isSymbol(",")) this.i++
      else break
    }

    if (!this.isSymbol("}")) {
      let end = fields.length > 0 ? fields[fields.length - 1][1].span.end : open.span.end
      return this.errorNode("Unterminated record", {start: open.span.start, end}, this.source.slice(open.span.start.offset, end.offset))
    }
    let close = this.expectSymbol("}")
    return mkAst("record", fields, {start: open.span.start, end: close.span.end})
  }

  private parseBinder(): Var | Tag<"error", {message: string, content: string}> {
    if (this.isSymbol("(")) {
      this.expectSymbol("(")
      let declaredType = this.parseAtom()
      let name = this.matchToken("ident")
      if (!name) return this.errorHere("Expected identifier in binder pattern")
      if (!this.isSymbol(")")) return this.errorHere("Expected ')' after binder pattern")
      this.expectSymbol(")")
      if (declaredType.$ === "error") return declaredType
      let variable = mkAst("var", {name: name.value}, name.span)
      variable.type = declaredType
      return variable
    }
    let name = this.matchToken("ident")
    if (!name) return this.errorHere("Expected identifier")
    let variable = mkAst("var", {name: name.value}, name.span)
    if (this.isSymbol(":")) {
      this.expectSymbol(":")
      let declaredType = this.parseAtom()
      if (declaredType.$ === "error") return declaredType
      variable.type = declaredType
    }
    return variable
  }

  private parseLetBinder(): Var | Tag<"error", {message: string, content: string}> {
    return this.parseBinder()
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

  private matchToken<K extends Token["type"]>(type: K): Extract<Token, {type: K}> | undefined {
    let token = this.peek()
    if (!token || token.type !== type) return undefined
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

  private describe(token: Token | undefined): string {
    if (!token) return "end of input"
    if ("value" in token) return `${token.type}(${String(token.value)})`
    if (token.type === "error") return `error(${token.message})`
    return token.type
  }

  private errorNode(message: string, span?: Span, content?: string): ErrorNode {
    let finalSpan = span ?? this.pointSpan()
    return mkAst("error", {message, content: content ?? this.source.slice(finalSpan.start.offset, finalSpan.end.offset)}, finalSpan)
  }

  private errorHere(message: string, start?: Pos):ErrorNode {
    let span = this.peek()?.span ?? {start: this.eof, end: this.eof}
    return this.errorNode(message, {start: start ?? span.start, end: span.end})
  }

  private wrapError(message: string, node: AST): AST {
    return this.errorNode(message, node.span, this.source.slice(node.span.start.offset, node.span.end.offset))
  }

  private pointSpan(): Span {
    let token = this.peek()
    if (token) return token.span
    return {start: this.eof, end: this.eof}
  }
}

export const buildAstMap = (ast: AST, comments: Comment[] = []): (SyntaxNode | undefined)[] => {
  let maxEnd = comments.reduce((m, c) => c.span.end.offset > m ? c.span.end.offset : m, ast.span.end.offset)
  let res: (SyntaxNode | undefined)[] = Array.from({length: maxEnd}, ()=>undefined)
  const walk = (node: AST) => {
    for (let i = node.span.start.offset; i < node.span.end.offset; i++) res[i] = node
    children(node).forEach(walk)
  }
  walk(ast)
  comments.forEach(comment => {
    for (let i = comment.span.start.offset; i < comment.span.end.offset; i++) res[i] = comment
  })
  return res
}

export const parse = (code:string): ParseResult => {
  let {tokens, comments, eof} = tokenize(code)
  let ast = new Parser(tokens, code, eof).parse()
  return {ast, comments, astmap: buildAstMap(ast, comments)}
}

export const parseAST = (code:string): AST => parse(code).ast

export const children = (node: AST): AST[] => {
  if (node.$ === "function") return [...node.content.vars, node.content.body]
  if (node.$ === "app") return [node.content.fn, ...node.content.args]
  if (node.$ === "let") return [node.content.var, node.content.value, node.content.body]
  if (node.$ === "record") return node.content.flatMap(([key, value]) => [key, value])
  return []
}

const stripSpans = (ast: AST): unknown => {
  if (ast.$ === "function") return {$: ast.$, content: {vars: ast.content.vars.map(stripSpans), body: stripSpans(ast.content.body)}}
  if (ast.$ === "app") return {$: ast.$, content: {fn: stripSpans(ast.content.fn), args: ast.content.args.map(stripSpans)}}
  if (ast.$ === "let") return {$: ast.$, content: {var: stripSpans(ast.content.var), value: stripSpans(ast.content.value), body: stripSpans(ast.content.body)}}
  if (ast.$ === "record") return {$: ast.$, content: ast.content.map(([name, value]) => [stripSpans(name), stripSpans(value)])}
  if (ast.$ === "error") return {$: ast.$, content: ast.content}
  return {$: ast.$, content: ast.content}
}


let stringify = (x: unknown) => JSON.stringify(x, null, 2)

const test_parse = (code: string, expected: AST) => {
  let ast = parseAST(code)

  if (JSON.stringify(stripSpans(ast)) !== JSON.stringify(stripSpans(expected))) {
    console.error("Test failed for code:", code)
    console.error("Expected:", stringify(stripSpans(expected)))
    console.error("Got:", stringify(stripSpans(ast)))
    throw new Error(`Test failed for code: ${code}`)
  }
}

const test_span = (code: string, expected: Span) => {
  let ast = parseAST(code)
  if (JSON.stringify(ast.span) !== JSON.stringify(expected)) {
    console.error("Span test failed for code:", code)
    console.error("Expected:", expected)
    console.error("Got:", ast.span)
    throw new Error(`Span test failed for code: ${code}`)
  }
}

export let mknum = (n: number) => mkAst("number", n)
export let mkstr = (s: string) => mkAst("string", s)
export let mkvar = (name: string) => mkAst("var", {name})
export let mkapp = (fn: AST, args: AST[]) => mkAst("app", {fn, args})
export let mklet = (v: string | Var, value: AST, body: AST) => mkAst("let", {var: typeof v === "string" ? mkvar(v) : v, value, body})
export let mkfun = (vars: (string | Var)[], body: AST, env? :Env) => mkAst("function", {vars: vars.map(v => typeof v === "string" ? mkvar(v) : v), body, env}) as Func
export let annot = (type: AST, value: AST) => mkAst("annot", {type, value})
export let mkrecord = (fields: {[key : string] : AST}) => mkAst("record", Object.entries(fields).map(([k,v])=> [mkvar(k), v]))

Object.entries({
  "x": mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "let x = 22 in x": mklet("x", mknum(22), mkvar("x")),
  "{a: 22, b: x}": mkrecord({a: mknum(22), b: mkvar("x")}),
  "fn x => x": mkfun(["x"], mkvar("x")),
  "fn x y => x": mkfun(["x", "y"], mkvar("x")),
  "let (number x) = 22 in x": mklet(Object.assign(mkvar("x"), {type: mkvar("number")}), mknum(22), mkvar("x")),
  "fn (number x) (string y) => x": mkfun([
    Object.assign(mkvar("x"), {type: mkvar("number")}),
    Object.assign(mkvar("y"), {type: mkvar("string")}),
  ], mkvar("x")),
  "{e:22}" : mkrecord({e: mknum(22)}),
  "{e}": mkrecord({e: mkvar("e")}),
  "//comment\n22": parseAST("22"),
}).forEach(([code, expected]) => test_parse(code, expected as AST))

Object.entries({
  "(": mkAst("error", {message: "Unterminated parenthesized expression", content: "("}),
  "let x 22 in x": mkAst("let", {
    var: mkvar("x"),
    value: mkAst("error", {message: "Expected '=' after let binding name", content: "22"}),
    body: mkvar("x"),
  }),
  "{e:}": mkrecord({e: mkAst("error", {message: "Expected record field value after ':'", content: "}"})}),

}).forEach(([code, expected]) => test_parse(code, expected as AST))

test_span("let x = 22\nin x", {
  start: {offset: 0, line: 1, col: 1},
  end: {offset: 15, line: 2, col: 5},
})
