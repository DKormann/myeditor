
import { body, color, div, table, td, tr } from "./html"
import {mknum, Tag, type AST} from "./parser"
import {parse, prettyAST, mkAst, mkvar, mkapp, mkfun, mklet, Var} from "./parser"

let annot = (ast: AST, type: AST): AST & {type: AST} => {
  if (ast.type && prettyAST(ast.type) != prettyAST(type)) throw new Error(`Type error: expected ${prettyAST(type)}, got ${prettyAST(ast.type)}`)
  ast.type = type
  return ast as AST & {type: AST}

}

export let NUMBER : AST = mkvar("number")
export let STRING : AST = mkvar("string")
export let TYPE : AST = mkvar("type")
export let TYPEOF: AST = mkvar("typeof")

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
      throw new Error(`Type error: expected ${name}, got ${prettyAST(x.type)}`)


    }

    return annot(x, mkvar(name))
    // if (x.$ == "var")  annot(x, mkvar(name))
    // else if (x.$ == name) return annot(x, mkvar(name))

    // throw new Error(`Type error: expected ${name}, got ${prettyAST(x)}`)
  }
})

let builtins: Record<string, { type: AST, impl: (...args:AST[]) => AST }> = {
  number: primitiveType("number"),
  string: primitiveType("string"),
  "eq": {
    type: parse("fn f => fn x y => (number (f x y))").ast!,
    impl: (x,y) => mknum(
      (x.$ == "number" && y.$ == "number" && x.content == y.content) ||
      (x.$ == "string" && y.$ == "string" && x.content == y.content) || (x == y)
      ? 1 : 0)
  },
  "add": {
    type: parse("fn f=> fn x y => (number (f (number x) (number y)))").ast!,
    impl: (x,y) => {
      if (x.$ == "number" && y.$ == "number") return mknum(x.content + y.content)
      throw new Error(`Type error in add: expected numbers, got ${prettyAST(x)} and ${prettyAST(y)}`)
    }
  },
  "ifelse" : {
    type: parse("fn f => fn T cond then else => (T (f (number cond) (T then) (T else)))").ast!,
    impl: (cond, then, els) => {
      let val = cond.$ == "number" ? cond.content : cond.$ == "string" ? cond.content.length : 1
      return val ? then : els
    }
  },
  "typeof": {
    type: parse("fn f => fn x => (type (f x))").ast!,
    impl: (x) => {
      if (!x.type) return mkapp(TYPEOF, [x])
      return x.type
    }
  }
}
export type Env = {binder: Var, value: AST, next: Env} | null

let prettyEnv = (env: Env): string => {
  if (!env) return "{}"
  return `{${env.binder.content.name} : ${prettyAST(env.value.type ?? ANY)} = ${prettyAST(env.value)}} -> ` + prettyEnv(env.next)
}

