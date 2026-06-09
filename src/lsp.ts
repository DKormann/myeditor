import { AST, Var } from "./parser"
import { parse } from "./parser"
import {run} from "./runtime"
import {children} from "./parser"




export const astmap = (ast: AST): (AST | undefined)[] => {

  let res: (AST | undefined)[] = Array.from({length: ast.span.end.offset}, ()=>undefined)
  const walk = (node: AST) => {
    for (let i = node.span.start.offset; i < node.span.end.offset; i++){res[i] = node}
    children(node).forEach(walk)
  }
  walk(ast)

  return res
}


export const getdef = (root: AST, vari: Var): AST | undefined => {
  if (root.span.start.offset > vari.span.start.offset || root.span.end.offset < vari.span.end.offset) return undefined
  for (let child of children(root)){
    let res = getdef(child, vari)
    if (res) return res
  }

  if (root.$ === "let" && root.content.var.content.name === vari.content.name)
    return root.content.var

  if (root.$ === "function")
    for (let v of root.content.vars)
      if (v.content.name === vari.content.name)
        return v
}