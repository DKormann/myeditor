// src/html.ts
var html = (tag) => (...children) => {
  let onclick = children.find((c) => typeof c === "function");
  let el = fromHTML(document.createElement(tag)).append(...children.filter((c) => typeof c !== "function"));
  if (onclick)
    el.onclick(onclick);
  return el;
};
var fromHTML = (el) => {
  let node = {
    $: "NODE",
    el,
    append: (...children) => {
      children.forEach((child) => {
        if (typeof child === "string")
          el.appendChild(document.createTextNode(child));
        else
          el.appendChild(child.el);
      });
      return fromHTML(el);
    },
    replaceChilren: (...children) => {
      el.replaceChildren();
      return node.append(...children);
    },
    style: (styles) => {
      Object.assign(el.style, styles);
      return fromHTML(el);
    },
    onclick: (handler) => {
      el.addEventListener("click", handler);
      return fromHTML(el);
    }
  };
  return node;
};
document.createElement;
var div = html("div");
var span = html("span");
var p = html("p");
var body = fromHTML(document.body);
var h1 = html("h1");
var h2 = html("h2");
var h3 = html("h3");
var h4 = html("h4");
var canvas = html("canvas");
var button = html("button");

// src/editor.ts
var editor = (oninput, lsp, getcolormap) => {
  let lines = localStorage.getItem("lines")?.split(`
`) || ["", '"hello world"', ""];
  let cursor = { col: 0, row: 0 };
  let el = html("pre")().style({
    userSelect: "none"
  });
  let hist = [];
  let elements = new WeakMap;
  let setCursor = (pos) => {
    cursor = pos;
    render();
  };
  let colormap = [];
  const render = () => {
    let code = lines.join(`
`);
    let scol = Math.min(cursor.col, lines[cursor.row].length);
    let chars = [];
    let mkcolor = () => {
      let cmapi = 0;
      chars.forEach((c, i) => {
        while (cmapi < colormap.length && colormap[cmapi].span.end.offset <= i)
          cmapi++;
        if (cmapi < colormap.length && colormap[cmapi].span.start.offset <= i && i < colormap[cmapi].span.end.offset) {
          c.style.color = colormap[cmapi].color;
        } else {
          c.style.color = "";
        }
      });
    };
    el.replaceChilren(...lines.map((line, row) => {
      let par = p(...line.split("").concat(" ").map((char, col) => {
        let chr = span(char, (e) => elements.set(chr.el, { row, col })).style(row == cursor.row && col == scol ? { backgroundColor: "white", color: "black" } : {});
        chars.push(chr.el);
        return chr;
      }), (e) => elements.set(par.el, { row, col: line.length })).style({ margin: "0" });
      return par;
    }));
    mkcolor();
    if (hist[hist.length - 1] != code) {
      localStorage.setItem("lines", code);
      oninput(code);
      hist.push(code);
      colormap = getcolormap();
      mkcolor();
    }
  };
  window.addEventListener("keydown", (e) => {
    if (e.key.length === 1) {
      if (e.metaKey) {
        if (e.key == "z") {
          if (hist.length > 1) {
            hist.pop();
            let last = hist[hist.length - 1];
            hist.pop();
            lines = last.split(`
`);
            setCursor({ row: 0, col: 0 });
          }
        }
        return;
      }
      lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + e.key + lines[cursor.row].substring(cursor.col);
      cursor.col++;
      render();
    }
    if (e.key === "Backspace") {
      if (e.metaKey && cursor.col > 0) {
        lines = [...lines.slice(0, cursor.row), lines[cursor.row].substring(cursor.col), ...lines.slice(cursor.row + 1)];
        cursor.col = 0;
      } else if (cursor.col > 0) {
        cursor.col--;
        lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + lines[cursor.row].substring(cursor.col + 1);
      } else if (cursor.row > 0) {
        cursor.row--;
        cursor.col = lines[cursor.row].length;
        lines = [...lines.slice(0, cursor.row), lines[cursor.row] + lines[cursor.row + 1], ...lines.slice(cursor.row + 2)];
      }
    }
    if (e.key === "ArrowLeft") {
      if (e.metaKey) {
        if (cursor.col > 0) {
          cursor.col = 0;
        } else if (cursor.row > 0) {
          cursor.row--;
          cursor.col = lines[cursor.row].length;
        }
      } else if (cursor.col > 0) {
        cursor.col--;
      } else if (cursor.row > 0) {
        cursor.row--;
        cursor.col = lines[cursor.row].length;
      }
    }
    if (e.key === "ArrowRight") {
      if (e.metaKey) {
        if (cursor.col < lines[cursor.row].length)
          cursor.col = lines[cursor.row].length;
        else if (cursor.row < lines.length - 1) {
          cursor.row++;
          cursor.col = 0;
        }
      } else if (cursor.col < lines[cursor.row].length)
        cursor.col++;
      else if (cursor.row < lines.length - 1) {
        cursor.row++;
        cursor.col = 0;
      }
    }
    if (e.key === "ArrowUp") {
      if (e.metaKey)
        cursor.row = 0;
      else if (cursor.row > 0)
        cursor.row--;
    }
    if (e.key === "ArrowDown") {
      if (e.metaKey)
        cursor.row = lines.length - 1;
      else if (cursor.row < lines.length - 1)
        cursor.row++;
    }
    if (e.key === "Enter") {
      lines = [
        ...lines.slice(0, cursor.row),
        lines[cursor.row].substring(0, cursor.col),
        (lines[cursor.row].match(/^\s*/)?.[0] || "") + lines[cursor.row].substring(cursor.col),
        ...lines.slice(cursor.row + 1)
      ];
      cursor.row++;
      cursor.col = lines[cursor.row].match(/^\s*/)?.[0].length || 0;
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
    }
    render();
  });
  window.addEventListener("click", (e) => {
    if (elements.has(e.target)) {
      setCursor(elements.get(e.target));
    }
  });
  render();
  return { el, setText: (text) => {
    lines = text.split(`
`);
    setCursor({ row: 0, col: 0 });
    render();
  } };
};