export const run = (ast: AST): AST => {

  let lookup = (name: string, env: Env): Env => {
    if (!env) return null
    if (env.binder.content.name === name) return env
    return lookup(name, env.next)
  }

  let freename = (env:Env):string=>{
    let n = 0
    while(lookup(`x${n}`, env)) n++
    return `x${n}`
  }
  let bind = (env: Env, binder: Var, value: AST): Env => ({binder, value, next: env})
  let bindValue = (env: Env, binder: Var, value: AST, infer = false): Env => {

    if (binder.type)
      if (value.type && prettyAST(binder.type) != prettyAST(value.type!))
        throw new Error(`Type error in let: expected ${prettyAST(binder.type)}, got ${prettyAST(value.type!)}`)
    else binder.type = value.type
    return bind(env, binder, value)

  }

  const go = (ast: AST, env: Env): AST => {
    switch(ast.$){
      case "number": {
        ast.type = NUMBER
        return ast as AST & {type: AST}
      }
      case "string":{
        ast.type = STRING
        return ast as AST & {type: AST}
      }

      case "var": {
        if (builtins[ast.content.name]) {
          let def = builtins[ast.content.name]
          return annot(ast, def.type)
        }
        let hit = lookup(ast.content.name, env)
        if (hit) {
          if (hit.binder.type) annot(ast, hit.binder.type)
          return hit.value
        }
        return ast
      }
      case "let": {

        let value = go(ast.content.value, env)

        if (ast.content.var.type == undefined) annot(ast.content.var, value.type!)
        env = bindValue(env, ast.content.var, value, true)
        let res = go(ast.content.body, env)
        if (res.type) annot(ast, res.type)
        return res
      }
      case "function":{
        if (ast.content.env == undefined) ast.content.env = env

        let body = go(
          ast.content.body,
          ast.content.vars.reduce((env, v) => bind(env, v, v), ast.content.env as Env)
        )

        let fvar = mkvar(freename(env))
        let ftype: AST = mkfun( [fvar], mkfun(ast.content.vars, ast.content.body.type ?? mkapp(TYPEOF, [body])))
        annot(ast, ftype)
        let res = mkfun(ast.content.vars, body)
        res.content.env = ast.content.env
        return annot(res, ftype)
      }

      case "app": {
        let fn = go(ast.content.fn, env)
        let args = ast.content.args.map(arg => go(arg, env))

        if (fn.$ == "var" && builtins[fn.content.name]) {
          let res = builtins[fn.content.name].impl(...args)
          if (res.type) annot(ast, res.type)
          return res
        }
        if (fn.$ == "function"){

          if (fn.content.vars.length !== args.length) throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`)
          let callenv = fn.content.env as Env;
          callenv = fn.content.vars.reduce((env, v, i) => bindValue(env, v, args[i], true), callenv)
          let res = go(fn.content.body, callenv)
          if (res.type) annot(ast, res.type)

          return res
        }
        // throw new Error(`Cannot apply non-function ${prettyAST(fn)}`)
        return mkapp(fn, args)
      }
      default: return ast
    }
  }
  return go(ast, null)
}


let samples = [
  "22 | number | 22",
  'let x = 22 in x | number | 22',
  'let (number x) = 22 in x | number | 22',
  'fn x => x | fn x0 => fn x => (typeof x)',
  '(number 22) | number | 22',
  'fn (number x) => x | fn x0 => fn (number x) => number | fn (number x) => x',
  'fn x => (number x) | fn x0 => fn (number x) => number',
  '(fn x => x 22) | number',
  '(fn (number x) => x 22) | number',
  '(fn (string x) => x 22) | error',
  'let id = fn x => x in fn y => (id y) | fn x0 => fn y => (typeof y) | fn y => y',
  'fn (number x) => (string x) | error',
].map(code => code.split("|").map(s => s.trim()))


let results = table().style({
  width: "100%",
  whiteSpace: "pre",
})




for (let [code, expectedType, expectedResult] of samples){

  let ast = parse(code)
  let res : AST | undefined = undefined

  try{
    res = run(ast.ast)
  }catch(e){
    if (expectedType != "error") console.error(`Error running code: ${code}\n`, e)
  }

  let typeStr = res ? res.type ? prettyAST(res.type) : "no type" : "error"
  let resStr = res ? prettyAST(res) : "error"

  let check = (typeStr == (expectedType ?? typeStr) && resStr == (expectedResult ?? resStr))




  if (!check) {
    results.append(
      tr(
        td(code),
        td(typeStr).style({color: typeStr == (expectedType ?? typeStr) ? "green" : "red", padding: "0 8px"}),
        td(resStr).style({color: resStr == (expectedResult ?? resStr) ? "green" : "red"})
      )
      .style({
        borderBottom: "1px solid "+color.color,
      })
    )
    body.append(div(results)
    .style({
      position: "absolute",
      border: "1px solid "+color.color,
      padding: "16px",
      backgroundColor: color.background,
    }))
  }
}    



