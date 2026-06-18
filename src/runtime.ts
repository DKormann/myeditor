import { colorOf } from "./editor"
import { ARG, body, color, div, NODE, p, pre, span } from "./html"
import {Env, mknum, prettyEnv, type AST, type Func} from "./parser"
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


const astView = (ast: AST): NODE => {


  let _view = (ast: AST): NODE => {
    let el = span()
    switch(ast.$){
      case "number":
      case "string": return el.append(String(ast.content)).style({color: color.blue})  
      case "var": return el.append(ast.content.name)
      case "function": return el.append( ast.content.env ? prettyEnv(ast.content.env) : "" , "fn (",...ast.content.vars.map(go),") => ").append(go(ast.content.body))
      case "app": return el.append("(", go(ast.content.fn), " ", ...ast.content.args.map(arg=>go(arg)), ")")
      case "let": return el.append("let ", ast.content.var.content.name, " = ", go(ast.content.value), " in ", go(ast.content.body))
      default: return el.append(`[${ast.$}]`)
    }  
  }

  let go = (ast:AST): NODE => {
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



type Vis = NODE|string| undefined | null | AST | Vis[] | number

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

  let go = (ast: AST, env: Env): AST => {

    if (env) debug(prettyEnv(env))
    let call = (fn : AST, args: AST[] ): AST =>{
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
    call = debugCall(call)

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

  go = debugCall(go)
  return go(ast, null)
}


// let F = (x:number, y:string) => x
// type arg = typeof F extends (...args: infer A) => any ? A : never


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