// src/parser.ts
var zeroPos = () => ({ offset: 0, line: 1, col: 1 });
var zeroSpan = () => ({ start: zeroPos(), end: zeroPos() });
var mkAst = (tag, content, span2 = zeroSpan()) => ({ $: tag, content, span: span2 });
var tokenize = (code) => {
  let tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  let isAlpha = (char) => /[A-Za-z_]/.test(char);
  let isDigit = (char) => /[0-9]/.test(char);
  let isIdent = (char) => /[A-Za-z0-9_]/.test(char);
  let pos = () => ({ offset: i, line, col });
  let advance = () => {
    if (code[i] === `
`) {
      i++;
      line++;
      col = 1;
    } else {
      i++;
      col++;
    }
  };
  let push = (token, start) => {
    tokens.push({ ...token, span: { start, end: pos() } });
  };
  while (i < code.length) {
    let char = code[i];
    if (/\s/.test(char)) {
      advance();
      continue;
    }
    if (char === ":" && code[i + 1] === ":") {
      let start = pos();
      advance();
      advance();
      push({ type: "annot" }, start);
      continue;
    }
    if (char === "=" && code[i + 1] === ">") {
      let start = pos();
      advance();
      advance();
      push({ type: "arrow" }, start);
      continue;
    }
    if ("(){}=,:".includes(char)) {
      let start = pos();
      let value = char;
      advance();
      push({ type: "symbol", value }, start);
      continue;
    }
    if (char === "@") {
      let start = pos();
      advance();
      let valueStart = i;
      while (i < code.length && isIdent(code[i]))
        advance();
      if (valueStart === i)
        throw new Error("Expected builtin name after @");
      push({ type: "builtin", value: code.slice(valueStart, i) }, start);
      continue;
    }
    if (char === '"') {
      let start = pos();
      advance();
      let value = "";
      while (i < code.length) {
        let current = code[i];
        if (current === "\\") {
          let next = code[i + 1];
          if (next === undefined)
            throw new Error("Unterminated string escape");
          let escaped = { n: `
`, r: "\r", t: "\t", '"': '"', "\\": "\\" }[next];
          value += escaped ?? next;
          advance();
          advance();
          continue;
        }
        if (current === '"')
          break;
        value += current;
        advance();
      }
      if (code[i] !== '"')
        throw new Error("Unterminated string literal");
      advance();
      push({ type: "string", value }, start);
      continue;
    }
    if (isDigit(char)) {
      let start = pos();
      let valueStart = i;
      while (i < code.length && isDigit(code[i]))
        advance();
      push({ type: "number", value: Number(code.slice(valueStart, i)) }, start);
      continue;
    }
    if (isAlpha(char)) {
      let start = pos();
      let valueStart = i;
      while (i < code.length && isIdent(code[i]))
        advance();
      let value = code.slice(valueStart, i);
      if (value === "let" || value === "in" || value === "fn")
        push({ type: "keyword", value }, start);
      else
        push({ type: "ident", value }, start);
      continue;
    }
    throw new Error(`Unexpected character: ${char}`);
  }
  return tokens;
};

