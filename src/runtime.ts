import { ARG, body, color, div, NODE, p, pre } from "./html"
import {Env, mknum, type AST, type Func} from "./parser"
import {parse, prettyAST, mkvar, mkapp, mkfun, mklet, Var} from "./parser"


export let NUMBER : AST = mkvar("number")
export let STRING : AST = mkvar("string")
export let TYPE : AST = mkvar("type")
export let TYPEOF: AST = mkvar("typeof");

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
    x.type = mkvar(name)
    return x
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

let debug = (...args: string[]) => {
  if (DEBUG) loggerPre.append(pre(args.join(" ")).style({border: "1px solid " + color.color, padding:".4em", borderRadius: ".3em", margin:".4em"}))
}

export const run = (ast: AST): AST => {

  let lookup = (name: string, env: Env): {binder: Var, value: AST} | null => {
    if (!env) return null
    if (Array.isArray(env)) return lookup(name, env[0]) || lookup(name, env[1])
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

  let annot = (ast: AST, type?: AST): AST => {
    if (type == undefined) throw new Error("Cannot annotate with undefined type")
    if (ast.type && prettyAST(ast.type) != prettyAST(type)) throw new Error(`Type error: expected ${prettyAST(type)}, got ${prettyAST(ast.type)}`)
    ast.type = type
    return ast
  }

  const _go = (ast: AST, env: Env): AST => {
    let call = (fn : AST, args: AST[]): AST => {
      debug("Calling", prettyAST(fn), "with args", args.map(prettyAST).join("\n"))
      if (fn.$ == "var" && builtins[fn.content.name]) throw new Error("not implemented")
      if (fn.$ == "function"){
        if (fn.content.vars.length !== args.length) throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`)
        if (fn.content.env === undefined) throw new Error("Function has no environment")
        return go(
          fn.content.body,
          fn.content.vars.reduce((env, v, i) => bindValue(env, v, args[i], true), fn.content.env as Env)
        )
      }
      return mkapp(fn,args)

    }

    switch(ast.$){
      case "number": return annot(ast, NUMBER)
      case "string": return annot(ast, STRING)

      case "var": {
        if (builtins[ast.content.name]) annot(ast, builtins[ast.content.name].type)
        let hit = lookup(ast.content.name, [env, {binder: ast ,value: ast, next: null}])!
        if (hit.binder.type) annot(ast, hit.binder.type)
        return hit.value

      }
      case "let": {
        let value = go(ast.content.value, env)
        annot(ast.content.var, value.type!)
        let res = go(ast.content.body, bindValue(env, ast.content.var, value, true))
        annot(ast, res.type)
        return res
      }
      case "function":{
        if (ast.content.env == undefined) ast.content.env = env
        let runbod = call(ast, ast.content.vars)
        let fvar = mkvar(freename(env))
        let ftype = mkfun([fvar], mkfun(ast.content.vars, runbod))
        return annot(mkfun(ast.content.vars, runbod, ast.content.env), ftype)
      }

      case "app": {
        let fn = go(ast.content.fn, env)
        let args = ast.content.args.map(arg => go(arg, env))
        let res = call(fn, args)
        if (res.type) annot(ast, res.type)
        return res
      }
      default: return ast
    }
  }

  const go = (ast: AST, env: Env): AST => {
    let res = _go(ast, env)
    debug("AST:", prettyAST(ast), "\nType:", prettyAST(res.type ?? ANY), "\n->", prettyAST(res))
    let restype = res.type;
    if (restype) annot(ast, restype)
    return res
  }
  return go(ast, null)
}



DEBUG = 1

let ast = parse('(fn x => fn y => x 3)').ast
let res = run(ast!)

DEBUG = 0


// let samples = [
//   "22 | number | 22",
//   'let x = 22 in x | number | 22',
//   'let (number x) = 22 in x | number | 22',
//   'fn x => x | fn x0 => fn x => (typeof x)',
//   '(number 22) | number | 22',
//   'fn (number x) => x | fn x0 => fn (number x) => number | fn (number x) => x',
//   'fn x => (number x) | fn x0 => fn (number x) => number',
//   '(fn x => x 22) | number',
//   '(fn (number x) => x 22) | number',
//   '(fn (string x) => x 22) | error',
//   'let id = fn x => x in fn y => (id y) | fn x0 => fn y => (typeof y) | fn y => y',
//   'fn (number x) => (string x) | error',
//   'fn x => fn y => y | fn x0 => fn x => fn x0 => fn y => (typeof y)',
//   'fn x => fn y => x | fn x0 => fn x => fn x0 => fn y => (typeof x)',
//   '(fn x=> fn y => x 3) | fn x0 => fn y => number',
//   '((fn x=> fn y=> x 3) 2) | number | 3'

// ].map(code => code.split("|").map(s => s.trim()))


// let results = table().style({
//   width: "100%",
//   whiteSpace: "pre",
// })




// for (let [code, expectedType, expectedResult] of samples){

//   let ast = parse(code)
//   let res : AST | undefined = undefined

//   let errmessage: string = ""
//   try{ res = run(ast.ast)
//   } catch(e) {
//     errmessage = String(e)
//     if (expectedType != "error") console.error(`Error running code: ${code}\n`, e)
//   }

//   let typeStr = res ? res.type ? prettyAST(res.type) : "no type" : "error"
//   let resStr = res ? prettyAST(res) : "error"
//   let check = (typeStr == (expectedType ?? typeStr) && resStr == (expectedResult ?? resStr))

//   typeStr = typeStr == "error" ? errmessage : typeStr
//   resStr = resStr == "error" ? errmessage : resStr

//   if (!check) {
//     results.append(
//       tr(
//         td(code),
//         td(typeStr).style({color: typeStr == (expectedType ?? typeStr) ? "green" : "red", padding: "0 8px"}),
//         td(resStr).style({color: resStr == (expectedResult ?? resStr) ? "green" : "red"})
//       )
//       .style({borderBottom: "1px solid "+color.color,})
//     )
//     body.append(div(results)
//     .style({
//       position: "absolute",
//       border: "1px solid "+color.color,
//       padding: "16px",
//       backgroundColor: color.background,
//     }))
//   }
// }    



