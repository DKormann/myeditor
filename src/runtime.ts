import { colorOf } from "./editor"
import { body, color, div, NODE, pre, span } from "./html"
import {mknum, Prim, Tag, type AST, type Func, parse, mkvar, mkapp, Var, prettyAST, mkAst, mkfun} from "./parser"

export let NUMBER : AST = mkvar("number")
export let STRING : AST = mkvar("string")
export let TYPE   : AST = mkvar("type")
export let TYPEOF : AST = mkvar("typeof")

NUMBER.type = TYPE
STRING.type = TYPE
TYPE.type = TYPE
TYPEOF.type = parse("fn f => fn x => type").ast!

export let ANY : AST = mkvar("any")

let primitiveType = (name: string) => ({
  type: TYPE,
  impl: (x: AST) => {
    if (x.type) {
      if (x.type.$ == "var" && x.type.content.name == name) return x
      throw new Error(`Type error: expected ${name}, got ${(x.type)}`)
    }
    x.type = mkvar(name)
    return x
  }
})

let builtins: Record<string, { type: AST, impl: (...args:AST[]) => AST }> = {
  number: primitiveType("number"),
  string: primitiveType("string"),
  eq: {
    type: parse("fn f => fn x y => (number (f x y))").ast!,
    impl: (x,y) => mknum(
      (x.$ == "number" && y.$ == "number" && x.content == y.content) ||
      (x.$ == "string" && y.$ == "string" && x.content == y.content) || (x == y)
      ? 1 : 0)
  },
  add: {
    type: parse("fn f=> fn x y => (number (f (number x) (number y)))").ast!,
    impl: (x,y) => {
      if (x.$ == "number" && y.$ == "number") return mknum(x.content + y.content)
      throw new Error(`Type error in add: expected numbers, got ${prettyAST(x)} and ${prettyAST(y)}`)
    }
  },
  ifelse : {
    type: parse("fn f => fn T cond then else => (T (f (number cond) (T then) (T else)))").ast!,
    impl: (cond, then, els) => {
      let val = cond.$ == "number" ? cond.content : cond.$ == "string" ? cond.content.length : 1
      return val ? then : els
    }
  },
  typeof: {
    type: parse("fn f => fn x => type").ast!,
    impl: (x) => {
      if (!x.type) return mkapp(TYPEOF, [x])
      return x.type
    }
  }
}

let DEBUG = 0
let loggerPre = pre()
body.replaceChilren(loggerPre)


type Vis = NODE | string | undefined | null | AST | Vis[] | number

let debug = (...args: Vis[]) => {
  if (!DEBUG) return
  let pr = loggerPre
  for (let arg of args){
    if (typeof arg == "string" || typeof arg == "number") pr.append(String(arg))
    else if (Array.isArray(arg)) ["[", ...arg, "]"].forEach(a=> debug(a))
    else if (arg === undefined || arg === null) pr.append(span(String(arg)).style({color: color.gray}))
    else if ("$" in arg){
      if (arg.$ == "NODE") pr.append(arg)
      else pr.append(astView(arg))
    }
  }
}

let debugCall = <ARGS extends any[], T> (fn: (...args: ARGS) => T) => (...args: ARGS) : T => {
  debug("@ ", fn.name, ...args)
  let oldpre = loggerPre
  let callpre = pre().style({borderLeft: "4px solid "+color.gray, marginLeft: "8px", paddingLeft: "8px"})
  loggerPre.append(callpre)
  loggerPre = callpre
  let res = fn(...args)
  loggerPre = oldpre
  debug(res as any)
  return res
}


let astView = (ast: AST | Value): NODE => {
  let _view = (ast: AST | Value): NODE => {
    let el = span()
    switch(ast.$){
      case "number":
      case "string": return el.append(String(ast.content)).style({color: color.blue})  
      case "var": return el.append(ast.content.name)
      case "function": return el.append( "fn (",...ast.content.vars.map(go),") => ").append(go(ast.content.body))
      case "app": return el.append("(", go(ast.content.fn), " ", ...ast.content.args.map(arg=>go(arg)), ")")
      case "let": return el.append("let ", ast.content.var.content.name, " = ", go(ast.content.value), " in ", go(ast.content.body))
      default: return el.append(`[${ast.$}]`)
    }  
  }
  let go = (ast:AST|Value): NODE => {
    let el = span(_view(ast)).style({color: colorOf(ast), cursor: "pointer"})
    .onclick(e=>{
      el.replaceChilren(
        span("TYPE:").style({color: color.gray})
        .onclick(e=>{
          el.replaceChilren(_view(ast))
          e.stopImmediatePropagation()
        }),
        ast.type ? astView(ast.type) : "*",
        go(ast)
      )
      e.stopPropagation()
    })
    return el
  }
  return div(go(ast)).style({padding:".4em", border: "1px solid "+color.gray, borderRadius: ".4em", margin:".4em 0"})
}

astView = debugCall(astView)

type Neutral = Var | Prim | Tag<"Napp", {fn: Neutral, args: Value[]}>
type Value = Tag<"function", {env: Env, vars: Var[], body: AST}> | Neutral
type Env = Record<string, Value>

const evaluate = (term:AST, env: Env): Value => {
  switch (term.$) {
    case "var": {
      if (env[term.content.name]) return env[term.content.name]
      return term
    }
    case "function": return mkAst("function", {...term.content, env}) 
    case "app": return apply(
      evaluate(term.content.fn, env),
      term.content.args.map(arg => evaluate(arg, env))
    )
    case "let":
      return evaluate(term.content.body, {...env, [term.content.var.content.name]: evaluate(term.content.value, env)})
    case "number":
    case "string": return term
  }
  throw new Error(`Cannot evaluate term of type ${term.$}`)
}

const apply = (fn: Value, args: Value[]): Value => {
  if (fn.$ == "function"){

    if (fn.content.vars.length != args.length) throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`)
    let env = {...fn.content.env}
    fn.content.vars.forEach((v,i)=> env[v.content.name] = args[i])
    return evaluate(fn.content.body, env)
  }
  return mkAst("Napp", {fn, args})
}

let counter = 0;

const readback = (val: Value): AST => {
  if (val.$ == "function")
    return mkfun(val.content.vars, readback(apply(val, val.content.vars)))
  if (val.$ == "Napp") return mkapp(readback(val.content.fn), val.content.args.map(readback))
  return val
}


export const run = (ast: AST) => readback(evaluate(ast, {}))

DEBUG = 1

let ast = parse('(fn x => fn y => x 3)').ast

let res = run(ast)


DEBUG = 0