class Parser {
  tokens;
  i = 0;
  constructor(tokens) {
    this.tokens = tokens;
  }
  parse() {
    let ast = this.parseExpr();
    if (this.peek())
      throw new Error(`Unexpected token at end: ${this.describe(this.peek())}`);
    return ast;
  }
  parseExpr() {
    if (this.isKeyword("let"))
      return this.parseLet();
    if (this.isKeyword("fn"))
      return this.parseFunction();
    return this.parseAnnot();
  }
  parseLet() {
    let start = this.expectKeyword("let").span.start;
    let name = this.expectIdent();
    this.expectSymbol("=");
    let value = this.parseExpr();
    this.expectKeyword("in");
    let body2 = this.parseExpr();
    return mkAst("let", { var: name, value, body: body2 }, { start, end: body2.span.end });
  }
  parseFunction() {
    let start = this.expectKeyword("fn").span.start;
    let vars = [];
    while (this.peek()?.type === "ident") {
      let ident = this.expectToken("ident");
      vars.push(mkAst("var", { name: ident.value }, ident.span));
    }
    if (vars.length === 0)
      throw new Error("Function requires at least one parameter");
    this.expectArrow();
    let body2 = this.parseExpr();
    return mkAst("function", { vars, body: body2 }, { start, end: body2.span.end });
  }
  parseAnnot() {
    let value = this.parseAtom();
    while (this.peek()?.type === "annot") {
      this.expectToken("annot");
      let type = this.parseExpr();
      value = mkAst("annot", { type, value }, { start: value.span.start, end: type.span.end });
    }
    return value;
  }
  parseAtom() {
    let token = this.peek();
    if (!token)
      throw new Error("Unexpected end of input");
    if (token.type === "ident") {
      this.i++;
      return mkAst("var", { name: token.value }, token.span);
    }
    if (token.type === "builtin") {
      this.i++;
      return mkAst("builtin", token.value, token.span);
    }
    if (token.type === "number") {
      this.i++;
      return mkAst("number", token.value, token.span);
    }
    if (token.type === "string") {
      this.i++;
      return mkAst("string", token.value, token.span);
    }
    if (this.isSymbol("("))
      return this.parseParens();
    if (this.isSymbol("{"))
      return this.parseRecord();
    throw new Error(`Unexpected token: ${this.describe(token)}`);
  }
  parseParens() {
    let open = this.expectSymbol("(");
    let items = [];
    while (!this.isSymbol(")")) {
      if (!this.peek())
        throw new Error("Unterminated parenthesized expression");
      items.push(this.parseExpr());
    }
    let close = this.expectSymbol(")");
    if (items.length === 0)
      throw new Error("Empty parentheses are not allowed");
    if (items.length === 1)
      return items[0];
    return mkAst("app", { fn: items[0], args: items.slice(1) }, { start: open.span.start, end: close.span.end });
  }
  parseRecord() {
    let open = this.expectSymbol("{");
    let fields = [];
    while (!this.isSymbol("}")) {
      let name = this.expectIdent();
      this.expectSymbol(":");
      let value = this.parseExpr();
      fields.push([name, value]);
      if (this.isSymbol(","))
        this.i++;
      else
        break;
    }
    let close = this.expectSymbol("}");
    return mkAst("record", fields, { start: open.span.start, end: close.span.end });
  }
  peek() {
    return this.tokens[this.i];
  }
  isKeyword(value) {
    let token = this.peek();
    return token?.type === "keyword" && token.value === value;
  }
  isSymbol(value) {
    let token = this.peek();
    return token?.type === "symbol" && token.value === value;
  }
  expectToken(type) {
    let token = this.peek();
    if (!token || token.type !== type)
      throw new Error(`Expected ${type}, got ${this.describe(token)}`);
    this.i++;
    return token;
  }
  expectKeyword(value) {
    let token = this.peek();
    if (token?.type !== "keyword" || token.value !== value)
      throw new Error(`Expected keyword ${value}, got ${this.describe(token)}`);
    this.i++;
    return token;
  }
  expectSymbol(value) {
    let token = this.peek();
    if (token?.type !== "symbol" || token.value !== value)
      throw new Error(`Expected '${value}', got ${this.describe(token)}`);
    this.i++;
    return token;
  }
  expectArrow() {
    return this.expectToken("arrow");
  }
  expectIdent() {
    return this.expectToken("ident").value;
  }
  describe(token) {
    if (!token)
      return "end of input";
    if ("value" in token)
      return `${token.type}(${String(token.value)})`;
    return token.type;
  }
}
var parse = (code) => new Parser(tokenize(code)).parse();
var children = (node) => {
  if (node.$ === "function")
    return [...node.content.vars, node.content.body];
  if (node.$ === "app")
    return [node.content.fn, ...node.content.args];
  if (node.$ === "let")
    return [node.content.value, node.content.body];
  if (node.$ === "annot")
    return [node.content.value, node.content.type];
  if (node.$ === "record")
    return node.content.map(([, value]) => value);
  return [];
};
var stripSpans = (ast) => {
  if (ast.$ === "function")
    return { $: ast.$, content: { vars: ast.content.vars.map(stripSpans), body: stripSpans(ast.content.body) } };
  if (ast.$ === "app")
    return { $: ast.$, content: { fn: stripSpans(ast.content.fn), args: ast.content.args.map(stripSpans) } };
  if (ast.$ === "let")
    return { $: ast.$, content: { var: ast.content.var, value: stripSpans(ast.content.value), body: stripSpans(ast.content.body) } };
  if (ast.$ === "annot")
    return { $: ast.$, content: { type: stripSpans(ast.content.type), value: stripSpans(ast.content.value) } };
  if (ast.$ === "record")
    return { $: ast.$, content: ast.content.map(([name, value]) => [name, stripSpans(value)]) };
  return { $: ast.$, content: ast.content };
};
var test_parse = (code, expected) => {
  let ast = parse(code);
  if (JSON.stringify(stripSpans(ast)) !== JSON.stringify(stripSpans(expected))) {
    console.error("Test failed for code:", code);
    console.error("Expected:", expected);
    console.error("Got:", ast);
    throw new Error(`Test failed for code: ${code}`);
  } else {
    console.log("Test passed for code:", code);
  }
};
var test_span = (code, expected) => {
  let ast = parse(code);
  if (JSON.stringify(ast.span) !== JSON.stringify(expected)) {
    console.error("Span test failed for code:", code);
    console.error("Expected:", expected);
    console.error("Got:", ast.span);
    throw new Error(`Span test failed for code: ${code}`);
  } else {
    console.log("Span test passed for code:", code);
  }
};
var mknum = (n) => mkAst("number", n);
var mkstr = (s) => mkAst("string", s);
var mkvar = (name) => mkAst("var", { name });
var mkapp = (fn, args) => mkAst("app", { fn, args });
var mklet = (v, value, body2) => mkAst("let", { var: v, value, body: body2 });
var annot = (type, value) => mkAst("annot", { type, value });
var builtin = (name) => mkAst("builtin", name);
Object.entries({
  x: mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "@foo": mkAst("builtin", "foo"),
  "let x = 22 in x": mklet("x", mknum(22), mkvar("x")),
  "x :: @number": annot(builtin("number"), mkvar("x")),
  "{a: 22, b: x}": mkAst("record", [["a", mknum(22)], ["b", mkvar("x")]]),
  "fn x => x": mkAst("function", { vars: [mkvar("x")], body: mkvar("x") })
}).forEach(([code, expected]) => test_parse(code, expected));
test_span(`let x = 22
in x`, {
  start: { offset: 0, line: 1, col: 1 },
  end: { offset: 15, line: 2, col: 5 }
});

