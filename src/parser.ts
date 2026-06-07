


export type Tag <T extends string, C> = {$: T, content: C}

export type Var = Tag<"var", {name: string}>

export type AST =
  | Tag<"function", {vars: Var[], body: AST}>
  | Tag<"app", {fn: AST, args: AST[]}>
  | Var
  | Tag<"number", number>
  | Tag<"string", string>
  | Tag<"builtin", string>
  | Tag<"let", {var: string, value: AST, body: AST}>
  | Tag<"annot", {type: AST, value: AST}>
  | Tag<"record", [string, AST][]>


const mkAst = <T extends string, C>(tag: T, content: C): Tag<T, C> => ({$: tag, content})

export const parse = (code:string):AST => {

}



const test_parse = (code: string, expected: AST) => {
  let ast = parse(code)
  if (JSON.stringify(ast) !== JSON.stringify(expected)) {
    console.error("Test failed for code:", code)
    console.error("Expected:", expected)
    console.error("Got:", ast)
  } else {
    console.log("Test passed for code:", code)
  }
}


let mknum = (n: number) => mkAst("number", n)
let mkstr = (s: string) => mkAst("string", s)
let mkvar = (name: string) => mkAst("var", {name})
let mkapp = (fn: AST, args: AST[]) => mkAst("app", {fn, args})
let mklet = (v: string, value: AST, body: AST) => mkAst("let", {var: v, value, body})
let annot = (type: AST, value: AST) => mkAst("annot", {type, value})
let builtin = (name: string) => mkAst("builtin", "@"+name)

Object.entries({

  "x": mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "@foo": mkAst("builtin", "foo"),

  "let x = 22 in x": mklet("x", mknum(22), mkvar("x")),

  "x :: @number": annot(builtin("number"), mkvar("x")),


}).forEach(([code, expected]) => test_parse(code, expected as AST))
