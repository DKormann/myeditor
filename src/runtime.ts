
import {type AST} from "./parser"
import {parse, prettyAST, mkAst, mkvar} from "./parser"



export let NUMBER : AST = mkvar("number")
export let STRING : AST = mkvar("string")

export let ANY : AST = mkvar("any")

let builtins: Record<string, (...args:AST[]) => AST> = {
  "number": (n)=> {
    if (n.$ !== "number") throw new Error(`expected number, got ${n.$}`)
    n.type = NUMBER
    return n
  },
  "string": (s)=> {
    if (s.$ !== "string") throw new Error(`expected string, got ${s.$}`)
    s.type = STRING
    return s
  }
}


export const typeInfer = (ast: AST) : AST => {

  let annot = (ast: AST, type: AST): AST => {
    if (ast.type) {
      if (prettyAST(ast.type) !== prettyAST(type)) throw new Error(`Type error: expected ${prettyAST(type)}, got ${prettyAST(ast.type)}`)
      return ast
    }
    ast.type = type
    return ast
  }


  const go = (ast: AST, env:Env): AST => {
    switch (ast.$){
      case "number": return annot(ast, NUMBER)
      case "string": return annot(ast, STRING)
      case "var": {
        if (ast.content.name in builtins) return ast
        let e: Env | null = env
        while (e){
          if (e.name === ast.content.name) return annot(ast, e.value)
          e = e.next
        }
        throw new Error(`unbound variable ${ast.content.name}`)
      }
      case "let":{
        let valueType = go(ast.content.value, env).type
        if (valueType){
          annot(ast.content.var, valueType)
          env = {name: ast.content.var.content.name, value: valueType, next: env}
        }
        let bodyType = go(ast.content.body, env).type

        return bodyType ? annot(ast, bodyType) : ast

      }
      default: return ast
    }
  }

  return go(ast, null)

}


export const run = (ast: AST) : AST => {


  let env: Env = null

  const go = (ast: AST, env: Env): AST => {
    switch (ast.$){
      case "number":
      case "string": return ast
      case "var": {

        if (ast.content.name in builtins) return ast
        let e: Env | null = env

        while (e){
          if (e.name === ast.content.name) return e.value
          e = e.next
        }
        throw new Error(`unbound variable ${ast.content.name}`)
      }
      case "let":{
        let value = go(ast.content.value, env)
        let newEnv: Env = {name: ast.content.var.content.name, value, next: env}
        return go(ast.content.body, newEnv)
      }
      case "function": return ast
      case "app":{
        let fn = go(ast.content.fn, env)
        if (fn.$ == "var"){
          if (fn.content.name in builtins) {
            let args = ast.content.args.map(a=> go(a, env))
            return builtins[fn.content.name](...args)
          }
        }
        if (fn.$ !== "function") return mkAst("app", {fn, args: ast.content.args.map(a=> go(a, env))}, ast.span)
        if (fn.content.vars.length !== ast.content.args.length) throw new Error(`argument length mismatch`)

        let newEnv: Env = env
        for (let i = 0; i < fn.content.vars.length; i++){
          let argVal = go(ast.content.args[i], env)
          newEnv = {name: fn.content.vars[i].content.name, value: argVal, next: newEnv}
        }
        return go(fn.content.body, newEnv)
      }
      case "record": {
        return ast
      }
      default:
        throw new Error(`cannot run AST of type ${ast.$}`)
    }
  }

  return go(ast, env)

}


type Env = {
  name: string,
  value: AST,
  next: Env
} | null


{

  Object.entries({
    "let x= 22 in x": "22",
    "let x = 22 in let y = 33 in x": "22",
    "let f = fn x => x in f": "fn x => x",
    "let f = fn x => x in (f 33)": "33",
    "(let f = fn x => x in f 33)": "33",
    "(number 22)": "22",

  }).forEach(([code, expected])=>{
    let ast = parse(code)
    let res = ast
    try{
      res = run(ast)
    }catch(e){
      console.error(`Error running code: ${code}\n${e instanceof Error ? e.message : String(e)}`)
      return
    }
    let expectedAst = parse(expected)
    let outStr = prettyAST(res)
    let expectedStr = prettyAST(expectedAst)
    if (prettyAST(res) !== expected)
      console.error(`Test failed for code: ${code}\nExpected: ${expectedStr}\nGot: ${outStr}`)
  });

  [
    "(string 22)",
  ].forEach(code => {
    try{
      let ast = parse(code)
      let res = run(ast)
      console.error(`Test failed for code: ${code}\nExpected an error but got: ${prettyAST(res)}`)
    }catch(e){}
  })

}