// src/main.ts
(async () => {
  let version = await fetch("/version").then((res) => res.text());
  while (true) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      if (await fetch("/version").then((res) => res.text()) != version)
        window.location.reload();
    } catch (e) {
      break;
    }
  }
})();
var outview = html("pre")().style({
  borderTop: "1px solid white",
  paddingTop: "16px"
});
var ast;
var colormap = [];
var contains = (node, offset) => node.span.start.offset <= offset && offset < node.span.end.offset;
var smallestAstAt = (node, offset) => {
  if (!contains(node, offset))
    return;
  for (let child of children(node)) {
    let match = smallestAstAt(child, offset);
    if (match)
      return match;
  }
  return node;
};
var colorOf = (node) => {
  if (node.$ === "number")
    return "#f5a623";
  if (node.$ === "string")
    return "#7ed321";
  if (node.$ === "builtin")
    return "#50e3c2";
  if (node.$ === "var")
    return "#4a90e2";
  if (node.$ === "let")
    return "#bd10e0";
  if (node.$ === "function")
    return "#d0021b";
  return;
};
var prettyAST = (node) => {
  switch (node.$) {
    case "number":
      return node.content.toString();
    case "string":
      return JSON.stringify(node.content);
    case "builtin":
      return node.content;
    case "var":
      return node.content.name;
    case "let":
      return `(let ${node.content.var} = ${prettyAST(node.content.value)} in ${prettyAST(node.content.body)})`;
    case "function":
      return `(fn (${node.content.vars.map((v) => v.content.name).join(", ")}) => ${prettyAST(node.content.body)})`;
    case "app":
      return `(${prettyAST(node.content.fn)} ${node.content.args.map(prettyAST).join(" ")})`;
    case "annot":
      return `(${prettyAST(node.content.value)} : ${prettyAST(node.content.type)})`;
    case "record":
      return `{${node.content.map(([k, v]) => `${k}: ${prettyAST(v)}`).join(", ")}}`;
  }
};
var collectColormap = (node) => {
  let kids = children(node);
  if (kids.length > 0)
    return kids.flatMap(collectColormap);
  let color = colorOf(node);
  return color ? [{ color, span: node.span }] : [];
};
var Edit = editor((s) => {
  try {
    ast = parse(s);
    colormap = collectColormap(ast).sort((a, b) => a.span.start.offset - b.span.start.offset);
    outview.el.textContent = prettyAST(ast);
  } catch (e) {
    ast = undefined;
    colormap = [];
    outview.el.textContent = e instanceof Error ? e.message : String(e);
  }
}, (offset) => {
  if (!ast)
    return;
  return smallestAstAt(ast, offset);
}, () => {
  return colormap;
});
body.style({
  padding: "44px",
  color: "white",
  backgroundColor: "black",
  fontFamily: "sans-serif"
}).append(Edit.el, outview, span(" ⚙ about this", () => {
  Edit.setText(`
// This is a toy code editor still in development. [https://github.com/dkormann/myeditor]

// The main goal is to bring zig's comptime capabilities to a scripting language.

// also if possible I want to make the linter programmable from the code in a straightforward way.


`);
}).style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px" }));
