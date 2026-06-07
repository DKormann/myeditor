


export type Tag <T extends string, C> = {$: T, content: C}

export type Var = Tag<"var", {name: string}>

export type AST =
  | Tag<"function", {vars: Var[], body: AST}>
  | Tag<"app", {fn: AST, args: AST[]}>
  | Var
  | Tag<"number", number>
  | Tag<"string", string>
  | Tag<"builtin", string>
  | Tag<"let", {var: Var, value: AST, body: AST}>
  | Tag<"annot", {type: AST, value: AST}>
  | Tag<"bridge", {var:Var, body: AST}>
  | Tag<"record", [string, AST][]>


// ({x: x=> x+1} {x: 22, y: 33})

// {x: 22}
// (T: lam)


const mkAst = <T extends string, C>(tag: T, content: C): Tag<T, C> => ({$: tag, content})

export const parse = (code:string):AST => {

}


