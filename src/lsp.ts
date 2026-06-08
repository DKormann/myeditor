import { AST } from "./parser"
import { parse } from "./parser"
import {children} from "./parser"




export const astmap = (ast: AST): (AST | undefined)[] => {


  console.log(ast)
  let res: (AST | undefined)[] = Array.from({length: ast.span.end.offset}, ()=>undefined)
  const walk = (node: AST) => {
    for (let i = node.span.start.offset; i < node.span.end.offset; i++){res[i] = node}
    children(node).forEach(walk)
  }
  walk(ast)

  return res
}


{
  let ast = parse("let x = 2 in x")
  console.log(ast)
  console.log(astmap(ast).map(n=> n ? n.$ : " ").join("\n"))
}