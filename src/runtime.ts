
import {type AST} from "./parser"
import {parse, prettyAST, mkAst, mkvar, mkapp, mkfun, mklet, Var} from "./parser"

let annot = (ast: AST, type: AST): AST => {
  if (ast.type) {
    if (prettyAST(ast.type) !== prettyAST(type)) throw new Error(`Type error: expected ${prettyAST(type)}, got ${prettyAST(ast.type)}`)
    return ast
  }
  ast.type = type
  return ast
}


export let NUMBER : AST = mkvar("number")
export let STRING : AST = mkvar("string")
export let TYPE : AST = mkvar("type")
NUMBER.type = TYPE
STRING.type = TYPE
TYPE.type = TYPE


export let ANY : AST = mkvar("any")

let builtins: Record<string, {
  type: AST,
  impl: (...args:AST[]) => AST
}> = {
  "number": {
    type: TYPE,
    impl: (n)=>  annot(n, NUMBER)
  },
  "string": {
    type: TYPE,
    impl: (s)=> annot(s, STRING)
  }
}



type Env = {
  name: string,
  value: AST
  next: Env
} | null

export const run = (ast: AST): AST => {

  let lookup = (name: string, env: Env): AST | null => {
    if (!env) return null
    if (env.name === name) return env.value
    return lookup(name, env.next)
  }

  let freename = (env:Env):string=>{
    let n = 0
    while(lookup(`x${n}`, env)) n++
    return `x${n}`
  }

  const dedup = (ast: AST, env:Env):AST=>{
    switch(ast.$){
      case "var": {
        let val = lookup(ast.content.name, env)
        if (val) return val
        return ast
      }
      case "app": {
        return mkapp(dedup(ast.content.fn, env), ast.content.args.map(arg => dedup(arg, env)))
      }
      case "function": {
        env = ast.content.vars.reduce((e, v) => ({name: v.content.name, value: v, next: e}), env)
        return mkAst("function", {
          vars: ast.content.vars,
          body: dedup(ast.content.body, env)
        }, ast.span)
      }
      case "let": {
        let value = dedup(ast.content.value, env)
        env = {name: ast.content.var.content.name, value, next: env}
        return mkAst("let", {
          var: ast.content.var,
          value,
          body: dedup(ast.content.body, env)
        }, ast.span)
      }
      case "record" :{
        return mkAst("record", ast.content.map(([v, val])=> [v, dedup(val, env)] as [Var, AST]), ast.span)
      }
      default: return ast
    }

  }

  const go = (ast: AST, vals: Env, types: Env): AST => {
    switch(ast.$){
      case "number": return annot(ast, NUMBER)
      case "string": return annot(ast, STRING)

      case "let": {
        let value = go(ast.content.value, vals, types)
        vals = {name: ast.content.var.content.name, value, next: vals}
        if (value.type){
          types = {name: ast.content.var.content.name, value: value.type, next: types}
          annot(ast.content.var, value.type)
        }
        let res = go(ast.content.body, vals, types)
        if (res.type) annot(ast, res.type)
        return res
      }

      case "var": {
        if (builtins[ast.content.name]) {
          let def = builtins[ast.content.name]
          return annot(ast, def.type)
        }
        let type = lookup(ast.content.name, types)
        if (type) annot(ast,type)
        let val = lookup(ast.content.name, vals)
        if (val) return val
        return ast
      }

      case "function": {
        let bod = go(ast.content.body, vals, types)
        let fvar = mkvar(freename(vals))
        if (bod.type) {
          annot(
            ast,
            mkAst("function", {
              vars: [fvar],
              body: mkAst("function", {
                vars: ast.content.vars,
                body: mkapp(bod.type, [mkapp(fvar, ast.content.vars.map(v=> v.type ? mkapp(v.type, [v]) : v))])
              }, ast.span)
            })
          )
        }
        return ast
      }

      case "app": {
        let fn = go(ast.content.fn, vals, types)
        let args = ast.content.args.map(arg => go(arg, vals, types))
        if (fn.$ == "var" && builtins[fn.content.name]) {
          let def = builtins[fn.content.name]
          let res = def.impl(...args)
          if (res.type) annot(ast, res.type)
          return res
        }
        if (args.some(a=>a.$ == "var")) return ast
        if (fn.$ == "function"){
          if (fn.content.vars.length !== args.length) throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`)
          // console.warn(`Function: ${prettyAST(fn)}`)
          let vals
        }
        return ast
      }

      default: return ast
    }
  }

  return go(dedup(ast, null), null, null)

}


{

  const assertEq = (expected: AST, got: AST, code: string) => {
    if (prettyAST(expected) !== prettyAST(got)) {
      console.error(`Test failed for code: ${code}\nExpected: ${prettyAST(expected)}\nGot: ${prettyAST(got)}`)
    }
  }


  let x = mkvar("x")
  let ast = mkapp(NUMBER, [x])
  let res = run(ast)
  assertEq(x.type!, NUMBER, "type of var in app")


  Object.entries({
    "22": "number",
    "\"hello\"" : "string",
    "let x = 22 in 33": "number",
    "let x = 22 in x": "number",
    "(number x)": "number",
    "fn x => (number x)": "fn x0 => fn x => (number (x0 (number x)))",
  }).forEach(([code, expected])=>{
    let ast = parse(code)
    let res = run(ast).type
    if (!res) {
      console.error(`TYPE Test failed for code: ${code}\nExpected: ${expected}\nGot: no type`)
      return
    }
    assertEq(parse(expected), res, `Type test for code: ${code}`)
  })

  Object.entries({
    "let x= 22 in x": "22",
    "let x = 22 in let y = 33 in x": "22",
    "let f = fn x => x in f": "fn x => x",
    "(fn x => x 33)": "33",
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

