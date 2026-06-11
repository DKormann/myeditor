
import {mknum, Tag, type AST} from "./parser"
import {parse, prettyAST, mkAst, mkvar, mkapp, mkfun, mklet, Var} from "./parser"

let annot = (ast: AST, type: AST): AST => {
  if (ast.type) {
    if (prettyAST(ast.type) === prettyAST(ANY)) {
      ast.type = type
      return ast
    }
    if (prettyAST(type) === prettyAST(ANY)) return ast
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
  },
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
  }

}





export type Env = {binder: Var, value: AST, next: Env} | null

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

    let checked = binder.type ?  (binder.type.$ === "var" && builtins[binder.type.content.name]) ? builtins[binder. type.content.name].impl(value)
    : annot(value, binder.type) : value


    if (!binder.type) binder.type = infer ? checked.type ?? ANY : ANY
    return bind(env, binder, checked)
  }

  const go = (ast: AST, env: Env): AST => {
    switch(ast.$){
      case "number": return annot(ast, NUMBER)
      case "string": return annot(ast, STRING)

      case "let": {
        let value = go(ast.content.value, env)
        let res = go(ast.content.body, bindValue(env, ast.content.var, value, true))
        if (res.type) annot(ast, res.type)
        return res
      }

      case "var": {
        if (builtins[ast.content.name]) {
          let def = builtins[ast.content.name]
          return annot(ast, def.type)
        }
        let hit = lookup(ast.content.name, env)
        if (hit) {
          annot(ast, hit.binder.type ?? ANY)
          return hit.value
        }
        annot(ast, ANY)
        return ast
      }

      case "function": {
        if (ast.content. env == undefined) ast.content.env = env
        let funenv = ast.content.env
        for (let i = ast.content.vars.length - 1; i >= 0; i--) {
          funenv = bindValue(funenv, ast.content.vars[i], ast.content.vars[i])
        }
        let bod = go(ast.content.body, funenv)
        let fvar = mkvar(freename(env))
        let ftype = mkAst("function", {
            vars: [fvar],
            body: mkAst("function", {
              vars: ast.content.vars,
              body: bod.type ?
                mkapp(bod.type, [mkapp(fvar, ast.content.vars.map(v=> v.type ? mkapp(v.type, [v]) : v))])
                : mkapp(fvar, ast.content.vars.map(v=> v.type ? mkapp(v.type, [v]) : v))
            }, ast.span)
          });
        
        annot(ast,ftype)
        ast.content.env = env
        return ast
      }

      case "app": {
        let fn = go(ast.content.fn, env)
        let args = ast.content.args.map(arg => go(arg, env))
        if (fn.$ == "var" && builtins[fn.content.name]) {
          let def = builtins[fn.content.name]
          let res = def.impl(...args)

          if (res.type) annot(ast, res.type)
          return res
        }
        if (fn.$ == "function"){
          if (fn.content.vars.length !== args.length) throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`)

          let callenv = fn.content.env
          if (callenv == undefined) throw new Error("Function has no environment")
          for (let i = fn.content.vars.length - 1; i >= 0; i--) callenv = bindValue(callenv, fn.content.vars[i], args[i])

          let res = go(fn.content.body, callenv)
          if (res.type) annot(ast, res.type)
          return res
        }
        annot(ast, ANY)
        return ast
      }

      default: return ast
    }
  }

  return go(ast, null)

}


{

  const assertEq = (got: AST | undefined, expected: AST| undefined, code: string) => {


    let A = expected ? prettyAST(expected) : "undefined"
    let G = got ? prettyAST(got) : "undefined"

    if (A !== G) {
      console.error(`Test failed for code: ${code}\nExpected: ${A}\nGot     : ${G}`)
    }
  }


  let x = mkvar("x")
  let ast = mkapp(NUMBER, [x])
  run(ast)
  assertEq(x.type, NUMBER, "type of var in app")
  assertEq(ast.type, NUMBER, "type of app")

  
  let t = parse("fn x => x").ast

  run(t)

  Object.entries({
    "22": "number",
    "\"hello\"" : "string",
    "let x = 22 in 33": "number",
    "let x = 22 in x": "number",
    "(number x)": "number",
  }).forEach(([code, expected])=>{
    let ast = parse(code).ast
    let res = run(ast).type
    if (!res) {
      console.error(`TYPE Test failed for code: ${code}\nExpected: ${expected}\nGot: no type`)
      return
    }
    assertEq(parse(expected).ast, res, `Type test for code: ${code}`)
  })

  

  Object.entries({

    "let x= 22 in x": "22",
    "let x = 22 in let y = 33 in x": "22",
    "let f = fn x => x in f": "fn x => x",
    "(fn x => x 33)": "33",
    "let f = fn x => x in (f 33)": "33",
    "(let f = fn x => x in f 33)": "33",
    "(number 22)": "22",
    // "(fn x => fn x => x 33)" : "fn x=>x",

  }).forEach(([code, expected])=>{
    let ast = parse(code).ast
    let res = ast
    try{
      res = run(ast)
    }catch(e){
      console.error(`Error running code: ${code}\n${e instanceof Error ? e.message : String(e)}`)
      return
    }
    let expectedAst = parse(expected).ast
    assertEq(expectedAst, res, `Runtime test for code: ${code}`)
  });

  [
    "(string 22)",
  ].forEach(code => {
    try{
      let ast = parse(code).ast
      let res = run(ast)
      console.error(`Test failed for code: ${code}\nExpected an error but got: ${prettyAST(res)}`)
    }catch(e){}
  })

}
