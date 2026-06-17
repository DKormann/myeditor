// src/html.ts
var html = (tag) => (...children) => {
  let onclick = children.find((c) => typeof c === "function");
  let el = fromHTML(document.createElement(tag)).append(...children.filter((c) => typeof c !== "function"));
  if (onclick)
    el.el.onclick = onclick;
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
    assign: (htmlProps) => {
      Object.assign(el, htmlProps);
      return fromHTML(el);
    }
  };
  return node;
};
var div = html("div");
var span = html("span");
var p = html("p");
var body = fromHTML(document.body);
var h1 = html("h1");
var h2 = html("h2");
var h3 = html("h3");
var h4 = html("h4");
var table = html("table");
var tr = html("tr");
var td = html("td");
var pre = html("pre");
var canvas = html("canvas");
var button = html("button");
var globstyle = document.createElement("style");
globstyle.textContent = `
  body{
  --red: #e06c75;
  --green: #98c379;
  --blue: #61afef;
  --yellow: #e5c07b;
  --purple: #c678dd;
  --cyan: #6eeeff;
  --gray: #abb2bf88;
  --color: #e7eaf0;
  --background: #222122;
  }
  @media (prefers-color-scheme: light) {
    body{
      --red: #f10f22;
      --green: #54c801;
      --blue: #1f32ff;
      --yellow: #d39e3d;
      --brown: #c55d00;
      --purple: #a61fd0;
      --cyan: #0baebc;
      --gray: #676a6e88;
      --color: #282c34;
      --background: #ffffff;

    }
  }
`;
document.head.appendChild(globstyle);
var color = {
  red: "var(--red)",
  green: "var(--green)",
  blue: "var(--blue)",
  yellow: "var(--yellow)",
  purple: "var(--purple)",
  cyan: "var(--cyan)",
  gray: "var(--gray)",
  color: "var(--color)",
  background: "var(--background)"
};
body.el.style = `
background: ${color.background};
color: ${color.color};
`;

// src/editor.ts
var colorOf = (node) => node == undefined ? color.gray : node.$ === "comment" ? color.gray : node.$ === "number" || node.$ === "string" ? color.yellow : node.$ === "var" ? color.purple : node.$ === "let" || node.$ == "function" ? color.cyan : node.$ === "app" ? color.green : node.$ === "error" ? color.red : color.color;
var editor = (code, oninput, getAstMap, goToDef, hoverInfo) => {
  let lines = code.split(`
`);
  let cursor = { col: 0, row: 0 };
  let el = html("pre")().style({
    userSelect: "none",
    cursor: "text"
  });
  let hist = [];
  let elements = new WeakMap;
  let astmap = [];
  let pless = (a, b) => a.row < b.row || a.row == b.row && a.col < b.col;
  let plesseq = (a, b) => a.row < b.row || a.row == b.row && a.col <= b.col;
  let selrange = () => {
    if (!cursor.selection)
      return;
    if (cursor.row == cursor.selection.row && cursor.col == cursor.selection.col) {
      cursor.selection = undefined;
      return;
    }
    if (plesseq(cursor, cursor.selection))
      return [cursor, cursor.selection];
    else
      return [cursor.selection, cursor];
  };
  const render = () => {
    let code2 = lines.join(`
`);
    let scol = Math.min(cursor.col, lines[cursor.row]?.length ?? 0);
    let chars = [];
    let mkcolor = () => {
      chars.forEach((c, i) => {
        let ast = astmap[i];
        let color2 = colorOf(ast);
        if (color2)
          c.style.color = color2;
        else
          c.style.color = "";
        elements.get(c).ast = ast;
      });
    };
    let range = selrange();
    el.replaceChilren(...lines.map((line, row) => {
      let par = p(...line.split("").concat(" ").map((char, col) => {
        let chr = span(char).style(range && pless({ row, col }, range[1]) && plesseq(range[0], { row, col }) ? { backgroundColor: "#8d96ff85", color: color.background } : {}).style(cursor.row === row && scol === col ? { boxShadow: `2px 0 0 0 ${color.color} inset` } : {});
        chars.push(chr.el);
        elements.set(chr.el, { pos: { row, col } });
        return chr;
      })).style({ margin: "0" });
      elements.set(par.el, { pos: { row, col: line.length } });
      return par;
    }));
    mkcolor();
    if (hist[hist.length - 1] != code2) {
      oninput(code2);
      hist.push(code2);
      astmap = getAstMap();
      mkcolor();
    }
  };
  window.addEventListener("keydown", (e) => {
    let setCursor = (pos) => {
      if (!e.shiftKey)
        cursor.selection = undefined;
      else
        cursor.selection = cursor.selection || { row: cursor.row, col: cursor.col };
      cursor.col = pos.col;
      cursor.row = pos.row;
    };
    let clear_range = () => {
      let range = selrange();
      if (!range)
        return;
      lines = [...lines.slice(0, range[0].row), lines[range[0].row].substring(0, range[0].col) + lines[range[1].row].substring(range[1].col), ...lines.slice(range[1].row + 1)];
      setCursor({ row: range[0].row, col: range[0].col });
    };
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
          render();
        }
        if (e.key == "c") {
          let range = selrange();
          if (range) {
            let text = lines.slice(range[0].row, range[1].row + 1).map((line, i) => {
              if (i == 0 && i == range[1].row - range[0].row)
                return line.substring(range[0].col, range[1].col);
              else if (i == 0)
                return line.substring(range[0].col);
              else if (i == range[1].row - range[0].row)
                return line.substring(0, range[1].col);
              else
                return line;
            }).join(`
`);
            navigator.clipboard.writeText(text);
          }
        }
        if (e.key == "v") {
          navigator.clipboard.readText().then((text) => {
            let range = selrange();
            clear_range();
            let insertLines = text.split(`
`);
            lines = [...lines.slice(0, cursor.row), lines[cursor.row].substring(0, cursor.col) + insertLines[0], ...insertLines.slice(1, -1), insertLines.length > 1 ? insertLines[insertLines.length - 1] + lines[cursor.row].substring(cursor.col) : lines[cursor.row].substring(cursor.col), ...lines.slice(cursor.row + 1)];
            setCursor({ row: cursor.row + insertLines.length - 1, col: insertLines.length > 1 ? insertLines[insertLines.length - 1].length : cursor.col + insertLines[0].length });
          });
        }
        return;
      }
      lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + e.key + lines[cursor.row].substring(cursor.col);
      setCursor({ row: cursor.row, col: cursor.col + 1 });
      cursor.selection = undefined;
    }
    if (e.key === "Backspace") {
      let range = selrange();
      if (range) {
        clear_range();
      } else if (e.metaKey && cursor.col > 0) {
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
        if (cursor.col > 0)
          setCursor({ row: cursor.row, col: 0 });
        else if (cursor.row > 0)
          setCursor({ row: cursor.row - 1, col: lines[cursor.row - 1].length });
      } else if (cursor.col > 0)
        setCursor({ row: cursor.row, col: cursor.col - 1 });
      else if (cursor.row > 0)
        setCursor({ row: cursor.row - 1, col: lines[cursor.row - 1].length });
    }
    if (e.key === "ArrowRight") {
      if (e.metaKey) {
        if (cursor.col < lines[cursor.row].length)
          setCursor({ row: cursor.row, col: lines[cursor.row].length });
        else if (cursor.row < lines.length - 1)
          setCursor({ row: cursor.row + 1, col: 0 });
      } else if (cursor.col < lines[cursor.row].length)
        setCursor({ row: cursor.row, col: cursor.col + 1 });
      else if (cursor.row < lines.length - 1)
        setCursor({ row: cursor.row + 1, col: 0 });
    }
    if (e.key === "ArrowUp") {
      if (e.metaKey)
        setCursor({ row: 0, col: cursor.col });
      else if (cursor.row > 0)
        setCursor({ row: cursor.row - 1, col: cursor.col });
    }
    if (e.key === "ArrowDown") {
      if (e.metaKey)
        setCursor({ row: lines.length - 1, col: cursor.col });
      else if (cursor.row < lines.length - 1)
        setCursor({ row: cursor.row + 1, col: cursor.col });
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
  let mousedown = false;
  window.addEventListener("mousedown", (e) => {
    if (e.metaKey) {
      let ast = elements.get(e.target)?.ast;
      if (ast)
        goToDef(ast);
      return;
    }
    mousedown = true;
    if (elements.has(e.target)) {
      cursor = elements.get(e.target).pos;
      render();
    }
  });
  window.addEventListener("mouseover", (e) => {
    if (mousedown) {
      if (elements.has(e.target)) {
        let pos = elements.get(e.target).pos;
        cursor.selection = cursor.selection || { row: cursor.row, col: cursor.col };
        cursor.row = pos.row;
        cursor.col = pos.col;
        render();
      }
    } else {
      let ast = elements.get(e.target)?.ast;
      if (ast) {
        let [info, astmap2] = hoverInfo(ast);
        if (info) {
          let tooltip = div(...info.split("").map((c, i) => span(c).style({ color: colorOf(astmap2[i]) }))).style({
            position: "fixed",
            left: e.clientX + "px",
            bottom: window.innerHeight - e.clientY + 10 + "px",
            backgroundColor: color.background,
            color: color.color,
            border: "1px solid " + color.color,
            padding: "8px 12px",
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: "1000",
            whiteSpace: "pre"
          });
          document.body.appendChild(tooltip.el);
          let remove = () => {
            tooltip.el.remove();
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseout", out);
          };
          let move = (e2) => {
            if (e2.metaKey)
              return remove();
            tooltip.style({
              left: e2.clientX + "px",
              bottom: window.innerHeight - e2.clientY + 10 + "px"
            });
          };
          let out = (e2) => {
            if (e2.relatedTarget === tooltip.el)
              return;
            remove();
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseout", out);
        }
      }
    }
  });
  window.addEventListener("mouseup", (e) => {
    mousedown = false;
  });
  render();
  return {
    el,
    setText: (text) => {
      lines = text.split(`
`);
      render();
    },
    setCursor: (pos) => {
      console.log("setting cursor to", pos);
      cursor = pos;
      render();
    }
  };
};

// src/parser.ts
var hasShownType = (v) => v.type && !(v.type.$ === "var" && v.type.content.name === "any");
var prettyBinder = (v) => hasShownType(v) ? `(${prettyAST(v.type)} ${v.content.name})` : v.content.name;
var prettyAST = (node) => {
  const _prettyEnv = (env) => env === null ? "]]" : Array.isArray(env) ? "[[" + _prettyEnv(env[0]) + " | [[" + _prettyEnv(env[1]) : env.binder.content.name + ", " + _prettyEnv(env.next);
  switch (node.$) {
    case "number":
      return node.content.toString();
    case "string":
      return JSON.stringify(node.content);
    case "var":
      return node.content.name;
    case "let":
      return `let ${prettyBinder(node.content.var)} = ${prettyAST(node.content.value)} in
${prettyAST(node.content.body)}`;
    case "function":
      return `${node.content.env ? "ENV: [[" + _prettyEnv(node.content.env) : ""}fn ${node.content.vars.map(prettyBinder).join(" ")} => ${prettyAST(node.content.body)}`;
    case "app":
      return `(${prettyAST(node.content.fn)} ${node.content.args.map(prettyAST).join(" ")})`;
    case "record":
      return `{${node.content.map(([k, v]) => `${k.content.name}: ${prettyAST(v)}`).join(", ")}}`;
    case "error":
      return `[ERROR: ${node.content.message}]`;
  }
};
var zeroPos = () => ({ offset: 0, line: 1, col: 1 });
var zeroSpan = () => ({ start: zeroPos(), end: zeroPos() });
var mkAst = (tag, content, span2 = zeroSpan()) => ({ $: tag, content, span: span2 });
var tokenize = (code) => {
  let tokens = [];
  let comments = [];
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
    if (char === "/" && code[i + 1] === "/") {
      let start2 = pos();
      advance();
      advance();
      while (i < code.length && code[i] !== `
`)
        advance();
      comments.push(mkAst("comment", code.slice(start2.offset, i), { start: start2, end: pos() }));
      continue;
    }
    if (char === "=" && code[i + 1] === ">") {
      let start2 = pos();
      advance();
      advance();
      push({ type: "arrow" }, start2);
      continue;
    }
    if ("(){}=,:".includes(char)) {
      let start2 = pos();
      let value = char;
      advance();
      push({ type: "symbol", value }, start2);
      continue;
    }
    if (char === '"') {
      let start2 = pos();
      advance();
      let value = "";
      while (i < code.length) {
        let current = code[i];
        if (current === "\\") {
          let next = code[i + 1];
          if (next === undefined) {
            advance();
            push({ type: "error", message: "Unterminated string escape", content: code.slice(start2.offset, i) }, start2);
            return { tokens, comments, eof: pos() };
          }
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
      if (code[i] !== '"') {
        push({ type: "error", message: "Unterminated string literal", content: code.slice(start2.offset, i) }, start2);
        return { tokens, comments, eof: pos() };
      }
      advance();
      push({ type: "string", value }, start2);
      continue;
    }
    if (isDigit(char)) {
      let start2 = pos();
      let valueStart = i;
      while (i < code.length && isDigit(code[i]))
        advance();
      push({ type: "number", value: Number(code.slice(valueStart, i)) }, start2);
      continue;
    }
    if (isAlpha(char)) {
      let start2 = pos();
      let valueStart = i;
      while (i < code.length && isIdent(code[i]))
        advance();
      let value = code.slice(valueStart, i);
      if (value === "let" || value === "in" || value === "fn")
        push({ type: "keyword", value }, start2);
      else
        push({ type: "ident", value }, start2);
      continue;
    }
    let start = pos();
    advance();
    push({ type: "error", message: `Unexpected character: ${char}`, content: char }, start);
  }
  return { tokens, comments, eof: pos() };
};

class Parser {
  tokens;
  source;
  eof;
  i = 0;
  constructor(tokens, source, eof) {
    this.tokens = tokens;
    this.source = source;
    this.eof = eof;
  }
  parse() {
    let ast = this.parseExpr();
    if (this.peek()) {
      let start = this.peek().span.start;
      let end = this.tokens[this.tokens.length - 1]?.span.end ?? start;
      return this.errorNode("Unexpected extra input after expression", { start, end }, this.source.slice(start.offset, end.offset));
    }
    return ast;
  }
  parseExpr() {
    if (this.isKeyword("let"))
      return this.parseLet();
    if (this.isKeyword("fn"))
      return this.parseFunction();
    return this.parseAtom();
  }
  parseLet() {
    let start = this.expectKeyword("let").span.start;
    let variable = this.parseLetBinder();
    if (variable.$ === "error")
      return variable;
    let value;
    if (this.isSymbol("=")) {
      this.expectSymbol("=");
      value = this.parseExpr();
    } else {
      value = this.peek() ? this.wrapError("Expected '=' after let binding name", this.parseExpr()) : this.errorHere("Expected '=' after let binding name");
    }
    let body2;
    if (this.isKeyword("in")) {
      this.expectKeyword("in");
      body2 = this.parseExpr();
    } else {
      body2 = this.peek() ? this.wrapError("Expected keyword in after let binding", this.parseExpr()) : this.errorHere("Expected keyword in after let binding");
    }
    return mkAst("let", { var: variable, value, body: body2 }, { start, end: body2.span.end });
  }
  parseFunction() {
    let start = this.expectKeyword("fn").span.start;
    let vars = [];
    while (this.peek()?.type === "ident" || this.isSymbol("(")) {
      let binder = this.parseBinder();
      if (binder.$ === "error")
        return mkAst("function", { vars, body: binder }, { start, end: binder.span.end });
      vars.push(binder);
    }
    let body2;
    if (vars.length === 0) {
      if (this.matchToken("arrow"))
        body2 = this.wrapError("Function requires at least one parameter", this.parseExpr());
      else
        body2 = this.peek() ? this.wrapError("Function requires at least one parameter", this.parseExpr()) : this.errorHere("Function requires at least one parameter", start);
    } else if (!this.matchToken("arrow")) {
      body2 = this.peek() ? this.wrapError("Expected '=>' after function parameters", this.parseExpr()) : this.errorHere("Expected '=>' after function parameters");
    } else {
      body2 = this.parseExpr();
    }
    return mkAst("function", { vars, body: body2 }, { start, end: body2.span.end });
  }
  parseAtom() {
    let token = this.peek();
    if (!token)
      return this.errorHere("Unexpected end of input");
    if (token.type === "ident") {
      this.i++;
      return mkAst("var", { name: token.value }, token.span);
    }
    if (token.type === "number") {
      this.i++;
      return mkAst("number", token.value, token.span);
    }
    if (token.type === "string") {
      this.i++;
      return mkAst("string", token.value, token.span);
    }
    if (token.type === "error") {
      this.i++;
      return mkAst("error", { message: token.message, content: token.content }, token.span);
    }
    if (this.isSymbol("("))
      return this.parseParens();
    if (this.isSymbol("{"))
      return this.parseRecord();
    this.i++;
    return this.errorNode(`Unexpected token: ${this.describe(token)}`, token.span);
  }
  parseParens() {
    let open = this.expectSymbol("(");
    let items = [];
    while (!this.isSymbol(")")) {
      if (!this.peek()) {
        let end = items.length > 0 ? items[items.length - 1].span.end : open.span.end;
        return this.errorNode("Unterminated parenthesized expression", { start: open.span.start, end }, this.source.slice(open.span.start.offset, end.offset));
      }
      items.push(this.parseExpr());
    }
    let close = this.expectSymbol(")");
    if (items.length === 0)
      return this.errorNode("Empty parentheses are not allowed", { start: open.span.start, end: close.span.end }, this.source.slice(open.span.start.offset, close.span.end.offset));
    if (items.length === 1)
      return items[0];
    return mkAst("app", { fn: items[0], args: items.slice(1) }, { start: open.span.start, end: close.span.end });
  }
  parseRecord() {
    let open = this.expectSymbol("{");
    let fields = [];
    while (!this.isSymbol("}")) {
      if (!this.peek()) {
        let end = fields.length > 0 ? fields[fields.length - 1][1].span.end : open.span.end;
        return this.errorNode("Unterminated record", { start: open.span.start, end }, this.source.slice(open.span.start.offset, end.offset));
      }
      let name = this.matchToken("ident");
      if (!name) {
        let token = this.peek();
        this.i++;
        return this.errorNode(`Expected record field name, got ${this.describe(token)}`, { start: open.span.start, end: token.span.end }, this.source.slice(open.span.start.offset, token.span.end.offset));
      }
      let key = mkAst("var", { name: name.value }, name.span);
      let value = this.isSymbol(":") ? (this.expectSymbol(":"), this.isSymbol("}") ? this.errorHere("Expected record field value after ':'") : this.parseExpr()) : key;
      fields.push([key, value]);
      if (this.isSymbol(","))
        this.i++;
      else
        break;
    }
    if (!this.isSymbol("}")) {
      let end = fields.length > 0 ? fields[fields.length - 1][1].span.end : open.span.end;
      return this.errorNode("Unterminated record", { start: open.span.start, end }, this.source.slice(open.span.start.offset, end.offset));
    }
    let close = this.expectSymbol("}");
    return mkAst("record", fields, { start: open.span.start, end: close.span.end });
  }
  parseBinder() {
    if (this.isSymbol("(")) {
      this.expectSymbol("(");
      let declaredType = this.parseAtom();
      let name2 = this.matchToken("ident");
      if (!name2)
        return this.errorHere("Expected identifier in binder pattern");
      if (!this.isSymbol(")"))
        return this.errorHere("Expected ')' after binder pattern");
      this.expectSymbol(")");
      if (declaredType.$ === "error")
        return declaredType;
      let variable2 = mkAst("var", { name: name2.value }, name2.span);
      variable2.type = declaredType;
      return variable2;
    }
    let name = this.matchToken("ident");
    if (!name)
      return this.errorHere("Expected identifier");
    let variable = mkAst("var", { name: name.value }, name.span);
    if (this.isSymbol(":")) {
      this.expectSymbol(":");
      let declaredType = this.parseAtom();
      if (declaredType.$ === "error")
        return declaredType;
      variable.type = declaredType;
    }
    return variable;
  }
  parseLetBinder() {
    return this.parseBinder();
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
  matchToken(type) {
    let token = this.peek();
    if (!token || token.type !== type)
      return;
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
  describe(token) {
    if (!token)
      return "end of input";
    if ("value" in token)
      return `${token.type}(${String(token.value)})`;
    if (token.type === "error")
      return `error(${token.message})`;
    return token.type;
  }
  errorNode(message, span2, content) {
    let finalSpan = span2 ?? this.pointSpan();
    return mkAst("error", { message, content: content ?? this.source.slice(finalSpan.start.offset, finalSpan.end.offset) }, finalSpan);
  }
  errorHere(message, start) {
    let span2 = this.peek()?.span ?? { start: this.eof, end: this.eof };
    return this.errorNode(message, { start: start ?? span2.start, end: span2.end });
  }
  wrapError(message, node) {
    return this.errorNode(message, node.span, this.source.slice(node.span.start.offset, node.span.end.offset));
  }
  pointSpan() {
    let token = this.peek();
    if (token)
      return token.span;
    return { start: this.eof, end: this.eof };
  }
}
var buildAstMap = (ast, comments = []) => {
  let maxEnd = comments.reduce((m, c) => c.span.end.offset > m ? c.span.end.offset : m, ast.span.end.offset);
  let res = Array.from({ length: maxEnd }, () => {
    return;
  });
  const walk = (node) => {
    for (let i = node.span.start.offset;i < node.span.end.offset; i++)
      res[i] = node;
    children(node).forEach(walk);
  };
  walk(ast);
  comments.forEach((comment) => {
    for (let i = comment.span.start.offset;i < comment.span.end.offset; i++)
      res[i] = comment;
  });
  return res;
};
var parse = (code) => {
  let { tokens, comments, eof } = tokenize(code);
  let ast = new Parser(tokens, code, eof).parse();
  return { ast, comments, astmap: buildAstMap(ast, comments) };
};
var parseAST = (code) => parse(code).ast;
var children = (node) => {
  if (node.$ === "function")
    return [...node.content.vars, node.content.body];
  if (node.$ === "app")
    return [node.content.fn, ...node.content.args];
  if (node.$ === "let")
    return [node.content.var, node.content.value, node.content.body];
  if (node.$ === "record")
    return node.content.flatMap(([key, value]) => [key, value]);
  return [];
};
var stripSpans = (ast) => {
  if (ast.$ === "function")
    return { $: ast.$, content: { vars: ast.content.vars.map(stripSpans), body: stripSpans(ast.content.body) } };
  if (ast.$ === "app")
    return { $: ast.$, content: { fn: stripSpans(ast.content.fn), args: ast.content.args.map(stripSpans) } };
  if (ast.$ === "let")
    return { $: ast.$, content: { var: stripSpans(ast.content.var), value: stripSpans(ast.content.value), body: stripSpans(ast.content.body) } };
  if (ast.$ === "record")
    return { $: ast.$, content: ast.content.map(([name, value]) => [stripSpans(name), stripSpans(value)]) };
  if (ast.$ === "error")
    return { $: ast.$, content: ast.content };
  return { $: ast.$, content: ast.content };
};
var stringify = (x) => JSON.stringify(x, null, 2);
var test_parse = (code, expected) => {
  let ast = parseAST(code);
  if (JSON.stringify(stripSpans(ast)) !== JSON.stringify(stripSpans(expected))) {
    console.error("Test failed for code:", code);
    console.error("Expected:", stringify(stripSpans(expected)));
    console.error("Got:", stringify(stripSpans(ast)));
    throw new Error(`Test failed for code: ${code}`);
  }
};
var test_span = (code, expected) => {
  let ast = parseAST(code);
  if (JSON.stringify(ast.span) !== JSON.stringify(expected)) {
    console.error("Span test failed for code:", code);
    console.error("Expected:", expected);
    console.error("Got:", ast.span);
    throw new Error(`Span test failed for code: ${code}`);
  }
};
var mknum = (n) => mkAst("number", n);
var mkstr = (s) => mkAst("string", s);
var mkvar = (name) => mkAst("var", { name });
var mkapp = (fn, args) => mkAst("app", { fn, args });
var mklet = (v, value, body2) => mkAst("let", { var: typeof v === "string" ? mkvar(v) : v, value, body: body2 });
var mkfun = (vars, body2, env) => mkAst("function", { vars: vars.map((v) => typeof v === "string" ? mkvar(v) : v), body: body2, env });
var mkrecord = (fields) => mkAst("record", Object.entries(fields).map(([k, v]) => [mkvar(k), v]));
Object.entries({
  x: mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "let x = 22 in x": mklet("x", mknum(22), mkvar("x")),
  "{a: 22, b: x}": mkrecord({ a: mknum(22), b: mkvar("x") }),
  "fn x => x": mkfun(["x"], mkvar("x")),
  "fn x y => x": mkfun(["x", "y"], mkvar("x")),
  "let (number x) = 22 in x": mklet(Object.assign(mkvar("x"), { type: mkvar("number") }), mknum(22), mkvar("x")),
  "fn (number x) (string y) => x": mkfun([
    Object.assign(mkvar("x"), { type: mkvar("number") }),
    Object.assign(mkvar("y"), { type: mkvar("string") })
  ], mkvar("x")),
  "{e:22}": mkrecord({ e: mknum(22) }),
  "{e}": mkrecord({ e: mkvar("e") }),
  "//comment\n22": parseAST("22")
}).forEach(([code, expected]) => test_parse(code, expected));
Object.entries({
  "(": mkAst("error", { message: "Unterminated parenthesized expression", content: "(" }),
  "let x 22 in x": mkAst("let", {
    var: mkvar("x"),
    value: mkAst("error", { message: "Expected '=' after let binding name", content: "22" }),
    body: mkvar("x")
  }),
  "{e:}": mkrecord({ e: mkAst("error", { message: "Expected record field value after ':'", content: "}" }) })
}).forEach(([code, expected]) => test_parse(code, expected));
test_span(`let x = 22
in x`, {
  start: { offset: 0, line: 1, col: 1 },
  end: { offset: 15, line: 2, col: 5 }
});

// src/lsp.ts
var getdef = (root, vari) => {
  if (root.span.start.offset > vari.span.start.offset || root.span.end.offset < vari.span.end.offset)
    return;
  for (let child of children(root)) {
    let res = getdef(child, vari);
    if (res)
      return res;
  }
  if (root.$ === "let" && root.content.var.content.name === vari.content.name)
    return root.content.var;
  if (root.$ === "function") {
    for (let v of root.content.vars)
      if (v.content.name === vari.content.name)
        return v;
  }
};

// src/runtime.ts
var NUMBER = mkvar("number");
var STRING = mkvar("string");
var TYPE = mkvar("type");
var TYPEOF = mkvar("typeof");
NUMBER.type = TYPE;
STRING.type = TYPE;
TYPE.type = TYPE;
TYPEOF.type = parse("fn f => fn x => type").ast;
var ANY = mkvar("any");
var primitiveType = (name) => ({
  type: TYPE,
  impl: (x) => {
    if (x.type) {
      if (x.type.$ == "var" && x.type.content.name == name)
        return x;
      throw new Error(`Type error: expected ${name}, got ${prettyAST(x.type)}`);
    }
    x.type = mkvar(name);
    return x;
  }
});
var builtins = {
  number: primitiveType("number"),
  string: primitiveType("string"),
  eq: {
    type: parse("fn f => fn x y => (number (f x y))").ast,
    impl: (x, y) => mknum(x.$ == "number" && y.$ == "number" && x.content == y.content || x.$ == "string" && y.$ == "string" && x.content == y.content || x == y ? 1 : 0)
  },
  add: {
    type: parse("fn f=> fn x y => (number (f (number x) (number y)))").ast,
    impl: (x, y) => {
      if (x.$ == "number" && y.$ == "number")
        return mknum(x.content + y.content);
      throw new Error(`Type error in add: expected numbers, got ${prettyAST(x)} and ${prettyAST(y)}`);
    }
  },
  ifelse: {
    type: parse("fn f => fn T cond then else => (T (f (number cond) (T then) (T else)))").ast,
    impl: (cond, then, els) => {
      let val = cond.$ == "number" ? cond.content : cond.$ == "string" ? cond.content.length : 1;
      return val ? then : els;
    }
  },
  typeof: {
    type: parse("fn f => fn x => type").ast,
    impl: (x) => {
      if (!x.type)
        return mkapp(TYPEOF, [x]);
      return x.type;
    }
  }
};
var DEBUG = 0;
var loggerPre = pre();
body.replaceChilren(loggerPre);
var debug = (...args) => {
  if (DEBUG)
    loggerPre.append(pre(args.join(" ")).style({ border: "1px solid " + color.color, padding: ".4em", borderRadius: ".3em", margin: ".4em" }));
};
var run = (ast) => {
  let lookup = (name, env) => {
    if (!env)
      return null;
    if (Array.isArray(env))
      return lookup(name, env[0]) || lookup(name, env[1]);
    if (env.binder.content.name === name)
      return env;
    return lookup(name, env.next);
  };
  let freename = (env) => {
    let n = 0;
    while (lookup(`x${n}`, env))
      n++;
    return `x${n}`;
  };
  let bind = (env, binder, value) => ({ binder, value, next: env });
  let bindValue = (env, binder, value, infer = false) => {
    if (binder.type)
      if (value.type && prettyAST(binder.type) != prettyAST(value.type))
        throw new Error(`Type error in let: expected ${prettyAST(binder.type)}, got ${prettyAST(value.type)}`);
      else
        binder.type = value.type;
    return bind(env, binder, value);
  };
  let annot = (ast2, type) => {
    if (type == undefined)
      throw new Error("Cannot annotate with undefined type");
    if (ast2.type && prettyAST(ast2.type) != prettyAST(type))
      throw new Error(`Type error: expected ${prettyAST(type)}, got ${prettyAST(ast2.type)}`);
    ast2.type = type;
    return ast2;
  };
  const _go = (ast2, env) => {
    let call = (fn, args) => {
      debug("Calling", prettyAST(fn), "with args", args.map(prettyAST).join(`
`));
      if (fn.$ == "var" && builtins[fn.content.name])
        throw new Error("not implemented");
      if (fn.$ == "function") {
        if (fn.content.vars.length !== args.length)
          throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`);
        if (fn.content.env === undefined)
          throw new Error("Function has no environment");
        return go(fn.content.body, fn.content.vars.reduce((env2, v, i) => bindValue(env2, v, args[i], true), fn.content.env));
      }
      return mkapp(fn, args);
    };
    switch (ast2.$) {
      case "number":
        return annot(ast2, NUMBER);
      case "string":
        return annot(ast2, STRING);
      case "var": {
        if (builtins[ast2.content.name])
          annot(ast2, builtins[ast2.content.name].type);
        let hit = lookup(ast2.content.name, [env, { binder: ast2, value: ast2, next: null }]);
        if (hit.binder.type)
          annot(ast2, hit.binder.type);
        return hit.value;
      }
      case "let": {
        let value = go(ast2.content.value, env);
        annot(ast2.content.var, value.type);
        let res = go(ast2.content.body, bindValue(env, ast2.content.var, value, true));
        annot(ast2, res.type);
        return res;
      }
      case "function": {
        if (ast2.content.env == undefined)
          ast2.content.env = env;
        let runbod = call(ast2, ast2.content.vars);
        let fvar = mkvar(freename(env));
        let ftype = mkfun([fvar], mkfun(ast2.content.vars, runbod));
        return annot(mkfun(ast2.content.vars, runbod, ast2.content.env), ftype);
      }
      case "app": {
        let fn = go(ast2.content.fn, env);
        let args = ast2.content.args.map((arg) => go(arg, env));
        let res = call(fn, args);
        if (res.type)
          annot(ast2, res.type);
        return res;
      }
      default:
        return ast2;
    }
  };
  const go = (ast2, env) => {
    let res = _go(ast2, env);
    debug("AST:", prettyAST(ast2), `
Type:`, prettyAST(res.type ?? ANY), `
->`, prettyAST(res));
    let restype = res.type;
    if (restype)
      annot(ast2, restype);
    return res;
  };
  return go(ast, null);
};
DEBUG = 1;
var ast = parse("(fn x => fn y => x 3)").ast;
var res = run(ast);
DEBUG = 0;

// src/main.ts
var about_text = `

// This is a toy code editor still in development.

// the goal is to build a language with:

// extremely minimal syntax
// first class support for types as values
// first cass LSP programng in a straightforward way.

// hover over x to see its inferred type
let n = 22 in

// this is how types are annotated. types are essentially just functions over values.
let k = (number 33) in
let u = (string "hllo") in

// untyped id
let id = fn x => x in

// number typed id
let idn = fn x => (number x) in

// type of number -> number
let T = fn f => fn (number x) => (number (f x)) in

let _id = (T id) in

//let bad = (_id "e") in

let r = (id "2") in

// this is will result in type error.
// let BAD = (idn_ "2") in

(number st)
`;
var outview = html("pre")().style({
  borderTop: "1px solid " + color.color,
  paddingTop: "16px"
});
var ast2;
var currentAstMap = [];
var code = "";
var Edit = editor(localStorage.getItem("lines") ?? about_text, (s) => {
  try {
    let parsed = parse(s);
    ast2 = parsed.ast;
    currentAstMap = parsed.astmap;
    code = s;
    let res2 = run(ast2);
    outview.el.textContent = prettyAST(res2);
  } catch (e) {
    ast2 = undefined;
    currentAstMap = [];
    outview.el.textContent = e instanceof Error ? e.message : String(e);
  }
}, () => currentAstMap, (req) => {
  let def = req.$ == "var" ? getdef(ast2, req) : undefined;
  if (def)
    Edit.setCursor({ row: def.span.start.line - 1, col: def.span.start.col - 1 });
}, (node) => {
  if (node.$ === "comment")
    return ["", []];
  let str = node.$ + ": ";
  let map = str.split("").map((c) => {
    return;
  });
  let ast3 = node.type ? node.type : ANY;
  let co = prettyAST(ast3);
  map.push(...parse(co).astmap);
  str += co;
  return [str, map];
});
body.style({ padding: "44px", fontFamily: "sans-serif" });
var buttn = (t, onClick) => span(t, onClick).style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginRight: "8px" });
body.append(div(span("✈︎").style({ fontSize: "3em", marginRight: "8px" }), span("MiG").style({ fontSize: "1.5em", fontWeight: "bold", fontFamily: "monospace" })).style({ display: "flex", alignItems: "center", marginBottom: "16px", color: "gray" }), Edit.el, outview, buttn("about", () => Edit.setText(about_text)), buttn("github", () => window.open("https://github.com/dkormann/myeditor")));

//# debugId=BC7401231326067C64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjogKE5PREUgfCBzdHJpbmcpW10pID0+IE5PREUsXG4gIHN0eWxlOiAoc3R5bGVzOiBQYXJ0aWFsPENTU1N0eWxlRGVjbGFyYXRpb24+KSA9PiBOT0RFLFxuICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiBOT0RFXG59XG5cbmV4cG9ydCB0eXBlIEFSRyA9IE5PREUgfCBzdHJpbmcgfCAoKGU6TW91c2VFdmVudCk9PnZvaWQpXG5cbmV4cG9ydCBjb25zdCBodG1sID0gPEsgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+ICh0YWc6SykgPT4gKC4uLmNoaWxkcmVuOkFSR1tdKTogTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPiA9PiB7XG4gIGxldCBvbmNsaWNrID0gY2hpbGRyZW4uZmluZChjID0+IHR5cGVvZiBjID09PSBcImZ1bmN0aW9uXCIpIGFzIEZ1bmN0aW9uXG4gIGxldCBlbCA9IGZyb21IVE1MIChkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZykpLmFwcGVuZCguLi4gY2hpbGRyZW4uZmlsdGVyKGMgPT4gdHlwZW9mIGMgIT09IFwiZnVuY3Rpb25cIikgYXMgKE5PREUgfCBzdHJpbmcpW10pIGFzIE5PREUgPEhUTUxFbGVtZW50VGFnTmFtZU1hcFtLXT47XG4gIGlmIChvbmNsaWNrKSBlbC5lbC4gb25jbGljayA9IChvbmNsaWNrIGFzIChlOk1vdXNlRXZlbnQpPT52b2lkKVxuICBcbiAgcmV0dXJuIGVsXG59XG5cblxuZXhwb3J0IGNvbnN0IGZyb21IVE1MICA9IDxIIGV4dGVuZHMgSFRNTEVsZW1lbnQ+ICAoZWw6SCk6IE5PREUgPEg+ID0+IHtcbiAgbGV0IG5vZGUgOiBOT0RFPEg+ID0ge1xuICAgICQ6IFwiTk9ERVwiLFxuICAgIGVsLFxuICAgIGFwcGVuZDogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNoaWxkID09PSBcInN0cmluZ1wiKSBlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGlsZCkpO1xuICAgICAgICBlbHNlIGVsLmFwcGVuZENoaWxkKGNoaWxkLmVsKTtcblxuICAgICAgfSk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBlbC5yZXBsYWNlQ2hpbGRyZW4oKVxuICAgICAgcmV0dXJuIG5vZGUuYXBwZW5kKC4uLmNoaWxkcmVuKVxuICAgIH0sXG4gICAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IHtcbiAgICAgIE9iamVjdC5hc3NpZ24oZWwuc3R5bGUsIHN0eWxlcyk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgYXNzaWduOiAoaHRtbFByb3BzOiBQYXJ0aWFsPEhUTUxFbGVtZW50PikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbCwgaHRtbFByb3BzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfVxuICB9O1xuICByZXR1cm4gbm9kZVxufVxuXG5cbmV4cG9ydCBjb25zdCBkaXYgPSBodG1sKFwiZGl2XCIpO1xuZXhwb3J0IGNvbnN0IHNwYW4gPSBodG1sKFwic3BhblwiKTtcbmV4cG9ydCBjb25zdCBwID0gaHRtbChcInBcIik7XG5leHBvcnQgY29uc3QgYm9keSA9IGZyb21IVE1MKGRvY3VtZW50LmJvZHkpO1xuZXhwb3J0IGNvbnN0IGgxID0gaHRtbChcImgxXCIpO1xuZXhwb3J0IGNvbnN0IGgyID0gaHRtbChcImgyXCIpO1xuZXhwb3J0IGNvbnN0IGgzID0gaHRtbChcImgzXCIpO1xuZXhwb3J0IGNvbnN0IGg0ID0gaHRtbChcImg0XCIpO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gaHRtbChcInRhYmxlXCIpO1xuZXhwb3J0IGNvbnN0IHRyID0gaHRtbChcInRyXCIpO1xuZXhwb3J0IGNvbnN0IHRkID0gaHRtbChcInRkXCIpO1xuZXhwb3J0IGNvbnN0IHByZSA9IGh0bWwoXCJwcmVcIilcblxuZXhwb3J0IGNvbnN0IGNhbnZhcyA9IGh0bWwoXCJjYW52YXNcIik7XG5cbmV4cG9ydCBjb25zdCBidXR0b24gPSBodG1sKFwiYnV0dG9uXCIpO1xuXG5cblxubGV0IGdsb2JzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKVxuZ2xvYnN0eWxlLnRleHRDb250ZW50ID0gYFxuICBib2R5e1xuICAtLXJlZDogI2UwNmM3NTtcbiAgLS1ncmVlbjogIzk4YzM3OTtcbiAgLS1ibHVlOiAjNjFhZmVmO1xuICAtLXllbGxvdzogI2U1YzA3YjtcbiAgLS1wdXJwbGU6ICNjNjc4ZGQ7XG4gIC0tY3lhbjogIzZlZWVmZjtcbiAgLS1ncmF5OiAjYWJiMmJmODg7XG4gIC0tY29sb3I6ICNlN2VhZjA7XG4gIC0tYmFja2dyb3VuZDogIzIyMjEyMjtcbiAgfVxuICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBsaWdodCkge1xuICAgIGJvZHl7XG4gICAgICAtLXJlZDogI2YxMGYyMjtcbiAgICAgIC0tZ3JlZW46ICM1NGM4MDE7XG4gICAgICAtLWJsdWU6ICMxZjMyZmY7XG4gICAgICAtLXllbGxvdzogI2QzOWUzZDtcbiAgICAgIC0tYnJvd246ICNjNTVkMDA7XG4gICAgICAtLXB1cnBsZTogI2E2MWZkMDtcbiAgICAgIC0tY3lhbjogIzBiYWViYztcbiAgICAgIC0tZ3JheTogIzY3NmE2ZTg4O1xuICAgICAgLS1jb2xvcjogIzI4MmMzNDtcbiAgICAgIC0tYmFja2dyb3VuZDogI2ZmZmZmZjtcblxuICAgIH1cbiAgfVxuYFxuXG5kb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGdsb2JzdHlsZSlcblxuXG5leHBvcnQgY29uc3QgY29sb3IgPSB7XG4gIHJlZDogXCJ2YXIoLS1yZWQpXCIsXG4gIGdyZWVuOiBcInZhcigtLWdyZWVuKVwiLFxuICBibHVlOiBcInZhcigtLWJsdWUpXCIsXG4gIHllbGxvdzogXCJ2YXIoLS15ZWxsb3cpXCIsXG4gIHB1cnBsZTogXCJ2YXIoLS1wdXJwbGUpXCIsXG4gIGN5YW46IFwidmFyKC0tY3lhbilcIixcblxuICBncmF5OiBcInZhcigtLWdyYXkpXCIsXG4gIGNvbG9yOiBcInZhcigtLWNvbG9yKVwiLFxuICBiYWNrZ3JvdW5kOiBcInZhcigtLWJhY2tncm91bmQpXCJcbn1cblxuXG5ib2R5LmVsLnN0eWxlID1gXG5iYWNrZ3JvdW5kOiAke2NvbG9yLmJhY2tncm91bmR9O1xuY29sb3I6ICR7Y29sb3IuY29sb3J9O1xuYFxuIiwKICAgICJpbXBvcnQge2RpdiwgaHRtbCwgcCwgc3BhbiwgY29sb3J9IGZyb20gXCIuL2h0bWxcIlxuaW1wb3J0IHsgdHlwZSBTeW50YXhOb2RlIH0gZnJvbSBcIi4vcGFyc2VyXCJcblxudHlwZSBQb3MgPSB7IGNvbDogbnVtYmVyLCByb3c6IG51bWJlciB9XG5cbmNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IHVuZGVmaW5lZCk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJcbmV4cG9ydCB0eXBlIEVudiA9IHtiaW5kZXI6IFZhciwgdmFsdWU6IEFTVCwgbmV4dDogRW52fSB8IFtFbnYsIEVudl0gfCBudWxsXG5cbmV4cG9ydCB0eXBlIFBvcyA9IHtvZmZzZXQ6IG51bWJlciwgbGluZTogbnVtYmVyLCBjb2w6IG51bWJlcn1cbmV4cG9ydCB0eXBlIFNwYW4gPSB7c3RhcnQ6IFBvcywgZW5kOiBQb3N9XG5cbmV4cG9ydCB0eXBlIFRhZyA8VCBleHRlbmRzIHN0cmluZywgQz4gPSB7JDogVCwgY29udGVudDogQywgc3BhbjogU3BhbiwgdHlwZT86IEFTVH1cblxuZXhwb3J0IHR5cGUgVmFyID0gVGFnPFwidmFyXCIsIHtuYW1lOiBzdHJpbmd9PlxuZXhwb3J0IHR5cGUgQ29tbWVudCA9IFRhZzxcImNvbW1lbnRcIiwgc3RyaW5nPlxuZXhwb3J0IHR5cGUgRnVuYyA9IFRhZzxcImZ1bmN0aW9uXCIsIHt2YXJzOiBWYXJbXSwgYm9keTogQVNULCBlbnY/IDpFbnZ9PlxuXG5leHBvcnQgdHlwZSBFcnJvck5vZGUgPSBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PlxuXG5leHBvcnQgdHlwZSBBU1QgPVxuICB8IFRhZzxcImFwcFwiLCB7Zm46IEFTVCwgYXJnczogQVNUW119PlxuICB8IFZhclxuICB8IEZ1bmNcbiAgfCBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPlxuICB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG4gIHwgVGFnPFwibGV0XCIsIHt2YXI6IFZhciwgdmFsdWU6IEFTVCwgYm9keTogQVNUfT5cbiAgfCBUYWc8XCJyZWNvcmRcIiwgW1ZhciwgQVNUXVtdPlxuICB8IEVycm9yTm9kZVxuXG5leHBvcnQgdHlwZSBTeW50YXhOb2RlID0gQVNUIHwgQ29tbWVudFxuZXhwb3J0IHR5cGUgUGFyc2VSZXN1bHQgPSB7YXN0OiBBU1QsIGNvbW1lbnRzOiBDb21tZW50W10sIGFzdG1hcDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW119XG5cbmNvbnN0IGhhc1Nob3duVHlwZSA9ICh2OiBWYXIpID0+IHYudHlwZSAmJiAhKHYudHlwZS4kID09PSBcInZhclwiICYmIHYudHlwZS5jb250ZW50Lm5hbWUgPT09IFwiYW55XCIpXG5jb25zdCBwcmV0dHlCaW5kZXIgPSAodjogVmFyKTogc3RyaW5nID0+IGhhc1Nob3duVHlwZSh2KSA/IGAoJHtwcmV0dHlBU1Qodi50eXBlISl9ICR7di5jb250ZW50Lm5hbWV9KWAgOiB2LmNvbnRlbnQubmFtZVxuXG5leHBvcnQgY29uc3QgcHJldHR5QVNUID0gKG5vZGU6IEFTVCk6IHN0cmluZyA9PntcbiAgY29uc3QgX3ByZXR0eUVudiA9ICgoZW52OkVudikgOiBzdHJpbmcgPT4gKGVudiA9PT0gbnVsbCkgPyBcIl1dXCJcbiAgICA6IChBcnJheS5pc0FycmF5KGVudikpID8gXCJbW1wiICsgX3ByZXR0eUVudihlbnZbMF0pICsgXCIgfCBbW1wiICsgX3ByZXR0eUVudihlbnZbMV0pXG4gICAgOiBlbnYuYmluZGVyLmNvbnRlbnQubmFtZSArIFwiLCBcIiArIF9wcmV0dHlFbnYoZW52Lm5leHQpKTtcblxuICBzd2l0Y2gobm9kZS4kKXtcbiAgICBjYXNlIFwibnVtYmVyXCIgOiByZXR1cm4gbm9kZS5jb250ZW50LnRvU3RyaW5nKClcbiAgICBjYXNlIFwic3RyaW5nXCIgOiByZXR1cm4gSlNPTi5zdHJpbmdpZnkobm9kZS5jb250ZW50KVxuICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIG5vZGUuY29udGVudC5uYW1lXG4gICAgY2FzZSBcImxldFwiOiByZXR1cm4gYGxldCAke3ByZXR0eUJpbmRlcihub2RlLmNvbnRlbnQudmFyKX0gPSAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQudmFsdWUpfSBpblxcbiR7cHJldHR5QVNUKG5vZGUuY29udGVudC5ib2R5KX1gXG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBgJHtub2RlLmNvbnRlbnQuZW52PyBcIkVOVjogW1tcIisgX3ByZXR0eUVudihub2RlLmNvbnRlbnQuZW52KSA6IFwiXCJ9Zm4gJHtub2RlLmNvbnRlbnQudmFycy5tYXAocHJldHR5QmluZGVyKS5qb2luKFwiIFwiKX0gPT4gJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBgKCR7cHJldHR5QVNUKG5vZGUuY29udGVudC5mbil9ICR7bm9kZS5jb250ZW50LmFyZ3MubWFwKHByZXR0eUFTVCkuam9pbihcIiBcIil9KWBcbiAgICBjYXNlIFwicmVjb3JkXCI6IHJldHVybiBgeyR7bm9kZS5jb250ZW50Lm1hcCgoW2ssIHZdKSA9PiBgJHtrLmNvbnRlbnQubmFtZX06ICR7cHJldHR5QVNUKHYpfWApLmpvaW4oXCIsIFwiKX19YFxuICAgIGNhc2UgXCJlcnJvclwiOiByZXR1cm4gYFtFUlJPUjogJHtub2RlLmNvbnRlbnQubWVzc2FnZX1dYFxuICB9XG59XG5cblxuY29uc3QgemVyb1BvcyA9ICgpOiBQb3MgPT4gKHtvZmZzZXQ6IDAsIGxpbmU6IDEsIGNvbDogMX0pXG5jb25zdCB6ZXJvU3BhbiA9ICgpOiBTcGFuID0+ICh7c3RhcnQ6IHplcm9Qb3MoKSwgZW5kOiB6ZXJvUG9zKCl9KVxuXG5leHBvcnQgY29uc3QgbWtBc3QgPSA8VCBleHRlbmRzIHN0cmluZywgQz4odGFnOiBULCBjb250ZW50OiBDLCBzcGFuOiBTcGFuID0gemVyb1NwYW4oKSk6IFRhZzxULCBDPiA9PiAoeyQ6IHRhZywgY29udGVudCwgc3Bhbn0pXG5cbnR5cGUgVG9rZW5CYXNlID0ge3NwYW46IFNwYW59XG5cbnR5cGUgVG9rZW4gPVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJpZGVudFwiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBudW1iZXJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcInN5bWJvbFwiLCB2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJhcnJvd1wifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiY29tbWVudFwiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwia2V5d29yZFwiLCB2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfSlcblxudHlwZSBUb2tlbk5vU3BhbiA9IFRva2VuIGV4dGVuZHMgaW5mZXIgVCA/IFQgZXh0ZW5kcyB7c3BhbjogU3Bhbn0gPyBPbWl0PFQsIFwic3BhblwiPiA6IG5ldmVyIDogbmV2ZXJcblxuY29uc3QgdG9rZW5pemUgPSAoY29kZTogc3RyaW5nKToge3Rva2VuczogVG9rZW5bXSwgY29tbWVudHM6IENvbW1lbnRbXSwgZW9mOiBQb3N9ID0+IHtcbiAgbGV0IHRva2VuczogVG9rZW5bXSA9IFtdXG4gIGxldCBjb21tZW50czogQ29tbWVudFtdID0gW11cbiAgbGV0IGkgPSAwXG4gIGxldCBsaW5lID0gMVxuICBsZXQgY29sID0gMVxuXG4gIGxldCBpc0FscGhhID0gKGNoYXI6IHN0cmluZykgPT4gL1tBLVphLXpfXS8udGVzdChjaGFyKVxuICBsZXQgaXNEaWdpdCA9IChjaGFyOiBzdHJpbmcpID0+IC9bMC05XS8udGVzdChjaGFyKVxuICBsZXQgaXNJZGVudCA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16MC05X10vLnRlc3QoY2hhcilcbiAgbGV0IHBvcyA9ICgpOiBQb3MgPT4gKHtvZmZzZXQ6IGksIGxpbmUsIGNvbH0pXG4gIGxldCBhZHZhbmNlID0gKCkgPT4ge1xuICAgIGlmIChjb2RlW2ldID09PSBcIlxcblwiKSB7XG4gICAgICBpKytcbiAgICAgIGxpbmUrK1xuICAgICAgY29sID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICBpKytcbiAgICAgIGNvbCsrXG4gICAgfVxuICB9XG4gIGxldCBwdXNoID0gKHRva2VuOiBUb2tlbk5vU3Bhbiwgc3RhcnQ6IFBvcykgPT4ge1xuICAgIHRva2Vucy5wdXNoKHsuLi50b2tlbiwgc3Bhbjoge3N0YXJ0LCBlbmQ6IHBvcygpfX0gYXMgVG9rZW4pXG4gIH1cblxuICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgbGV0IGNoYXIgPSBjb2RlW2ldXG5cbiAgICBpZiAoL1xccy8udGVzdChjaGFyKSkge1xuICAgICAgYWR2YW5jZSgpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIi9cIiAmJiBjb2RlW2kgKyAxXSA9PT0gXCIvXCIpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBjb2RlW2ldICE9PSBcIlxcblwiKSBhZHZhbmNlKClcbiAgICAgIGNvbW1lbnRzLnB1c2gobWtBc3QoXCJjb21tZW50XCIsIGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKSwge3N0YXJ0LCBlbmQ6IHBvcygpfSkpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIj1cIiAmJiBjb2RlW2kgKyAxXSA9PT0gXCI+XCIpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJhcnJvd1wifSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChcIigpe309LDpcIi5pbmNsdWRlcyhjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZSA9IGNoYXIgYXMgXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCJcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGxldCB2YWx1ZSA9IFwiXCJcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBjb2RlW2ldXG4gICAgICAgIGlmIChjdXJyZW50ID09PSBcIlxcXFxcIikge1xuICAgICAgICAgIGxldCBuZXh0ID0gY29kZVtpICsgMV1cbiAgICAgICAgICBpZiAobmV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGVzY2FwZVwiLCBjb250ZW50OiBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSl9LCBzdGFydClcbiAgICAgICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGVzY2FwZWQgPSAoe246IFwiXFxuXCIsIHI6IFwiXFxyXCIsIHQ6IFwiXFx0XCIsICdcIic6ICdcIicsIFwiXFxcXFwiOiBcIlxcXFxcIn0gYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPilbbmV4dF1cbiAgICAgICAgICB2YWx1ZSArPSBlc2NhcGVkID8/IG5leHRcbiAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJyZW50ID09PSAnXCInKSBicmVha1xuICAgICAgICB2YWx1ZSArPSBjdXJyZW50XG4gICAgICAgIGFkdmFuY2UoKVxuICAgICAgfVxuICAgICAgaWYgKGNvZGVbaV0gIT09ICdcIicpIHtcbiAgICAgICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVudGVybWluYXRlZCBzdHJpbmcgbGl0ZXJhbFwiLCBjb250ZW50OiBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSl9LCBzdGFydClcbiAgICAgICAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxuICAgICAgfVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcInN0cmluZ1wiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoaXNEaWdpdChjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZVN0YXJ0ID0gaVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBpc0RpZ2l0KGNvZGVbaV0pKSBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBOdW1iZXIoY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKSl9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzQWxwaGEoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNJZGVudChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBjb2RlLnNsaWNlKHZhbHVlU3RhcnQsIGkpXG4gICAgICBpZiAodmFsdWUgPT09IFwibGV0XCIgfHwgdmFsdWUgPT09IFwiaW5cIiB8fCB2YWx1ZSA9PT0gXCJmblwiKSBwdXNoKHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGVsc2UgcHVzaCh7dHlwZTogXCJpZGVudFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgIGFkdmFuY2UoKVxuICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogYFVuZXhwZWN0ZWQgY2hhcmFjdGVyOiAke2NoYXJ9YCwgY29udGVudDogY2hhcn0sIHN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxufVxuXG5jbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGkgPSAwXG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSB0b2tlbnM6IFRva2VuW10sIHByaXZhdGUgc291cmNlOiBzdHJpbmcsIHByaXZhdGUgZW9mOiBQb3MpIHt9XG5cbiAgcGFyc2UoKTogQVNUIHtcbiAgICBsZXQgYXN0ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIGlmICh0aGlzLnBlZWsoKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5wZWVrKCkhLnNwYW4uc3RhcnRcbiAgICAgIGxldCBlbmQgPSB0aGlzLnRva2Vuc1t0aGlzLnRva2Vucy5sZW5ndGggLSAxXT8uc3Bhbi5lbmQgPz8gc3RhcnRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVuZXhwZWN0ZWQgZXh0cmEgaW5wdXQgYWZ0ZXIgZXhwcmVzc2lvblwiLCB7c3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgfVxuICAgIHJldHVybiBhc3RcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VFeHByKCk6IEFTVCB7XG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwibGV0XCIpKSByZXR1cm4gdGhpcy5wYXJzZUxldCgpXG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwiZm5cIikpIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb24oKVxuICAgIHJldHVybiB0aGlzLnBhcnNlQXRvbSgpXG4gIH1cblxuICBwcml2YXRlIHBhcnNlTGV0KCk6IEFTVCB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5leHBlY3RLZXl3b3JkKFwibGV0XCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyaWFibGUgPSB0aGlzLnBhcnNlTGV0QmluZGVyKClcbiAgICBpZiAodmFyaWFibGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gdmFyaWFibGVcblxuICAgIGxldCB2YWx1ZTogQVNUXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI9XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIj1cIilcbiAgICAgIHZhbHVlID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIilcbiAgICB9XG5cbiAgICBsZXQgYm9keTogQVNUXG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwiaW5cIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0S2V5d29yZChcImluXCIpXG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkIGtleXdvcmQgaW4gYWZ0ZXIgbGV0IGJpbmRpbmdcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGtleXdvcmQgaW4gYWZ0ZXIgbGV0IGJpbmRpbmdcIilcbiAgICB9XG5cbiAgICByZXR1cm4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdmFyaWFibGUsIHZhbHVlLCBib2R5fSwge3N0YXJ0LCBlbmQ6IGJvZHkuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUZ1bmN0aW9uKCk6IEFTVCB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5leHBlY3RLZXl3b3JkKFwiZm5cIikuc3Bhbi5zdGFydFxuICAgIGxldCB2YXJzOiBWYXJbXSA9IFtdXG4gICAgd2hpbGUgKHRoaXMucGVlaygpPy50eXBlID09PSBcImlkZW50XCIgfHwgdGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIGxldCBiaW5kZXIgPSB0aGlzLnBhcnNlQmluZGVyKClcbiAgICAgIGlmIChiaW5kZXIuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keTogYmluZGVyfSwge3N0YXJ0LCBlbmQ6IGJpbmRlci5zcGFuLmVuZH0pXG4gICAgICB2YXJzLnB1c2goYmluZGVyKVxuICAgIH1cbiAgICBsZXQgYm9keTogQVNUXG4gICAgaWYgKHZhcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBpZiAodGhpcy5tYXRjaFRva2VuKFwiYXJyb3dcIikpIGJvZHkgPSB0aGlzLndyYXBFcnJvcihcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgdGhpcy5wYXJzZUV4cHIoKSlcbiAgICAgIGVsc2UgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHN0YXJ0KVxuICAgIH0gZWxzZSBpZiAoIXRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSB7XG4gICAgICBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJz0+JyBhZnRlciBmdW5jdGlvbiBwYXJhbWV0ZXJzXCIpXG4gICAgfSBlbHNlIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfVxuICAgIHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzLCBib2R5fSwge3N0YXJ0LCBlbmQ6IGJvZHkuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0b20oKTogQVNUIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4pIHJldHVybiB0aGlzLmVycm9ySGVyZShcIlVuZXhwZWN0ZWQgZW5kIG9mIGlucHV0XCIpXG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJpZGVudFwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwidmFyXCIsIHtuYW1lOiB0b2tlbi52YWx1ZX0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcIm51bWJlclwiLCB0b2tlbi52YWx1ZSwgdG9rZW4uc3BhbilcbiAgICB9XG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInN0cmluZ1wiLCB0b2tlbi52YWx1ZSwgdG9rZW4uc3BhbilcbiAgICB9XG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiZXJyb3JcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiB0b2tlbi5tZXNzYWdlLCBjb250ZW50OiB0b2tlbi5jb250ZW50fSwgdG9rZW4uc3BhbilcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHJldHVybiB0aGlzLnBhcnNlUGFyZW5zKClcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIntcIikpIHJldHVybiB0aGlzLnBhcnNlUmVjb3JkKClcblxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBVbmV4cGVjdGVkIHRva2VuOiAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWAsIHRva2VuLnNwYW4pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUGFyZW5zKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIihcIilcbiAgICBsZXQgaXRlbXM6IEFTVFtdID0gW11cbiAgICB3aGlsZSAoIXRoaXMuaXNTeW1ib2woXCIpXCIpKSB7XG4gICAgICBpZiAoIXRoaXMucGVlaygpKSB7XG4gICAgICAgIGxldCBlbmQgPSBpdGVtcy5sZW5ndGggPiAwID8gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgaXRlbXMucHVzaCh0aGlzLnBhcnNlRXhwcigpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJFbXB0eSBwYXJlbnRoZXNlcyBhcmUgbm90IGFsbG93ZWRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBjbG9zZS5zcGFuLmVuZC5vZmZzZXQpKVxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDEpIHJldHVybiBpdGVtc1swXVxuICAgIHJldHVybiBta0FzdChcImFwcFwiLCB7Zm46IGl0ZW1zWzBdLCBhcmdzOiBpdGVtcy5zbGljZSgxKX0sIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VSZWNvcmQoKTogQVNUIHtcbiAgICBsZXQgb3BlbiA9IHRoaXMuZXhwZWN0U3ltYm9sKFwie1wiKVxuICAgIGxldCBmaWVsZHM6IFtWYXIsIEFTVF1bXSA9IFtdXG5cbiAgICB3aGlsZSAoIXRoaXMuaXNTeW1ib2woXCJ9XCIpKSB7XG4gICAgICBpZiAoIXRoaXMucGVlaygpKSB7XG4gICAgICAgIGxldCBlbmQgPSBmaWVsZHMubGVuZ3RoID4gMCA/IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV1bMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpIVxuICAgICAgICB0aGlzLmkrK1xuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoYEV4cGVjdGVkIHJlY29yZCBmaWVsZCBuYW1lLCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiB0b2tlbi5zcGFuLmVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIHRva2VuLnNwYW4uZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBsZXQga2V5ID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgICBsZXQgdmFsdWUgPSB0aGlzLmlzU3ltYm9sKFwiOlwiKVxuICAgICAgICA/ICh0aGlzLmV4cGVjdFN5bWJvbChcIjpcIiksIHRoaXMuaXNTeW1ib2woXCJ9XCIpID8gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCByZWNvcmQgZmllbGQgdmFsdWUgYWZ0ZXIgJzonXCIpIDogdGhpcy5wYXJzZUV4cHIoKSlcbiAgICAgICAgOiBrZXlcbiAgICAgIGZpZWxkcy5wdXNoKFtrZXksIHZhbHVlXSlcbiAgICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiLFwiKSkgdGhpcy5pKytcbiAgICAgIGVsc2UgYnJlYWtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNTeW1ib2woXCJ9XCIpKSB7XG4gICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHJlY29yZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgfVxuICAgIGxldCBjbG9zZSA9IHRoaXMuZXhwZWN0U3ltYm9sKFwifVwiKVxuICAgIHJldHVybiBta0FzdChcInJlY29yZFwiLCBmaWVsZHMsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiKFwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgICBsZXQgZGVjbGFyZWRUeXBlID0gdGhpcy5wYXJzZUF0b20oKVxuICAgICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyIGluIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICBpZiAoIXRoaXMuaXNTeW1ib2woXCIpXCIpKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnKScgYWZ0ZXIgYmluZGVyIHBhdHRlcm5cIilcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKVwiKVxuICAgICAgaWYgKGRlY2xhcmVkVHlwZS4kID09PSBcImVycm9yXCIpIHJldHVybiBkZWNsYXJlZFR5cGVcbiAgICAgIGxldCB2YXJpYWJsZSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgICAgcmV0dXJuIHZhcmlhYmxlXG4gICAgfVxuICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICBpZiAoIW5hbWUpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGlkZW50aWZpZXJcIilcbiAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIjpcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiOlwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICB2YXJpYWJsZS50eXBlID0gZGVjbGFyZWRUeXBlXG4gICAgfVxuICAgIHJldHVybiB2YXJpYWJsZVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRlcigpOiBWYXIgfCBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PiB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VCaW5kZXIoKVxuICB9XG5cbiAgcHJpdmF0ZSBwZWVrKCk6IFRva2VuIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbnNbdGhpcy5pXVxuICB9XG5cbiAgcHJpdmF0ZSBpc0tleXdvcmQodmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJrZXl3b3JkXCIgJiYgdG9rZW4udmFsdWUgPT09IHZhbHVlXG4gIH1cblxuICBwcml2YXRlIGlzU3ltYm9sKHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIik6IGJvb2xlYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgcmV0dXJuIHRva2VuPy50eXBlID09PSBcInN5bWJvbFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RUb2tlbjxLIGV4dGVuZHMgVG9rZW5bXCJ0eXBlXCJdPih0eXBlOiBLKTogRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuIHx8IHRva2VuLnR5cGUgIT09IHR5cGUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHt0eXBlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlbiBhcyBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+XG4gIH1cblxuICBwcml2YXRlIG1hdGNoVG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4gfCB1bmRlZmluZWQge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwia2V5d29yZFwiIHx8IHRva2VuLnZhbHVlICE9PSB2YWx1ZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBrZXl3b3JkICR7dmFsdWV9LCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuXG4gIH1cblxuICBwcml2YXRlIGV4cGVjdFN5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbj8udHlwZSAhPT0gXCJzeW1ib2xcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7dmFsdWV9JywgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBkZXNjcmliZSh0b2tlbjogVG9rZW4gfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICAgIGlmICghdG9rZW4pIHJldHVybiBcImVuZCBvZiBpbnB1dFwiXG4gICAgaWYgKFwidmFsdWVcIiBpbiB0b2tlbikgcmV0dXJuIGAke3Rva2VuLnR5cGV9KCR7U3RyaW5nKHRva2VuLnZhbHVlKX0pYFxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHJldHVybiBgZXJyb3IoJHt0b2tlbi5tZXNzYWdlfSlgXG4gICAgcmV0dXJuIHRva2VuLnR5cGVcbiAgfVxuXG4gIHByaXZhdGUgZXJyb3JOb2RlKG1lc3NhZ2U6IHN0cmluZywgc3Bhbj86IFNwYW4sIGNvbnRlbnQ/OiBzdHJpbmcpOiBFcnJvck5vZGUge1xuICAgIGxldCBmaW5hbFNwYW4gPSBzcGFuID8/IHRoaXMucG9pbnRTcGFuKClcbiAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZSwgY29udGVudDogY29udGVudCA/PyB0aGlzLnNvdXJjZS5zbGljZShmaW5hbFNwYW4uc3RhcnQub2Zmc2V0LCBmaW5hbFNwYW4uZW5kLm9mZnNldCl9LCBmaW5hbFNwYW4pXG4gIH1cblxuICBwcml2YXRlIGVycm9ySGVyZShtZXNzYWdlOiBzdHJpbmcsIHN0YXJ0PzogUG9zKTpFcnJvck5vZGUge1xuICAgIGxldCBzcGFuID0gdGhpcy5wZWVrKCk/LnNwYW4gPz8ge3N0YXJ0OiB0aGlzLmVvZiwgZW5kOiB0aGlzLmVvZn1cbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUobWVzc2FnZSwge3N0YXJ0OiBzdGFydCA/PyBzcGFuLnN0YXJ0LCBlbmQ6IHNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgd3JhcEVycm9yKG1lc3NhZ2U6IHN0cmluZywgbm9kZTogQVNUKTogQVNUIHtcbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUobWVzc2FnZSwgbm9kZS5zcGFuLCB0aGlzLnNvdXJjZS5zbGljZShub2RlLnNwYW4uc3RhcnQub2Zmc2V0LCBub2RlLnNwYW4uZW5kLm9mZnNldCkpXG4gIH1cblxuICBwcml2YXRlIHBvaW50U3BhbigpOiBTcGFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbikgcmV0dXJuIHRva2VuLnNwYW5cbiAgICByZXR1cm4ge3N0YXJ0OiB0aGlzLmVvZiwgZW5kOiB0aGlzLmVvZn1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgYnVpbGRBc3RNYXAgPSAoYXN0OiBBU1QsIGNvbW1lbnRzOiBDb21tZW50W10gPSBbXSk6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0+IHtcbiAgbGV0IG1heEVuZCA9IGNvbW1lbnRzLnJlZHVjZSgobSwgYykgPT4gYy5zcGFuLmVuZC5vZmZzZXQgPiBtID8gYy5zcGFuLmVuZC5vZmZzZXQgOiBtLCBhc3Quc3Bhbi5lbmQub2Zmc2V0KVxuICBsZXQgcmVzOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IEFycmF5LmZyb20oe2xlbmd0aDogbWF4RW5kfSwgKCk9PnVuZGVmaW5lZClcbiAgY29uc3Qgd2FsayA9IChub2RlOiBBU1QpID0+IHtcbiAgICBmb3IgKGxldCBpID0gbm9kZS5zcGFuLnN0YXJ0Lm9mZnNldDsgaSA8IG5vZGUuc3Bhbi5lbmQub2Zmc2V0OyBpKyspIHJlc1tpXSA9IG5vZGVcbiAgICBjaGlsZHJlbihub2RlKS5mb3JFYWNoKHdhbGspXG4gIH1cbiAgd2Fsayhhc3QpXG4gIGNvbW1lbnRzLmZvckVhY2goY29tbWVudCA9PiB7XG4gICAgZm9yIChsZXQgaSA9IGNvbW1lbnQuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBjb21tZW50LnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBjb21tZW50XG4gIH0pXG4gIHJldHVybiByZXNcbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGNvZGU6c3RyaW5nKTogUGFyc2VSZXN1bHQgPT4ge1xuICBsZXQge3Rva2VucywgY29tbWVudHMsIGVvZn0gPSB0b2tlbml6ZShjb2RlKVxuICBsZXQgYXN0ID0gbmV3IFBhcnNlcih0b2tlbnMsIGNvZGUsIGVvZikucGFyc2UoKVxuICByZXR1cm4ge2FzdCwgY29tbWVudHMsIGFzdG1hcDogYnVpbGRBc3RNYXAoYXN0LCBjb21tZW50cyl9XG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZUFTVCA9IChjb2RlOnN0cmluZyk6IEFTVCA9PiBwYXJzZShjb2RlKS5hc3RcblxuZXhwb3J0IGNvbnN0IGNoaWxkcmVuID0gKG5vZGU6IEFTVCk6IEFTVFtdID0+IHtcbiAgaWYgKG5vZGUuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gWy4uLm5vZGUuY29udGVudC52YXJzLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJhcHBcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQuZm4sIC4uLm5vZGUuY29udGVudC5hcmdzXVxuICBpZiAobm9kZS4kID09PSBcImxldFwiKSByZXR1cm4gW25vZGUuY29udGVudC52YXIsIG5vZGUuY29udGVudC52YWx1ZSwgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwicmVjb3JkXCIpIHJldHVybiBub2RlLmNvbnRlbnQuZmxhdE1hcCgoW2tleSwgdmFsdWVdKSA9PiBba2V5LCB2YWx1ZV0pXG4gIHJldHVybiBbXVxufVxuXG5jb25zdCBzdHJpcFNwYW5zID0gKGFzdDogQVNUKTogdW5rbm93biA9PiB7XG4gIGlmIChhc3QuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyczogYXN0LmNvbnRlbnQudmFycy5tYXAoc3RyaXBTcGFucyksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwiYXBwXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHtmbjogc3RyaXBTcGFucyhhc3QuY29udGVudC5mbiksIGFyZ3M6IGFzdC5jb250ZW50LmFyZ3MubWFwKHN0cmlwU3BhbnMpfX1cbiAgaWYgKGFzdC4kID09PSBcImxldFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhciksIHZhbHVlOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhbHVlKSwgYm9keTogc3RyaXBTcGFucyhhc3QuY29udGVudC5ib2R5KX19XG4gIGlmIChhc3QuJCA9PT0gXCJyZWNvcmRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnQubWFwKChbbmFtZSwgdmFsdWVdKSA9PiBbc3RyaXBTcGFucyhuYW1lKSwgc3RyaXBTcGFucyh2YWx1ZSldKX1cbiAgaWYgKGFzdC4kID09PSBcImVycm9yXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50fVxuICByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbn1cblxuXG5sZXQgc3RyaW5naWZ5ID0gKHg6IHVua25vd24pID0+IEpTT04uc3RyaW5naWZ5KHgsIG51bGwsIDIpXG5cbmNvbnN0IHRlc3RfcGFyc2UgPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogQVNUKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuXG4gIGlmIChKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpICE9PSBKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGV4cGVjdGVkKSkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIHN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpKVxuICAgIHRocm93IG5ldyBFcnJvcihgVGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmNvbnN0IHRlc3Rfc3BhbiA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBTcGFuKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuICBpZiAoSlNPTi5zdHJpbmdpZnkoYXN0LnNwYW4pICE9PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZCkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTpcIiwgY29kZSlcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIGV4cGVjdGVkKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIGFzdC5zcGFuKVxuICAgIHRocm93IG5ldyBFcnJvcihgU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTogJHtjb2RlfWApXG4gIH1cbn1cblxuZXhwb3J0IGxldCBta251bSA9IChuOiBudW1iZXIpID0+IG1rQXN0KFwibnVtYmVyXCIsIG4pXG5leHBvcnQgbGV0IG1rc3RyID0gKHM6IHN0cmluZykgPT4gbWtBc3QoXCJzdHJpbmdcIiwgcylcbmV4cG9ydCBsZXQgbWt2YXIgPSAobmFtZTogc3RyaW5nKSA9PiBta0FzdChcInZhclwiLCB7bmFtZX0pXG5leHBvcnQgbGV0IG1rYXBwID0gKGZuOiBBU1QsIGFyZ3M6IEFTVFtdKSA9PiBta0FzdChcImFwcFwiLCB7Zm4sIGFyZ3N9KVxuZXhwb3J0IGxldCBta2xldCA9ICh2OiBzdHJpbmcgfCBWYXIsIHZhbHVlOiBBU1QsIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYsIHZhbHVlLCBib2R5fSlcbmV4cG9ydCBsZXQgbWtmdW4gPSAodmFyczogKHN0cmluZyB8IFZhcilbXSwgYm9keTogQVNULCBlbnY/IDpFbnYpID0+IG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnM6IHZhcnMubWFwKHYgPT4gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYpLCBib2R5LCBlbnZ9KSBhcyBGdW5jXG5leHBvcnQgbGV0IGFubm90ID0gKHR5cGU6IEFTVCwgdmFsdWU6IEFTVCkgPT4gbWtBc3QoXCJhbm5vdFwiLCB7dHlwZSwgdmFsdWV9KVxuZXhwb3J0IGxldCBta3JlY29yZCA9IChmaWVsZHM6IHtba2V5IDogc3RyaW5nXSA6IEFTVH0pID0+IG1rQXN0KFwicmVjb3JkXCIsIE9iamVjdC5lbnRyaWVzKGZpZWxkcykubWFwKChbayx2XSk9PiBbbWt2YXIoayksIHZdKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcInhcIjogbWt2YXIoXCJ4XCIpLFxuICBcIjIyXCI6IG1rbnVtKDIyKSxcbiAgJ1wiaGVsbG9cIic6IG1rc3RyKFwiaGVsbG9cIiksXG4gIFwiKGYgeClcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpXSksXG4gIFwiKGYgeCB5KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIiksIG1rdmFyKFwieVwiKV0pLFxuICBcImxldCB4ID0gMjIgaW4geFwiOiBta2xldChcInhcIiwgbWtudW0oMjIpLCBta3ZhcihcInhcIikpLFxuICBcInthOiAyMiwgYjogeH1cIjogbWtyZWNvcmQoe2E6IG1rbnVtKDIyKSwgYjogbWt2YXIoXCJ4XCIpfSksXG4gIFwiZm4geCA9PiB4XCI6IG1rZnVuKFtcInhcIl0sIG1rdmFyKFwieFwiKSksXG4gIFwiZm4geCB5ID0+IHhcIjogbWtmdW4oW1wieFwiLCBcInlcIl0sIG1rdmFyKFwieFwiKSksXG4gIFwibGV0IChudW1iZXIgeCkgPSAyMiBpbiB4XCI6IG1rbGV0KE9iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KSwgbWtudW0oMjIpLCBta3ZhcihcInhcIikpLFxuICBcImZuIChudW1iZXIgeCkgKHN0cmluZyB5KSA9PiB4XCI6IG1rZnVuKFtcbiAgICBPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksXG4gICAgT2JqZWN0LmFzc2lnbihta3ZhcihcInlcIiksIHt0eXBlOiBta3ZhcihcInN0cmluZ1wiKX0pLFxuICBdLCBta3ZhcihcInhcIikpLFxuICBcIntlOjIyfVwiIDogbWtyZWNvcmQoe2U6IG1rbnVtKDIyKX0pLFxuICBcIntlfVwiOiBta3JlY29yZCh7ZTogbWt2YXIoXCJlXCIpfSksXG4gIFwiLy9jb21tZW50XFxuMjJcIjogcGFyc2VBU1QoXCIyMlwiKSxcbn0pLmZvckVhY2goKFtjb2RlLCBleHBlY3RlZF0pID0+IHRlc3RfcGFyc2UoY29kZSwgZXhwZWN0ZWQgYXMgQVNUKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcIihcIjogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIGNvbnRlbnQ6IFwiKFwifSksXG4gIFwibGV0IHggMjIgaW4geFwiOiBta0FzdChcImxldFwiLCB7XG4gICAgdmFyOiBta3ZhcihcInhcIiksXG4gICAgdmFsdWU6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgY29udGVudDogXCIyMlwifSksXG4gICAgYm9keTogbWt2YXIoXCJ4XCIpLFxuICB9KSxcbiAgXCJ7ZTp9XCI6IG1rcmVjb3JkKHtlOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkIHJlY29yZCBmaWVsZCB2YWx1ZSBhZnRlciAnOidcIiwgY29udGVudDogXCJ9XCJ9KX0pLFxuXG59KS5mb3JFYWNoKChbY29kZSwgZXhwZWN0ZWRdKSA9PiB0ZXN0X3BhcnNlKGNvZGUsIGV4cGVjdGVkIGFzIEFTVCkpXG5cbnRlc3Rfc3BhbihcImxldCB4ID0gMjJcXG5pbiB4XCIsIHtcbiAgc3RhcnQ6IHtvZmZzZXQ6IDAsIGxpbmU6IDEsIGNvbDogMX0sXG4gIGVuZDoge29mZnNldDogMTUsIGxpbmU6IDIsIGNvbDogNX0sXG59KVxuIiwKICAgICJpbXBvcnQgeyBBU1QsIFZhciB9IGZyb20gXCIuL3BhcnNlclwiXG5pbXBvcnQge2NoaWxkcmVufSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5cbmV4cG9ydCBjb25zdCBnZXRkZWYgPSAocm9vdDogQVNULCB2YXJpOiBWYXIpOiBBU1QgfCB1bmRlZmluZWQgPT4ge1xuICBpZiAocm9vdC5zcGFuLnN0YXJ0Lm9mZnNldCA+IHZhcmkuc3Bhbi5zdGFydC5vZmZzZXQgfHwgcm9vdC5zcGFuLmVuZC5vZmZzZXQgPCB2YXJpLnNwYW4uZW5kLm9mZnNldCkgcmV0dXJuIHVuZGVmaW5lZFxuICBmb3IgKGxldCBjaGlsZCBvZiBjaGlsZHJlbihyb290KSl7XG4gICAgbGV0IHJlcyA9IGdldGRlZihjaGlsZCwgdmFyaSlcbiAgICBpZiAocmVzKSByZXR1cm4gcmVzXG4gIH1cblxuICBpZiAocm9vdC4kID09PSBcImxldFwiICYmIHJvb3QuY29udGVudC52YXIuY29udGVudC5uYW1lID09PSB2YXJpLmNvbnRlbnQubmFtZSlcbiAgICByZXR1cm4gcm9vdC5jb250ZW50LnZhclxuXG4gIGlmIChyb290LiQgPT09IFwiZnVuY3Rpb25cIilcbiAgICBmb3IgKGxldCB2IG9mIHJvb3QuY29udGVudC52YXJzKVxuICAgICAgaWYgKHYuY29udGVudC5uYW1lID09PSB2YXJpLmNvbnRlbnQubmFtZSlcbiAgICAgICAgcmV0dXJuIHZcbn1cbiIsCiAgICAiaW1wb3J0IHsgQVJHLCBib2R5LCBjb2xvciwgZGl2LCBOT0RFLCBwLCBwcmUgfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7RW52LCBta251bSwgdHlwZSBBU1QsIHR5cGUgRnVuY30gZnJvbSBcIi4vcGFyc2VyXCJcbmltcG9ydCB7cGFyc2UsIHByZXR0eUFTVCwgbWt2YXIsIG1rYXBwLCBta2Z1biwgbWtsZXQsIFZhcn0gZnJvbSBcIi4vcGFyc2VyXCJcblxuXG5leHBvcnQgbGV0IE5VTUJFUiA6IEFTVCA9IG1rdmFyKFwibnVtYmVyXCIpXG5leHBvcnQgbGV0IFNUUklORyA6IEFTVCA9IG1rdmFyKFwic3RyaW5nXCIpXG5leHBvcnQgbGV0IFRZUEUgOiBBU1QgPSBta3ZhcihcInR5cGVcIilcbmV4cG9ydCBsZXQgVFlQRU9GOiBBU1QgPSBta3ZhcihcInR5cGVvZlwiKTtcblxuTlVNQkVSLnR5cGUgPSBUWVBFXG5TVFJJTkcudHlwZSA9IFRZUEVcblRZUEUudHlwZSA9IFRZUEVcblRZUEVPRi50eXBlID0gcGFyc2UoXCJmbiBmID0+IGZuIHggPT4gdHlwZVwiKS5hc3QhXG5cbmV4cG9ydCBsZXQgQU5ZIDogQVNUID0gbWt2YXIoXCJhbnlcIilcblxubGV0IHByaW1pdGl2ZVR5cGUgPSAobmFtZTogc3RyaW5nKSA9PiAoe1xuICB0eXBlOiBUWVBFLFxuICBpbXBsOiAoeDogQVNUKSA9PiB7XG4gICAgaWYgKHgudHlwZSkge1xuICAgICAgaWYgKHgudHlwZS4kID09IFwidmFyXCIgJiYgeC50eXBlLmNvbnRlbnQubmFtZSA9PSBuYW1lKSByZXR1cm4geFxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yOiBleHBlY3RlZCAke25hbWV9LCBnb3QgJHtwcmV0dHlBU1QoeC50eXBlKX1gKVxuICAgIH1cbiAgICB4LnR5cGUgPSBta3ZhcihuYW1lKVxuICAgIHJldHVybiB4XG4gIH1cbn0pXG5cbmxldCBidWlsdGluczogUmVjb3JkPHN0cmluZywgeyB0eXBlOiBBU1QsIGltcGw6ICguLi5hcmdzOkFTVFtdKSA9PiBBU1QgfT4gPSB7XG4gIG51bWJlcjogcHJpbWl0aXZlVHlwZShcIm51bWJlclwiKSxcbiAgc3RyaW5nOiBwcmltaXRpdmVUeXBlKFwic3RyaW5nXCIpLFxuICBcImVxXCI6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCB5ID0+IChudW1iZXIgKGYgeCB5KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiBta251bShcbiAgICAgICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fFxuICAgICAgKHguJCA9PSBcInN0cmluZ1wiICYmIHkuJCA9PSBcInN0cmluZ1wiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8ICh4ID09IHkpXG4gICAgICA/IDEgOiAwKVxuICB9LFxuICBcImFkZFwiOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmPT4gZm4geCB5ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSAobnVtYmVyIHkpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiB7XG4gICAgICBpZiAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIpIHJldHVybiBta251bSh4LmNvbnRlbnQgKyB5LmNvbnRlbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gYWRkOiBleHBlY3RlZCBudW1iZXJzLCBnb3QgJHtwcmV0dHlBU1QoeCl9IGFuZCAke3ByZXR0eUFTVCh5KX1gKVxuICAgIH1cbiAgfSxcbiAgXCJpZmVsc2VcIiA6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4gVCBjb25kIHRoZW4gZWxzZSA9PiAoVCAoZiAobnVtYmVyIGNvbmQpIChUIHRoZW4pIChUIGVsc2UpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoY29uZCwgdGhlbiwgZWxzKSA9PiB7XG4gICAgICBsZXQgdmFsID0gY29uZC4kID09IFwibnVtYmVyXCIgPyBjb25kLmNvbnRlbnQgOiBjb25kLiQgPT0gXCJzdHJpbmdcIiA/IGNvbmQuY29udGVudC5sZW5ndGggOiAxXG4gICAgICByZXR1cm4gdmFsID8gdGhlbiA6IGVsc1xuICAgIH1cbiAgfSxcbiAgXCJ0eXBlb2ZcIjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0ISxcbiAgICBpbXBsOiAoeCkgPT4ge1xuICAgICAgaWYgKCF4LnR5cGUpIHJldHVybiBta2FwcChUWVBFT0YsIFt4XSlcbiAgICAgIHJldHVybiB4LnR5cGVcbiAgICB9XG4gIH1cbn1cblxuXG5sZXQgREVCVUcgPSAwXG5cbmxldCBsb2dnZXJQcmUgPSBwcmUoKVxuXG5ib2R5LnJlcGxhY2VDaGlscmVuKGxvZ2dlclByZSlcblxubGV0IGRlYnVnID0gKC4uLmFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gIGlmIChERUJVRykgbG9nZ2VyUHJlLmFwcGVuZChwcmUoYXJncy5qb2luKFwiIFwiKSkuc3R5bGUoe2JvcmRlcjogXCIxcHggc29saWQgXCIgKyBjb2xvci5jb2xvciwgcGFkZGluZzpcIi40ZW1cIiwgYm9yZGVyUmFkaXVzOiBcIi4zZW1cIiwgbWFyZ2luOlwiLjRlbVwifSkpXG59XG5cbmV4cG9ydCBjb25zdCBydW4gPSAoYXN0OiBBU1QpOiBBU1QgPT4ge1xuXG4gIGxldCBsb29rdXAgPSAobmFtZTogc3RyaW5nLCBlbnY6IEVudik6IHtiaW5kZXI6IFZhciwgdmFsdWU6IEFTVH0gfCBudWxsID0+IHtcbiAgICBpZiAoIWVudikgcmV0dXJuIG51bGxcbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbnYpKSByZXR1cm4gbG9va3VwKG5hbWUsIGVudlswXSkgfHwgbG9va3VwKG5hbWUsIGVudlsxXSlcbiAgICBpZiAoZW52LmJpbmRlci5jb250ZW50Lm5hbWUgPT09IG5hbWUpIHJldHVybiBlbnZcbiAgICByZXR1cm4gbG9va3VwKG5hbWUsIGVudi5uZXh0KVxuICB9XG5cbiAgbGV0IGZyZWVuYW1lID0gKGVudjpFbnYpOnN0cmluZz0+e1xuICAgIGxldCBuID0gMFxuICAgIHdoaWxlKGxvb2t1cChgeCR7bn1gLCBlbnYpKSBuKytcbiAgICByZXR1cm4gYHgke259YFxuICB9XG4gIGxldCBiaW5kID0gKGVudjogRW52LCBiaW5kZXI6IFZhciwgdmFsdWU6IEFTVCk6IEVudiA9PiAoe2JpbmRlciwgdmFsdWUsIG5leHQ6IGVudn0pXG4gIGxldCBiaW5kVmFsdWUgPSAoZW52OiBFbnYsIGJpbmRlcjogVmFyLCB2YWx1ZTogQVNULCBpbmZlciA9IGZhbHNlKTogRW52ID0+IHtcblxuICAgIGlmIChiaW5kZXIudHlwZSlcbiAgICAgIGlmICh2YWx1ZS50eXBlICYmIHByZXR0eUFTVChiaW5kZXIudHlwZSkgIT0gcHJldHR5QVNUKHZhbHVlLnR5cGUhKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yIGluIGxldDogZXhwZWN0ZWQgJHtwcmV0dHlBU1QoYmluZGVyLnR5cGUpfSwgZ290ICR7cHJldHR5QVNUKHZhbHVlLnR5cGUhKX1gKVxuICAgIGVsc2UgYmluZGVyLnR5cGUgPSB2YWx1ZS50eXBlXG4gICAgcmV0dXJuIGJpbmQoZW52LCBiaW5kZXIsIHZhbHVlKVxuXG4gIH1cblxuICBsZXQgYW5ub3QgPSAoYXN0OiBBU1QsIHR5cGU/OiBBU1QpOiBBU1QgPT4ge1xuICAgIGlmICh0eXBlID09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGFubm90YXRlIHdpdGggdW5kZWZpbmVkIHR5cGVcIilcbiAgICBpZiAoYXN0LnR5cGUgJiYgcHJldHR5QVNUKGFzdC50eXBlKSAhPSBwcmV0dHlBU1QodHlwZSkpIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtwcmV0dHlBU1QodHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QoYXN0LnR5cGUpfWApXG4gICAgYXN0LnR5cGUgPSB0eXBlXG4gICAgcmV0dXJuIGFzdFxuICB9XG5cbiAgY29uc3QgX2dvID0gKGFzdDogQVNULCBlbnY6IEVudik6IEFTVCA9PiB7XG4gICAgbGV0IGNhbGwgPSAoZm4gOiBBU1QsIGFyZ3M6IEFTVFtdKTogQVNUID0+IHtcbiAgICAgIGRlYnVnKFwiQ2FsbGluZ1wiLCBwcmV0dHlBU1QoZm4pLCBcIndpdGggYXJnc1wiLCBhcmdzLm1hcChwcmV0dHlBU1QpLmpvaW4oXCJcXG5cIikpXG4gICAgICBpZiAoZm4uJCA9PSBcInZhclwiICYmIGJ1aWx0aW5zW2ZuLmNvbnRlbnQubmFtZV0pIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKVxuICAgICAgaWYgKGZuLiQgPT0gXCJmdW5jdGlvblwiKXtcbiAgICAgICAgaWYgKGZuLmNvbnRlbnQudmFycy5sZW5ndGggIT09IGFyZ3MubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7Zm4uY29udGVudC52YXJzLmxlbmd0aH0gYXJndW1lbnRzLCBnb3QgJHthcmdzLmxlbmd0aH1gKVxuICAgICAgICBpZiAoZm4uY29udGVudC5lbnYgPT09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKFwiRnVuY3Rpb24gaGFzIG5vIGVudmlyb25tZW50XCIpXG4gICAgICAgIHJldHVybiBnbyhcbiAgICAgICAgICBmbi5jb250ZW50LmJvZHksXG4gICAgICAgICAgZm4uY29udGVudC52YXJzLnJlZHVjZSgoZW52LCB2LCBpKSA9PiBiaW5kVmFsdWUoZW52LCB2LCBhcmdzW2ldLCB0cnVlKSwgZm4uY29udGVudC5lbnYgYXMgRW52KVxuICAgICAgICApXG4gICAgICB9XG4gICAgICByZXR1cm4gbWthcHAoZm4sYXJncylcblxuICAgIH1cblxuICAgIHN3aXRjaChhc3QuJCl7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6IHJldHVybiBhbm5vdChhc3QsIE5VTUJFUilcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjogcmV0dXJuIGFubm90KGFzdCwgU1RSSU5HKVxuXG4gICAgICBjYXNlIFwidmFyXCI6IHtcbiAgICAgICAgaWYgKGJ1aWx0aW5zW2FzdC5jb250ZW50Lm5hbWVdKSBhbm5vdChhc3QsIGJ1aWx0aW5zW2FzdC5jb250ZW50Lm5hbWVdLnR5cGUpXG4gICAgICAgIGxldCBoaXQgPSBsb29rdXAoYXN0LmNvbnRlbnQubmFtZSwgW2Vudiwge2JpbmRlcjogYXN0ICx2YWx1ZTogYXN0LCBuZXh0OiBudWxsfV0pIVxuICAgICAgICBpZiAoaGl0LmJpbmRlci50eXBlKSBhbm5vdChhc3QsIGhpdC5iaW5kZXIudHlwZSlcbiAgICAgICAgcmV0dXJuIGhpdC52YWx1ZVxuXG4gICAgICB9XG4gICAgICBjYXNlIFwibGV0XCI6IHtcbiAgICAgICAgbGV0IHZhbHVlID0gZ28oYXN0LmNvbnRlbnQudmFsdWUsIGVudilcbiAgICAgICAgYW5ub3QoYXN0LmNvbnRlbnQudmFyLCB2YWx1ZS50eXBlISlcbiAgICAgICAgbGV0IHJlcyA9IGdvKGFzdC5jb250ZW50LmJvZHksIGJpbmRWYWx1ZShlbnYsIGFzdC5jb250ZW50LnZhciwgdmFsdWUsIHRydWUpKVxuICAgICAgICBhbm5vdChhc3QsIHJlcy50eXBlKVxuICAgICAgICByZXR1cm4gcmVzXG4gICAgICB9XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjp7XG4gICAgICAgIGlmIChhc3QuY29udGVudC5lbnYgPT0gdW5kZWZpbmVkKSBhc3QuY29udGVudC5lbnYgPSBlbnZcbiAgICAgICAgbGV0IHJ1bmJvZCA9IGNhbGwoYXN0LCBhc3QuY29udGVudC52YXJzKVxuICAgICAgICBsZXQgZnZhciA9IG1rdmFyKGZyZWVuYW1lKGVudikpXG4gICAgICAgIGxldCBmdHlwZSA9IG1rZnVuKFtmdmFyXSwgbWtmdW4oYXN0LmNvbnRlbnQudmFycywgcnVuYm9kKSlcbiAgICAgICAgcmV0dXJuIGFubm90KG1rZnVuKGFzdC5jb250ZW50LnZhcnMsIHJ1bmJvZCwgYXN0LmNvbnRlbnQuZW52KSwgZnR5cGUpXG4gICAgICB9XG5cbiAgICAgIGNhc2UgXCJhcHBcIjoge1xuICAgICAgICBsZXQgZm4gPSBnbyhhc3QuY29udGVudC5mbiwgZW52KVxuICAgICAgICBsZXQgYXJncyA9IGFzdC5jb250ZW50LmFyZ3MubWFwKGFyZyA9PiBnbyhhcmcsIGVudikpXG4gICAgICAgIGxldCByZXMgPSBjYWxsKGZuLCBhcmdzKVxuICAgICAgICBpZiAocmVzLnR5cGUpIGFubm90KGFzdCwgcmVzLnR5cGUpXG4gICAgICAgIHJldHVybiByZXNcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHJldHVybiBhc3RcbiAgICB9XG4gIH1cblxuICBjb25zdCBnbyA9IChhc3Q6IEFTVCwgZW52OiBFbnYpOiBBU1QgPT4ge1xuICAgIGxldCByZXMgPSBfZ28oYXN0LCBlbnYpXG4gICAgZGVidWcoXCJBU1Q6XCIsIHByZXR0eUFTVChhc3QpLCBcIlxcblR5cGU6XCIsIHByZXR0eUFTVChyZXMudHlwZSA/PyBBTlkpLCBcIlxcbi0+XCIsIHByZXR0eUFTVChyZXMpKVxuICAgIGxldCByZXN0eXBlID0gcmVzLnR5cGU7XG4gICAgaWYgKHJlc3R5cGUpIGFubm90KGFzdCwgcmVzdHlwZSlcbiAgICByZXR1cm4gcmVzXG4gIH1cbiAgcmV0dXJuIGdvKGFzdCwgbnVsbClcbn1cblxuXG5cbkRFQlVHID0gMVxuXG5sZXQgYXN0ID0gcGFyc2UoJyhmbiB4ID0+IGZuIHkgPT4geCAzKScpLmFzdFxubGV0IHJlcyA9IHJ1bihhc3QhKVxuXG5ERUJVRyA9IDBcblxuXG4vLyBsZXQgc2FtcGxlcyA9IFtcbi8vICAgXCIyMiB8IG51bWJlciB8IDIyXCIsXG4vLyAgICdsZXQgeCA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4vLyAgICdsZXQgKG51bWJlciB4KSA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4vLyAgICdmbiB4ID0+IHggfCBmbiB4MCA9PiBmbiB4ID0+ICh0eXBlb2YgeCknLFxuLy8gICAnKG51bWJlciAyMikgfCBudW1iZXIgfCAyMicsXG4vLyAgICdmbiAobnVtYmVyIHgpID0+IHggfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlciB8IGZuIChudW1iZXIgeCkgPT4geCcsXG4vLyAgICdmbiB4ID0+IChudW1iZXIgeCkgfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlcicsXG4vLyAgICcoZm4geCA9PiB4IDIyKSB8IG51bWJlcicsXG4vLyAgICcoZm4gKG51bWJlciB4KSA9PiB4IDIyKSB8IG51bWJlcicsXG4vLyAgICcoZm4gKHN0cmluZyB4KSA9PiB4IDIyKSB8IGVycm9yJyxcbi8vICAgJ2xldCBpZCA9IGZuIHggPT4geCBpbiBmbiB5ID0+IChpZCB5KSB8IGZuIHgwID0+IGZuIHkgPT4gKHR5cGVvZiB5KSB8IGZuIHkgPT4geScsXG4vLyAgICdmbiAobnVtYmVyIHgpID0+IChzdHJpbmcgeCkgfCBlcnJvcicsXG4vLyAgICdmbiB4ID0+IGZuIHkgPT4geSB8IGZuIHgwID0+IGZuIHggPT4gZm4geDAgPT4gZm4geSA9PiAodHlwZW9mIHkpJyxcbi8vICAgJ2ZuIHggPT4gZm4geSA9PiB4IHwgZm4geDAgPT4gZm4geCA9PiBmbiB4MCA9PiBmbiB5ID0+ICh0eXBlb2YgeCknLFxuLy8gICAnKGZuIHg9PiBmbiB5ID0+IHggMykgfCBmbiB4MCA9PiBmbiB5ID0+IG51bWJlcicsXG4vLyAgICcoKGZuIHg9PiBmbiB5PT4geCAzKSAyKSB8IG51bWJlciB8IDMnXG5cbi8vIF0ubWFwKGNvZGUgPT4gY29kZS5zcGxpdChcInxcIikubWFwKHMgPT4gcy50cmltKCkpKVxuXG5cbi8vIGxldCByZXN1bHRzID0gdGFibGUoKS5zdHlsZSh7XG4vLyAgIHdpZHRoOiBcIjEwMCVcIixcbi8vICAgd2hpdGVTcGFjZTogXCJwcmVcIixcbi8vIH0pXG5cblxuXG5cbi8vIGZvciAobGV0IFtjb2RlLCBleHBlY3RlZFR5cGUsIGV4cGVjdGVkUmVzdWx0XSBvZiBzYW1wbGVzKXtcblxuLy8gICBsZXQgYXN0ID0gcGFyc2UoY29kZSlcbi8vICAgbGV0IHJlcyA6IEFTVCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXG4vLyAgIGxldCBlcnJtZXNzYWdlOiBzdHJpbmcgPSBcIlwiXG4vLyAgIHRyeXsgcmVzID0gcnVuKGFzdC5hc3QpXG4vLyAgIH0gY2F0Y2goZSkge1xuLy8gICAgIGVycm1lc3NhZ2UgPSBTdHJpbmcoZSlcbi8vICAgICBpZiAoZXhwZWN0ZWRUeXBlICE9IFwiZXJyb3JcIikgY29uc29sZS5lcnJvcihgRXJyb3IgcnVubmluZyBjb2RlOiAke2NvZGV9XFxuYCwgZSlcbi8vICAgfVxuXG4vLyAgIGxldCB0eXBlU3RyID0gcmVzID8gcmVzLnR5cGUgPyBwcmV0dHlBU1QocmVzLnR5cGUpIDogXCJubyB0eXBlXCIgOiBcImVycm9yXCJcbi8vICAgbGV0IHJlc1N0ciA9IHJlcyA/IHByZXR0eUFTVChyZXMpIDogXCJlcnJvclwiXG4vLyAgIGxldCBjaGVjayA9ICh0eXBlU3RyID09IChleHBlY3RlZFR5cGUgPz8gdHlwZVN0cikgJiYgcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpKVxuXG4vLyAgIHR5cGVTdHIgPSB0eXBlU3RyID09IFwiZXJyb3JcIiA/IGVycm1lc3NhZ2UgOiB0eXBlU3RyXG4vLyAgIHJlc1N0ciA9IHJlc1N0ciA9PSBcImVycm9yXCIgPyBlcnJtZXNzYWdlIDogcmVzU3RyXG5cbi8vICAgaWYgKCFjaGVjaykge1xuLy8gICAgIHJlc3VsdHMuYXBwZW5kKFxuLy8gICAgICAgdHIoXG4vLyAgICAgICAgIHRkKGNvZGUpLFxuLy8gICAgICAgICB0ZCh0eXBlU3RyKS5zdHlsZSh7Y29sb3I6IHR5cGVTdHIgPT0gKGV4cGVjdGVkVHlwZSA/PyB0eXBlU3RyKSA/IFwiZ3JlZW5cIiA6IFwicmVkXCIsIHBhZGRpbmc6IFwiMCA4cHhcIn0pLFxuLy8gICAgICAgICB0ZChyZXNTdHIpLnN0eWxlKHtjb2xvcjogcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpID8gXCJncmVlblwiIDogXCJyZWRcIn0pXG4vLyAgICAgICApXG4vLyAgICAgICAuc3R5bGUoe2JvcmRlckJvdHRvbTogXCIxcHggc29saWQgXCIrY29sb3IuY29sb3IsfSlcbi8vICAgICApXG4vLyAgICAgYm9keS5hcHBlbmQoZGl2KHJlc3VsdHMpXG4vLyAgICAgLnN0eWxlKHtcbi8vICAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsXG4vLyAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuLy8gICAgICAgcGFkZGluZzogXCIxNnB4XCIsXG4vLyAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4vLyAgICAgfSkpXG4vLyAgIH1cbi8vIH0gICAgXG5cblxuXG4iLAogICAgIlxuXG5cblxuaW1wb3J0IHsgYm9keSwgaHRtbCwgc3BhbiAsIGZyb21IVE1MLCBoMiwgZGl2fSBmcm9tIFwiLi9odG1sXCI7XG5pbXBvcnQgeyBlZGl0b3IgfSBmcm9tIFwiLi9lZGl0b3JcIjtcbmltcG9ydCB7IHBhcnNlLCBwcmV0dHlBU1QsIHR5cGUgQVNULCB0eXBlIFNwYW4sIHR5cGUgU3ludGF4Tm9kZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgZ2V0ZGVmIH0gZnJvbSBcIi4vbHNwXCJcbmltcG9ydCB7IHJ1biwgQU5ZIH0gZnJvbSBcIi4vcnVudGltZVwiXG5pbXBvcnQgeyBjb2xvciB9IGZyb20gXCIuL2h0bWxcIjtcblxuXG5cbmNvbnN0IGFib3V0X3RleHQgPSBgXG5cbi8vIFRoaXMgaXMgYSB0b3kgY29kZSBlZGl0b3Igc3RpbGwgaW4gZGV2ZWxvcG1lbnQuXG5cbi8vIHRoZSBnb2FsIGlzIHRvIGJ1aWxkIGEgbGFuZ3VhZ2Ugd2l0aDpcblxuLy8gZXh0cmVtZWx5IG1pbmltYWwgc3ludGF4XG4vLyBmaXJzdCBjbGFzcyBzdXBwb3J0IGZvciB0eXBlcyBhcyB2YWx1ZXNcbi8vIGZpcnN0IGNhc3MgTFNQIHByb2dyYW1uZyBpbiBhIHN0cmFpZ2h0Zm9yd2FyZCB3YXkuXG5cbi8vIGhvdmVyIG92ZXIgeCB0byBzZWUgaXRzIGluZmVycmVkIHR5cGVcbmxldCBuID0gMjIgaW5cblxuLy8gdGhpcyBpcyBob3cgdHlwZXMgYXJlIGFubm90YXRlZC4gdHlwZXMgYXJlIGVzc2VudGlhbGx5IGp1c3QgZnVuY3Rpb25zIG92ZXIgdmFsdWVzLlxubGV0IGsgPSAobnVtYmVyIDMzKSBpblxubGV0IHUgPSAoc3RyaW5nIFwiaGxsb1wiKSBpblxuXG4vLyB1bnR5cGVkIGlkXG5sZXQgaWQgPSBmbiB4ID0+IHggaW5cblxuLy8gbnVtYmVyIHR5cGVkIGlkXG5sZXQgaWRuID0gZm4geCA9PiAobnVtYmVyIHgpIGluXG5cbi8vIHR5cGUgb2YgbnVtYmVyIC0+IG51bWJlclxubGV0IFQgPSBmbiBmID0+IGZuIChudW1iZXIgeCkgPT4gKG51bWJlciAoZiB4KSkgaW5cblxubGV0IF9pZCA9IChUIGlkKSBpblxuXG4vL2xldCBiYWQgPSAoX2lkIFwiZVwiKSBpblxuXG5sZXQgciA9IChpZCBcIjJcIikgaW5cblxuLy8gdGhpcyBpcyB3aWxsIHJlc3VsdCBpbiB0eXBlIGVycm9yLlxuLy8gbGV0IEJBRCA9IChpZG5fIFwiMlwiKSBpblxuXG4obnVtYmVyIHN0KVxuYFxuXG5cblxuXG5sZXQgb3V0dmlldyA9IGh0bWwoJ3ByZScpKCkuc3R5bGUoe1xuICBib3JkZXJUb3A6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICBwYWRkaW5nVG9wOiBcIjE2cHhcIixcbn0pXG5cbmxldCBhc3Q6IEFTVCB8IHVuZGVmaW5lZFxubGV0IGN1cnJlbnRBc3RNYXA6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gW11cblxuXG5sZXQgY29kZTpzdHJpbmcgPSAnJ1xuXG5sZXQgRWRpdCA9IGVkaXRvcihcbiAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJsaW5lc1wiKSA/PyBhYm91dF90ZXh0LFxuICBzPT4ge1xuICAgIHRyeXtcbiAgICAgIGxldCBwYXJzZWQgPSBwYXJzZShzKVxuICAgICAgYXN0ID0gcGFyc2VkLmFzdFxuICAgICAgY3VycmVudEFzdE1hcCA9IHBhcnNlZC5hc3RtYXBcbiAgICAgIGNvZGUgPSBzXG4gICAgICBsZXQgcmVzID0gcnVuKGFzdClcbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBwcmV0dHlBU1QocmVzKVxuXG4gICAgfWNhdGNoKGUpe1xuICAgICAgYXN0ID0gdW5kZWZpbmVkXG4gICAgICBjdXJyZW50QXN0TWFwID0gW11cbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSlcbiAgICB9XG4gIH0sXG4gICgpPT4gY3VycmVudEFzdE1hcCxcbiAgKHJlcSkgPT4ge1xuICAgIGxldCBkZWYgPSByZXEuJCA9PSBcInZhclwiID8gZ2V0ZGVmKGFzdCEsIHJlcSkgOiB1bmRlZmluZWRcbiAgICBpZiAoZGVmKSBFZGl0LnNldEN1cnNvcih7cm93OiBkZWYuc3Bhbi5zdGFydC5saW5lLTEsIGNvbDogZGVmLnNwYW4uc3RhcnQuY29sLTF9KVxuICB9LFxuICAobm9kZSkgPT4ge1xuICAgIGlmIChub2RlLiQgPT09IFwiY29tbWVudFwiKSByZXR1cm4gWycnLCBbXV1cblxuICAgIGxldCBzdHIgPSAobm9kZS4kICsgXCI6IFwiKVxuICAgIGxldCBtYXAgOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IHN0ci5zcGxpdCgnJykubWFwKGM9PiB1bmRlZmluZWQpXG5cbiAgICBsZXQgYXN0OkFTVCA9IG5vZGUudHlwZSA/IG5vZGUudHlwZSA6IEFOWVxuXG4gICAgbGV0IGNvID0gcHJldHR5QVNUKGFzdClcbiAgICBtYXAucHVzaCguLi5wYXJzZShjbykuYXN0bWFwKVxuICAgIHN0ciArPSBjb1xuXG4gICAgcmV0dXJuIFtzdHIsIG1hcF1cbiAgfVxuKVxuXG5cblxuXG5ib2R5LnN0eWxlKHtwYWRkaW5nOiBcIjQ0cHhcIixmb250RmFtaWx5OiBcInNhbnMtc2VyaWZcIix9KVxuXG5cbmxldCBidXR0biA9ICh0OnN0cmluZywgb25DbGljazooKSA9PiB2b2lkKSA9PiBzcGFuKHQsIG9uQ2xpY2spLnN0eWxlKHtjb2xvcjogXCJncmF5XCIsIGJvcmRlcjogXCIxcHggc29saWQgZ3JheVwiLCBib3JkZXJSYWRpdXM6IFwiNHB4XCIsIHBhZGRpbmc6IFwiMnB4IDRweFwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pXG5cbmJvZHkuYXBwZW5kKFxuICBkaXYoXG4gICAgc3Bhbign4pyI77iOJykuc3R5bGUoe2ZvbnRTaXplOiBcIjNlbVwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pLFxuICAgIHNwYW4oXCJNaUdcIikuc3R5bGUoe2ZvbnRTaXplOiBcIjEuNWVtXCIsIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLCBmb250RmFtaWx5OiBcIm1vbm9zcGFjZVwifSlcbiAgKS5zdHlsZSh7ZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIxNnB4XCIsIGNvbG9yOiBcImdyYXlcIn0pLFxuXG4gIEVkaXQuZWwsXG4gIG91dHZpZXcsXG4gIGJ1dHRuKFwiYWJvdXRcIiwgKCkgPT4gRWRpdC5zZXRUZXh0KGFib3V0X3RleHQpKSxcbiAgYnV0dG4oXCJnaXRodWJcIiwgKCkgPT4gd2luZG93Lm9wZW4oXCJodHRwczovL2dpdGh1Yi5jb20vZGtvcm1hbm4vbXllZGl0b3JcIikpXG4pXG5cblxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQWFPLElBQU0sT0FBTyxDQUF5QyxRQUFVLElBQUksYUFBb0Q7QUFBQSxFQUM3SCxJQUFJLFVBQVUsU0FBUyxLQUFLLE9BQUssT0FBTyxNQUFNLFVBQVU7QUFBQSxFQUN4RCxJQUFJLEtBQUssU0FBVSxTQUFTLGNBQWMsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFJLFNBQVMsT0FBTyxPQUFLLE9BQU8sTUFBTSxVQUFVLENBQXNCO0FBQUEsRUFDN0gsSUFBSTtBQUFBLElBQVMsR0FBRyxHQUFJLFVBQVc7QUFBQSxFQUUvQixPQUFPO0FBQUE7QUFJRixJQUFNLFdBQVksQ0FBMEIsT0FBbUI7QUFBQSxFQUNwRSxJQUFJLE9BQWlCO0FBQUEsSUFDbkIsR0FBRztBQUFBLElBQ0g7QUFBQSxJQUNBLFFBQVEsSUFBSSxhQUE4QjtBQUFBLE1BQ3hDLFNBQVMsUUFBUSxXQUFTO0FBQUEsUUFDeEIsSUFBSSxPQUFPLFVBQVU7QUFBQSxVQUFVLEdBQUcsWUFBWSxTQUFTLGVBQWUsS0FBSyxDQUFDO0FBQUEsUUFDdkU7QUFBQSxhQUFHLFlBQVksTUFBTSxFQUFFO0FBQUEsT0FFN0I7QUFBQSxNQUNELE9BQU8sU0FBUyxFQUFFO0FBQUE7QUFBQSxJQUVwQixnQkFBZ0IsSUFBSSxhQUE4QjtBQUFBLE1BQ2hELEdBQUcsZ0JBQWdCO0FBQUEsTUFDbkIsT0FBTyxLQUFLLE9BQU8sR0FBRyxRQUFRO0FBQUE7QUFBQSxJQUVoQyxPQUFPLENBQUMsV0FBeUM7QUFBQSxNQUMvQyxPQUFPLE9BQU8sR0FBRyxPQUFPLE1BQU07QUFBQSxNQUM5QixPQUFPLFNBQVMsRUFBRTtBQUFBO0FBQUEsSUFFcEIsUUFBUSxDQUFDLGNBQW9DO0FBQUEsTUFDM0MsT0FBTyxPQUFPLElBQUksU0FBUztBQUFBLE1BQzNCLE9BQU8sU0FBUyxFQUFFO0FBQUE7QUFBQSxFQUV0QjtBQUFBLEVBQ0EsT0FBTztBQUFBO0FBSUYsSUFBTSxNQUFNLEtBQUssS0FBSztBQUN0QixJQUFNLE9BQU8sS0FBSyxNQUFNO0FBQ3hCLElBQU0sSUFBSSxLQUFLLEdBQUc7QUFDbEIsSUFBTSxPQUFPLFNBQVMsU0FBUyxJQUFJO0FBQ25DLElBQU0sS0FBSyxLQUFLLElBQUk7QUFDcEIsSUFBTSxLQUFLLEtBQUssSUFBSTtBQUNwQixJQUFNLEtBQUssS0FBSyxJQUFJO0FBQ3BCLElBQU0sS0FBSyxLQUFLLElBQUk7QUFDcEIsSUFBTSxRQUFRLEtBQUssT0FBTztBQUMxQixJQUFNLEtBQUssS0FBSyxJQUFJO0FBQ3BCLElBQU0sS0FBSyxLQUFLLElBQUk7QUFDcEIsSUFBTSxNQUFNLEtBQUssS0FBSztBQUV0QixJQUFNLFNBQVMsS0FBSyxRQUFRO0FBRTVCLElBQU0sU0FBUyxLQUFLLFFBQVE7QUFJbkMsSUFBSSxZQUFZLFNBQVMsY0FBYyxPQUFPO0FBQzlDLFVBQVUsY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTZCeEIsU0FBUyxLQUFLLFlBQVksU0FBUztBQUc1QixJQUFNLFFBQVE7QUFBQSxFQUNuQixLQUFLO0FBQUEsRUFDTCxPQUFPO0FBQUEsRUFDUCxNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsRUFDUixRQUFRO0FBQUEsRUFDUixNQUFNO0FBQUEsRUFFTixNQUFNO0FBQUEsRUFDTixPQUFPO0FBQUEsRUFDUCxZQUFZO0FBQ2Q7QUFHQSxLQUFLLEdBQUcsUUFBTztBQUFBLGNBQ0QsTUFBTTtBQUFBLFNBQ1gsTUFBTTtBQUFBOzs7QUNsSGYsSUFBTSxVQUFVLENBQUMsU0FDZCxRQUFRLFlBQWEsTUFBTSxPQUMzQixLQUFLLE1BQU0sWUFBYSxNQUFNLE9BQzlCLEtBQUssTUFBTSxZQUFZLEtBQUssTUFBTSxXQUFhLE1BQU0sU0FDckQsS0FBSyxNQUFNLFFBQVMsTUFBTSxTQUMxQixLQUFLLE1BQU0sU0FBUyxLQUFLLEtBQUssYUFBZSxNQUFNLE9BQ25ELEtBQUssTUFBTSxRQUFTLE1BQU0sUUFDMUIsS0FBSyxNQUFNLFVBQVcsTUFBTSxNQUM3QixNQUFNO0FBS0QsSUFBTSxTQUFTLENBQ3BCLE1BQ0EsU0FDQSxXQUNBLFNBQ0EsY0FDRztBQUFBLEVBRUgsSUFBSSxRQUFRLEtBQUssTUFBTTtBQUFBLENBQUk7QUFBQSxFQUMzQixJQUFJLFNBQW9DLEVBQUMsS0FBSSxHQUFHLEtBQUksRUFBQztBQUFBLEVBRXJELElBQUksS0FBSyxLQUFLLEtBQUssRUFBRSxFQUNwQixNQUFNO0FBQUEsSUFDTCxZQUFZO0FBQUEsSUFDWixRQUFRO0FBQUEsRUFDVixDQUFDO0FBQUEsRUFHRCxJQUFJLE9BQWtCLENBQUM7QUFBQSxFQUN2QixJQUFJLFdBQVcsSUFBSTtBQUFBLEVBQ25CLElBQUksU0FBbUMsQ0FBQztBQUFBLEVBRXhDLElBQUksUUFBUSxDQUFDLEdBQVEsTUFBVyxFQUFFLE1BQU0sRUFBRSxPQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFBQSxFQUM5RSxJQUFJLFVBQVUsQ0FBQyxHQUFRLE1BQVcsRUFBRSxNQUFNLEVBQUUsT0FBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFO0FBQUEsRUFFakYsSUFBSSxXQUFXLE1BQStCO0FBQUEsSUFDNUMsSUFBSSxDQUFDLE9BQU87QUFBQSxNQUFXO0FBQUEsSUFDdkIsSUFBSSxPQUFPLE9BQU8sT0FBTyxVQUFVLE9BQU8sT0FBTyxPQUFPLE9BQU8sVUFBVSxLQUFLO0FBQUEsTUFDNUUsT0FBTyxZQUFZO0FBQUEsTUFDbkI7QUFBQSxJQUNGO0FBQUEsSUFDQSxJQUFJLFFBQVEsUUFBUSxPQUFPLFNBQVM7QUFBQSxNQUFHLE9BQU8sQ0FBQyxRQUFRLE9BQU8sU0FBUztBQUFBLElBQ2xFO0FBQUEsYUFBTyxDQUFDLE9BQU8sV0FBVyxNQUFNO0FBQUE7QUFBQSxFQUd2QyxNQUFNLFNBQVMsTUFBTTtBQUFBLElBQ25CLElBQUksUUFBTyxNQUFNLEtBQUs7QUFBQSxDQUFJO0FBQUEsSUFDMUIsSUFBSSxPQUFPLEtBQUssSUFBSSxPQUFPLEtBQUssTUFBTSxPQUFPLE1BQU0sVUFBVSxDQUFDO0FBQUEsSUFFOUQsSUFBSSxRQUF1QixDQUFDO0FBQUEsSUFHNUIsSUFBSSxVQUFVLE1BQU07QUFBQSxNQUNsQixNQUFNLFFBQVEsQ0FBQyxHQUFHLE1BQUk7QUFBQSxRQUNwQixJQUFJLE1BQU0sT0FBTztBQUFBLFFBQ2pCLElBQUksU0FBUSxRQUFRLEdBQUc7QUFBQSxRQUN2QixJQUFJO0FBQUEsVUFBTyxFQUFFLE1BQU0sUUFBUTtBQUFBLFFBQ3RCO0FBQUEsWUFBRSxNQUFNLFFBQVE7QUFBQSxRQUNyQixTQUFTLElBQUksQ0FBQyxFQUFHLE1BQU07QUFBQSxPQUN4QjtBQUFBO0FBQUEsSUFHSCxJQUFJLFFBQVEsU0FBUztBQUFBLElBR3JCLEdBQUcsZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQUssUUFBTTtBQUFBLE1BQ3pDLElBQUksTUFBTSxFQUNSLEdBQUcsS0FBSyxNQUFNLEVBQUUsRUFBRSxPQUFPLEdBQUcsRUFBRSxJQUM1QixDQUFDLE1BQUssUUFBTTtBQUFBLFFBRVYsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUNsQixNQUFPLFNBQVMsTUFBTSxFQUFDLEtBQUssSUFBRyxHQUFHLE1BQU0sRUFBRSxLQUFLLFFBQVEsTUFBTSxJQUFJLEVBQUMsS0FBSyxJQUFHLENBQUMsSUFBSSxFQUFDLGlCQUFpQixhQUFhLE9BQU8sTUFBTSxXQUFVLElBQUksQ0FBQyxDQUFDLEVBQzNJLE1BQU0sT0FBTyxRQUFRLE9BQU8sU0FBUyxNQUFNLEVBQUMsV0FBVyxhQUFhLE1BQU0sY0FBYyxJQUFJLENBQUMsQ0FBQztBQUFBLFFBQy9GLE1BQU0sS0FBSyxJQUFJLEVBQUU7QUFBQSxRQUNqQixTQUFTLElBQUksSUFBSSxJQUFJLEVBQUMsS0FBSyxFQUFDLEtBQUssSUFBRyxFQUFDLENBQUM7QUFBQSxRQUN0QyxPQUFPO0FBQUEsT0FFWCxDQUNGLEVBQUUsTUFBTSxFQUFDLFFBQVEsSUFBRyxDQUFDO0FBQUEsTUFDckIsU0FBUyxJQUFJLElBQUksSUFBSSxFQUFDLEtBQUksRUFBQyxLQUFLLEtBQUssS0FBSyxPQUFNLEVBQUMsQ0FBQztBQUFBLE1BQ2xELE9BQU87QUFBQSxLQUNSLENBQUM7QUFBQSxJQUVGLFFBQVE7QUFBQSxJQUVSLElBQUksS0FBSyxLQUFLLFNBQVMsTUFBTSxPQUFNO0FBQUEsTUFDakMsUUFBUSxLQUFJO0FBQUEsTUFDWixLQUFLLEtBQUssS0FBSTtBQUFBLE1BQ2QsU0FBUyxVQUFVO0FBQUEsTUFDbkIsUUFBUTtBQUFBLElBQ1Y7QUFBQTtBQUFBLEVBTUYsT0FBTyxpQkFBaUIsV0FBVyxPQUFHO0FBQUEsSUFDcEMsSUFBSSxZQUFZLENBQUMsUUFBVTtBQUFBLE1BQ3pCLElBQUksQ0FBQyxFQUFFO0FBQUEsUUFBVSxPQUFPLFlBQVk7QUFBQSxNQUMvQjtBQUFBLGVBQU8sWUFBWSxPQUFPLGFBQWEsRUFBQyxLQUFLLE9BQU8sS0FBSyxLQUFLLE9BQU8sSUFBRztBQUFBLE1BQzdFLE9BQU8sTUFBTSxJQUFJO0FBQUEsTUFDakIsT0FBTyxNQUFNLElBQUk7QUFBQTtBQUFBLElBR25CLElBQUksY0FBYyxNQUFNO0FBQUEsTUFDdEIsSUFBSSxRQUFRLFNBQVM7QUFBQSxNQUNyQixJQUFJLENBQUM7QUFBQSxRQUFPO0FBQUEsTUFDWixRQUFRLENBQUMsR0FBRyxNQUFNLE1BQU0sR0FBRyxNQUFNLEdBQUcsR0FBRyxHQUFHLE1BQU0sTUFBTSxHQUFHLEtBQUssVUFBVSxHQUFHLE1BQU0sR0FBRyxHQUFHLElBQUksTUFBTSxNQUFNLEdBQUcsS0FBSyxVQUFVLE1BQU0sR0FBRyxHQUFHLEdBQUcsR0FBRyxNQUFNLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDO0FBQUEsTUFDeEssVUFBVSxFQUFDLEtBQUssTUFBTSxHQUFHLEtBQUssS0FBSyxNQUFNLEdBQUcsSUFBRyxDQUFDO0FBQUE7QUFBQSxJQUdsRCxJQUFJLEVBQUUsSUFBSSxXQUFXLEdBQUU7QUFBQSxNQUNyQixJQUFJLEVBQUUsU0FBUTtBQUFBLFFBQ1osSUFBSSxFQUFFLE9BQU8sS0FBSTtBQUFBLFVBQ2YsSUFBSSxLQUFLLFNBQVMsR0FBRTtBQUFBLFlBQ2xCLEtBQUssSUFBSTtBQUFBLFlBQ1QsSUFBSSxPQUFPLEtBQUssS0FBSyxTQUFTO0FBQUEsWUFDOUIsS0FBSyxJQUFJO0FBQUEsWUFDVCxRQUFRLEtBQUssTUFBTTtBQUFBLENBQUk7QUFBQSxZQUN2QixVQUFVLEVBQUMsS0FBSSxHQUFHLEtBQUksRUFBQyxDQUFDO0FBQUEsVUFDMUI7QUFBQSxVQUNBLE9BQU87QUFBQSxRQUNUO0FBQUEsUUFDQSxJQUFJLEVBQUUsT0FBTyxLQUFJO0FBQUEsVUFDZixJQUFJLFFBQVEsU0FBUztBQUFBLFVBQ3JCLElBQUksT0FBTTtBQUFBLFlBQ1IsSUFBSSxPQUFPLE1BQU0sTUFBTSxNQUFNLEdBQUcsS0FBSyxNQUFNLEdBQUcsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sTUFBTTtBQUFBLGNBQ3RFLElBQUksS0FBSyxLQUFLLEtBQUssTUFBTSxHQUFHLE1BQU0sTUFBTSxHQUFHO0FBQUEsZ0JBQUssT0FBTyxLQUFLLFVBQVUsTUFBTSxHQUFHLEtBQUssTUFBTSxHQUFHLEdBQUc7QUFBQSxjQUMzRixTQUFJLEtBQUs7QUFBQSxnQkFBRyxPQUFPLEtBQUssVUFBVSxNQUFNLEdBQUcsR0FBRztBQUFBLGNBQzlDLFNBQUksS0FBSyxNQUFNLEdBQUcsTUFBTSxNQUFNLEdBQUc7QUFBQSxnQkFBSyxPQUFPLEtBQUssVUFBVSxHQUFHLE1BQU0sR0FBRyxHQUFHO0FBQUEsY0FDM0U7QUFBQSx1QkFBTztBQUFBLGFBQ2IsRUFBRSxLQUFLO0FBQUEsQ0FBSTtBQUFBLFlBQ1osVUFBVSxVQUFVLFVBQVUsSUFBSTtBQUFBLFVBQ3BDO0FBQUEsUUFDRjtBQUFBLFFBQ0EsSUFBSSxFQUFFLE9BQU8sS0FBSTtBQUFBLFVBQ2YsVUFBVSxVQUFVLFNBQVMsRUFBRSxLQUFLLFVBQVE7QUFBQSxZQUMxQyxJQUFJLFFBQVEsU0FBUztBQUFBLFlBQ3JCLFlBQVk7QUFBQSxZQUNaLElBQUksY0FBYyxLQUFLLE1BQU07QUFBQSxDQUFJO0FBQUEsWUFDakMsUUFBUSxDQUFDLEdBQUcsTUFBTSxNQUFNLEdBQUcsT0FBTyxHQUFHLEdBQUcsTUFBTSxPQUFPLEtBQUssVUFBVSxHQUFHLE9BQU8sR0FBRyxJQUFJLFlBQVksSUFBSSxHQUFHLFlBQVksTUFBTSxHQUFHLEVBQUUsR0FBRyxZQUFZLFNBQVMsSUFBSSxZQUFZLFlBQVksU0FBUyxLQUFLLE1BQU0sT0FBTyxLQUFLLFVBQVUsT0FBTyxHQUFHLElBQUksTUFBTSxPQUFPLEtBQUssVUFBVSxPQUFPLEdBQUcsR0FBRyxHQUFHLE1BQU0sTUFBTSxPQUFPLE1BQU0sQ0FBQyxDQUFDO0FBQUEsWUFDbFQsVUFBVSxFQUFDLEtBQUssT0FBTyxNQUFNLFlBQVksU0FBUyxHQUFHLEtBQU0sWUFBWSxTQUFTLElBQUksWUFBWSxZQUFZLFNBQVMsR0FBRyxTQUFTLE9BQU8sTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDO0FBQUEsV0FDdEs7QUFBQSxRQUNIO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLE1BQU0sT0FBTyxPQUFPLE1BQU0sT0FBTyxLQUFLLFVBQVUsR0FBRyxPQUFPLEdBQUcsSUFBSSxFQUFFLE1BQU0sTUFBTSxPQUFPLEtBQUssVUFBVSxPQUFPLEdBQUc7QUFBQSxNQUMvRyxVQUFVLEVBQUMsS0FBSyxPQUFPLEtBQUssS0FBSyxPQUFPLE1BQU0sRUFBQyxDQUFDO0FBQUEsTUFDaEQsT0FBTyxZQUFZO0FBQUEsSUFDckI7QUFBQSxJQUNBLElBQUksRUFBRSxRQUFRLGFBQVk7QUFBQSxNQUN4QixJQUFJLFFBQVEsU0FBUztBQUFBLE1BQ3JCLElBQUksT0FBTTtBQUFBLFFBQ1IsWUFBWTtBQUFBLE1BRWQsRUFDSyxTQUFJLEVBQUUsV0FBVyxPQUFPLE1BQU0sR0FBRTtBQUFBLFFBQ25DLFFBQVEsQ0FBQyxHQUFHLE1BQU0sTUFBTSxHQUFHLE9BQU8sR0FBRyxHQUFHLE1BQU0sT0FBTyxLQUFLLFVBQVcsT0FBTyxHQUFHLEdBQUcsR0FBRyxNQUFNLE1BQU0sT0FBTyxNQUFNLENBQUMsQ0FBQztBQUFBLFFBQ2hILE9BQU8sTUFBTTtBQUFBLE1BRWYsRUFBTSxTQUFJLE9BQU8sTUFBTSxHQUFFO0FBQUEsUUFDdkIsT0FBTztBQUFBLFFBQ1AsTUFBTSxPQUFPLE9BQU8sTUFBTSxPQUFPLEtBQUssVUFBVSxHQUFHLE9BQU8sR0FBRyxJQUFJLE1BQU0sT0FBTyxLQUFLLFVBQVUsT0FBTyxNQUFNLENBQUM7QUFBQSxNQUM3RyxFQUFNLFNBQUksT0FBTyxNQUFNLEdBQUU7QUFBQSxRQUN2QixPQUFPO0FBQUEsUUFDUCxPQUFPLE1BQU0sTUFBTSxPQUFPLEtBQUs7QUFBQSxRQUMvQixRQUFRLENBQUMsR0FBRyxNQUFNLE1BQU0sR0FBRyxPQUFPLEdBQUcsR0FBRyxNQUFNLE9BQU8sT0FBTyxNQUFNLE9BQU8sTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLE9BQU8sTUFBTSxDQUFDLENBQUM7QUFBQSxNQUNuSDtBQUFBLElBQ0Y7QUFBQSxJQUVBLElBQUksRUFBRSxRQUFRLGFBQVk7QUFBQSxNQUN4QixJQUFJLEVBQUUsU0FBUTtBQUFBLFFBQ1osSUFBSSxPQUFPLE1BQU07QUFBQSxVQUFHLFVBQVUsRUFBQyxLQUFLLE9BQU8sS0FBSyxLQUFLLEVBQUMsQ0FBQztBQUFBLFFBQ2xELFNBQUksT0FBTyxNQUFNO0FBQUEsVUFBRyxVQUFVLEVBQUMsS0FBSyxPQUFPLE1BQU0sR0FBRyxLQUFLLE1BQU0sT0FBTyxNQUFNLEdBQUcsT0FBTSxDQUFDO0FBQUEsTUFDN0YsRUFDSyxTQUFJLE9BQU8sTUFBTTtBQUFBLFFBQUcsVUFBVSxFQUFDLEtBQUssT0FBTyxLQUFLLEtBQUssT0FBTyxNQUFNLEVBQUMsQ0FBQztBQUFBLE1BQ3BFLFNBQUksT0FBTyxNQUFNO0FBQUEsUUFBRyxVQUFVLEVBQUMsS0FBSyxPQUFPLE1BQU0sR0FBRyxLQUFLLE1BQU0sT0FBTyxNQUFNLEdBQUcsT0FBTSxDQUFDO0FBQUEsSUFFN0Y7QUFBQSxJQUNBLElBQUksRUFBRSxRQUFRLGNBQWE7QUFBQSxNQUN6QixJQUFJLEVBQUUsU0FBUTtBQUFBLFFBQ1osSUFBSSxPQUFPLE1BQU0sTUFBTSxPQUFPLEtBQUs7QUFBQSxVQUFRLFVBQVUsRUFBQyxLQUFLLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxLQUFLLE9BQU0sQ0FBQztBQUFBLFFBQ2hHLFNBQUksT0FBTyxNQUFNLE1BQU0sU0FBUztBQUFBLFVBQUcsVUFBVSxFQUFDLEtBQUssT0FBTyxNQUFNLEdBQUcsS0FBSyxFQUFDLENBQUM7QUFBQSxNQUNqRixFQUNLLFNBQUksT0FBTyxNQUFNLE1BQU0sT0FBTyxLQUFLO0FBQUEsUUFBUSxVQUFVLEVBQUMsS0FBSyxPQUFPLEtBQUssS0FBSyxPQUFPLE1BQU0sRUFBQyxDQUFDO0FBQUEsTUFDM0YsU0FBSSxPQUFPLE1BQU0sTUFBTSxTQUFTO0FBQUEsUUFBRyxVQUFVLEVBQUMsS0FBSyxPQUFPLE1BQU0sR0FBRyxLQUFLLEVBQUMsQ0FBQztBQUFBLElBQ2pGO0FBQUEsSUFFQSxJQUFJLEVBQUUsUUFBUSxXQUFVO0FBQUEsTUFDdEIsSUFBSSxFQUFFO0FBQUEsUUFBUyxVQUFVLEVBQUMsS0FBSyxHQUFHLEtBQUssT0FBTyxJQUFHLENBQUM7QUFBQSxNQUM3QyxTQUFJLE9BQU8sTUFBTTtBQUFBLFFBQUcsVUFBVSxFQUFDLEtBQUssT0FBTyxNQUFNLEdBQUcsS0FBSyxPQUFPLElBQUcsQ0FBQztBQUFBLElBQzNFO0FBQUEsSUFDQSxJQUFJLEVBQUUsUUFBUSxhQUFZO0FBQUEsTUFDeEIsSUFBSSxFQUFFO0FBQUEsUUFBUyxVQUFVLEVBQUMsS0FBSyxNQUFNLFNBQVMsR0FBRyxLQUFLLE9BQU8sSUFBRyxDQUFDO0FBQUEsTUFDNUQsU0FBSSxPQUFPLE1BQU0sTUFBTSxTQUFTO0FBQUEsUUFBRyxVQUFVLEVBQUMsS0FBSyxPQUFPLE1BQU0sR0FBRyxLQUFLLE9BQU8sSUFBRyxDQUFDO0FBQUEsSUFDMUY7QUFBQSxJQUNBLElBQUksRUFBRSxRQUFRLFNBQVE7QUFBQSxNQUNwQixRQUFRO0FBQUEsUUFDTixHQUFHLE1BQU0sTUFBTSxHQUFHLE9BQU8sR0FBRztBQUFBLFFBQzVCLE1BQU0sT0FBTyxLQUFLLFVBQVUsR0FBRyxPQUFPLEdBQUc7QUFBQSxTQUN4QyxNQUFNLE9BQU8sS0FBSyxNQUFNLE1BQU0sSUFBSSxNQUFNLE1BQU0sTUFBTSxPQUFPLEtBQUssVUFBVSxPQUFPLEdBQUc7QUFBQSxRQUNyRixHQUFHLE1BQU0sTUFBTSxPQUFPLE1BQU0sQ0FBQztBQUFBLE1BQUM7QUFBQSxNQUNoQyxPQUFPO0FBQUEsTUFDUCxPQUFPLE1BQU0sTUFBTSxPQUFPLEtBQUssTUFBTSxNQUFNLElBQUksR0FBRyxVQUFVO0FBQUEsSUFDOUQ7QUFBQSxJQUdBLElBQUksRUFBRSxJQUFJLFdBQVcsT0FBTyxHQUFFO0FBQUEsTUFDNUIsRUFBRSxlQUFlO0FBQUEsSUFDbkI7QUFBQSxJQUVBLE9BQU87QUFBQSxHQUVSO0FBQUEsRUFHRCxJQUFJLFlBQVc7QUFBQSxFQUVmLE9BQU8saUJBQWlCLGFBQWEsT0FBRztBQUFBLElBQ3RDLElBQUksRUFBRSxTQUFTO0FBQUEsTUFDYixJQUFJLE1BQU0sU0FBUyxJQUFJLEVBQUUsTUFBcUIsR0FBRztBQUFBLE1BQ2pELElBQUk7QUFBQSxRQUFLLFFBQVEsR0FBRztBQUFBLE1BQ3BCO0FBQUEsSUFDRjtBQUFBLElBQ0EsWUFBWTtBQUFBLElBQ1osSUFBSSxTQUFTLElBQUksRUFBRSxNQUFxQixHQUFFO0FBQUEsTUFDeEMsU0FBUyxTQUFTLElBQUksRUFBRSxNQUFxQixFQUFHO0FBQUEsTUFDaEQsT0FBTztBQUFBLElBQ1Q7QUFBQSxHQUNEO0FBQUEsRUFFRCxPQUFPLGlCQUFpQixhQUFhLE9BQUc7QUFBQSxJQUN0QyxJQUFJLFdBQVc7QUFBQSxNQUNiLElBQUksU0FBUyxJQUFJLEVBQUUsTUFBcUIsR0FBRTtBQUFBLFFBQ3hDLElBQUksTUFBTSxTQUFTLElBQUksRUFBRSxNQUFxQixFQUFHO0FBQUEsUUFDakQsT0FBTyxZQUFZLE9BQU8sYUFBYSxFQUFDLEtBQUssT0FBTyxLQUFLLEtBQUssT0FBTyxJQUFHO0FBQUEsUUFDeEUsT0FBTyxNQUFNLElBQUk7QUFBQSxRQUNqQixPQUFPLE1BQU0sSUFBSTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxNQUNUO0FBQUEsSUFDRixFQUFLO0FBQUEsTUFDSCxJQUFJLE1BQU0sU0FBUyxJQUFJLEVBQUUsTUFBcUIsR0FBRztBQUFBLE1BQ2pELElBQUksS0FBSztBQUFBLFFBQ1AsS0FBSyxNQUFNLFdBQVUsVUFBVSxHQUFHO0FBQUEsUUFDbEMsSUFBSSxNQUFNO0FBQUEsVUFDUixJQUFJLFVBQVUsSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUUsTUFBSSxLQUFLLENBQUMsRUFBRSxNQUFNLEVBQUMsT0FBTyxRQUFRLFFBQU8sRUFBRSxFQUFDLENBQUMsQ0FBQyxDQUFDLEVBQ3pGLE1BQU07QUFBQSxZQUNMLFVBQVU7QUFBQSxZQUNWLE1BQU0sRUFBRSxVQUFVO0FBQUEsWUFDbEIsUUFBUyxPQUFPLGNBQWMsRUFBRSxVQUFVLEtBQU07QUFBQSxZQUNoRCxpQkFBaUIsTUFBTTtBQUFBLFlBQ3ZCLE9BQU8sTUFBTTtBQUFBLFlBQ2IsUUFBUSxlQUFlLE1BQU07QUFBQSxZQUM3QixTQUFTO0FBQUEsWUFDVCxjQUFjO0FBQUEsWUFDZCxlQUFlO0FBQUEsWUFDZixRQUFRO0FBQUEsWUFDUixZQUFZO0FBQUEsVUFDZCxDQUFDO0FBQUEsVUFDRCxTQUFTLEtBQUssWUFBWSxRQUFRLEVBQUU7QUFBQSxVQUNwQyxJQUFJLFNBQVMsTUFBTTtBQUFBLFlBQ2pCLFFBQVEsR0FBRyxPQUFPO0FBQUEsWUFDbEIsT0FBTyxvQkFBb0IsYUFBYSxJQUFJO0FBQUEsWUFDNUMsT0FBTyxvQkFBb0IsWUFBWSxHQUFHO0FBQUE7QUFBQSxVQUU1QyxJQUFJLE9BQU8sQ0FBQyxPQUFrQjtBQUFBLFlBQzlCLElBQUksR0FBRTtBQUFBLGNBQVMsT0FBTyxPQUFPO0FBQUEsWUFDM0IsUUFBUSxNQUFNO0FBQUEsY0FDWixNQUFNLEdBQUUsVUFBVTtBQUFBLGNBQ2xCLFFBQVMsT0FBTyxjQUFjLEdBQUUsVUFBVSxLQUFNO0FBQUEsWUFDbEQsQ0FBQztBQUFBO0FBQUEsVUFFSCxJQUFJLE1BQU0sQ0FBQyxPQUFrQjtBQUFBLFlBQzNCLElBQUksR0FBRSxrQkFBa0IsUUFBUTtBQUFBLGNBQUk7QUFBQSxZQUNwQyxPQUFPO0FBQUE7QUFBQSxVQUVULE9BQU8saUJBQWlCLGFBQWEsSUFBSTtBQUFBLFVBQ3pDLE9BQU8saUJBQWlCLFlBQVksR0FBRztBQUFBLFFBQ3pDO0FBQUEsTUFDRjtBQUFBO0FBQUEsR0FFSDtBQUFBLEVBRUQsT0FBTyxpQkFBaUIsV0FBVyxPQUFJO0FBQUEsSUFDckMsWUFBWTtBQUFBLEdBQ2I7QUFBQSxFQUdELE9BQU87QUFBQSxFQUNQLE9BQU87QUFBQSxJQUFDO0FBQUEsSUFDTixTQUFTLENBQUMsU0FBZ0I7QUFBQSxNQUN4QixRQUFRLEtBQUssTUFBTTtBQUFBLENBQUk7QUFBQSxNQUN2QixPQUFPO0FBQUE7QUFBQSxJQUVULFdBQVcsQ0FBQyxRQUFhO0FBQUEsTUFDdkIsUUFBUSxJQUFJLHFCQUFxQixHQUFHO0FBQUEsTUFDcEMsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBO0FBQUEsRUFFWDtBQUFBOzs7QUN4UkYsSUFBTSxlQUFlLENBQUMsTUFBVyxFQUFFLFFBQVEsRUFBRSxFQUFFLEtBQUssTUFBTSxTQUFTLEVBQUUsS0FBSyxRQUFRLFNBQVM7QUFDM0YsSUFBTSxlQUFlLENBQUMsTUFBbUIsYUFBYSxDQUFDLElBQUksSUFBSSxVQUFVLEVBQUUsSUFBSyxLQUFLLEVBQUUsUUFBUSxVQUFVLEVBQUUsUUFBUTtBQUU1RyxJQUFNLFlBQVksQ0FBQyxTQUFxQjtBQUFBLEVBQzdDLE1BQU0sYUFBYyxDQUFDLFFBQXNCLFFBQVEsT0FBUSxPQUN0RCxNQUFNLFFBQVEsR0FBRyxJQUFLLE9BQU8sV0FBVyxJQUFJLEVBQUUsSUFBSSxVQUFVLFdBQVcsSUFBSSxFQUFFLElBQzlFLElBQUksT0FBTyxRQUFRLE9BQU8sT0FBTyxXQUFXLElBQUksSUFBSTtBQUFBLEVBRXhELFFBQU8sS0FBSztBQUFBLFNBQ0w7QUFBQSxNQUFXLE9BQU8sS0FBSyxRQUFRLFNBQVM7QUFBQSxTQUN4QztBQUFBLE1BQVcsT0FBTyxLQUFLLFVBQVUsS0FBSyxPQUFPO0FBQUEsU0FDN0M7QUFBQSxNQUFPLE9BQU8sS0FBSyxRQUFRO0FBQUEsU0FDM0I7QUFBQSxNQUFPLE9BQU8sT0FBTyxhQUFhLEtBQUssUUFBUSxHQUFHLE9BQU8sVUFBVSxLQUFLLFFBQVEsS0FBSztBQUFBLEVBQVMsVUFBVSxLQUFLLFFBQVEsSUFBSTtBQUFBLFNBQ3pIO0FBQUEsTUFBWSxPQUFPLEdBQUcsS0FBSyxRQUFRLE1BQUssWUFBVyxXQUFXLEtBQUssUUFBUSxHQUFHLElBQUksUUFBUSxLQUFLLFFBQVEsS0FBSyxJQUFJLFlBQVksRUFBRSxLQUFLLEdBQUcsUUFBUSxVQUFVLEtBQUssUUFBUSxJQUFJO0FBQUEsU0FDeks7QUFBQSxNQUFPLE9BQU8sSUFBSSxVQUFVLEtBQUssUUFBUSxFQUFFLEtBQUssS0FBSyxRQUFRLEtBQUssSUFBSSxTQUFTLEVBQUUsS0FBSyxHQUFHO0FBQUEsU0FDekY7QUFBQSxNQUFVLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxFQUFFLEdBQUcsT0FBTyxHQUFHLEVBQUUsUUFBUSxTQUFTLFVBQVUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxJQUFJO0FBQUEsU0FDakc7QUFBQSxNQUFTLE9BQU8sV0FBVyxLQUFLLFFBQVE7QUFBQTtBQUFBO0FBS2pELElBQU0sVUFBVSxPQUFZLEVBQUMsUUFBUSxHQUFHLE1BQU0sR0FBRyxLQUFLLEVBQUM7QUFDdkQsSUFBTSxXQUFXLE9BQWEsRUFBQyxPQUFPLFFBQVEsR0FBRyxLQUFLLFFBQVEsRUFBQztBQUV4RCxJQUFNLFFBQVEsQ0FBc0IsS0FBUSxTQUFZLFFBQWEsU0FBUyxPQUFrQixFQUFDLEdBQUcsS0FBSyxTQUFTLFlBQUk7QUFnQjdILElBQU0sV0FBVyxDQUFDLFNBQW1FO0FBQUEsRUFDbkYsSUFBSSxTQUFrQixDQUFDO0FBQUEsRUFDdkIsSUFBSSxXQUFzQixDQUFDO0FBQUEsRUFDM0IsSUFBSSxJQUFJO0FBQUEsRUFDUixJQUFJLE9BQU87QUFBQSxFQUNYLElBQUksTUFBTTtBQUFBLEVBRVYsSUFBSSxVQUFVLENBQUMsU0FBaUIsWUFBWSxLQUFLLElBQUk7QUFBQSxFQUNyRCxJQUFJLFVBQVUsQ0FBQyxTQUFpQixRQUFRLEtBQUssSUFBSTtBQUFBLEVBQ2pELElBQUksVUFBVSxDQUFDLFNBQWlCLGVBQWUsS0FBSyxJQUFJO0FBQUEsRUFDeEQsSUFBSSxNQUFNLE9BQVksRUFBQyxRQUFRLEdBQUcsTUFBTSxJQUFHO0FBQUEsRUFDM0MsSUFBSSxVQUFVLE1BQU07QUFBQSxJQUNsQixJQUFJLEtBQUssT0FBTztBQUFBLEdBQU07QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBLE1BQU07QUFBQSxJQUNSLEVBQU87QUFBQSxNQUNMO0FBQUEsTUFDQTtBQUFBO0FBQUE7QUFBQSxFQUdKLElBQUksT0FBTyxDQUFDLE9BQW9CLFVBQWU7QUFBQSxJQUM3QyxPQUFPLEtBQUssS0FBSSxPQUFPLE1BQU0sRUFBQyxPQUFPLEtBQUssSUFBSSxFQUFDLEVBQUMsQ0FBVTtBQUFBO0FBQUEsRUFHNUQsT0FBTyxJQUFJLEtBQUssUUFBUTtBQUFBLElBQ3RCLElBQUksT0FBTyxLQUFLO0FBQUEsSUFFaEIsSUFBSSxLQUFLLEtBQUssSUFBSSxHQUFHO0FBQUEsTUFDbkIsUUFBUTtBQUFBLE1BQ1I7QUFBQSxJQUNGO0FBQUEsSUFFQSxJQUFJLFNBQVMsT0FBTyxLQUFLLElBQUksT0FBTyxLQUFLO0FBQUEsTUFDdkMsSUFBSSxTQUFRLElBQUk7QUFBQSxNQUNoQixRQUFRO0FBQUEsTUFDUixRQUFRO0FBQUEsTUFDUixPQUFPLElBQUksS0FBSyxVQUFVLEtBQUssT0FBTztBQUFBO0FBQUEsUUFBTSxRQUFRO0FBQUEsTUFDcEQsU0FBUyxLQUFLLE1BQU0sV0FBVyxLQUFLLE1BQU0sT0FBTSxRQUFRLENBQUMsR0FBRyxFQUFDLGVBQU8sS0FBSyxJQUFJLEVBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDaEY7QUFBQSxJQUNGO0FBQUEsSUFFQSxJQUFJLFNBQVMsT0FBTyxLQUFLLElBQUksT0FBTyxLQUFLO0FBQUEsTUFDdkMsSUFBSSxTQUFRLElBQUk7QUFBQSxNQUNoQixRQUFRO0FBQUEsTUFDUixRQUFRO0FBQUEsTUFDUixLQUFLLEVBQUMsTUFBTSxRQUFPLEdBQUcsTUFBSztBQUFBLE1BQzNCO0FBQUEsSUFDRjtBQUFBLElBRUEsSUFBSSxVQUFVLFNBQVMsSUFBSSxHQUFHO0FBQUEsTUFDNUIsSUFBSSxTQUFRLElBQUk7QUFBQSxNQUNoQixJQUFJLFFBQVE7QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLEtBQUssRUFBQyxNQUFNLFVBQVUsTUFBSyxHQUFHLE1BQUs7QUFBQSxNQUNuQztBQUFBLElBQ0Y7QUFBQSxJQUVBLElBQUksU0FBUyxLQUFLO0FBQUEsTUFDaEIsSUFBSSxTQUFRLElBQUk7QUFBQSxNQUNoQixRQUFRO0FBQUEsTUFDUixJQUFJLFFBQVE7QUFBQSxNQUNaLE9BQU8sSUFBSSxLQUFLLFFBQVE7QUFBQSxRQUN0QixJQUFJLFVBQVUsS0FBSztBQUFBLFFBQ25CLElBQUksWUFBWSxNQUFNO0FBQUEsVUFDcEIsSUFBSSxPQUFPLEtBQUssSUFBSTtBQUFBLFVBQ3BCLElBQUksU0FBUyxXQUFXO0FBQUEsWUFDdEIsUUFBUTtBQUFBLFlBQ1IsS0FBSyxFQUFDLE1BQU0sU0FBUyxTQUFTLDhCQUE4QixTQUFTLEtBQUssTUFBTSxPQUFNLFFBQVEsQ0FBQyxFQUFDLEdBQUcsTUFBSztBQUFBLFlBQ3hHLE9BQU8sRUFBQyxRQUFRLFVBQVUsS0FBSyxJQUFJLEVBQUM7QUFBQSxVQUN0QztBQUFBLFVBQ0EsSUFBSSxVQUFXLEVBQUMsR0FBRztBQUFBLEdBQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxLQUFLLEtBQUssTUFBTSxLQUFJLEVBQTZCO0FBQUEsVUFDNUYsU0FBUyxXQUFXO0FBQUEsVUFDcEIsUUFBUTtBQUFBLFVBQ1IsUUFBUTtBQUFBLFVBQ1I7QUFBQSxRQUNGO0FBQUEsUUFDQSxJQUFJLFlBQVk7QUFBQSxVQUFLO0FBQUEsUUFDckIsU0FBUztBQUFBLFFBQ1QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLElBQUksS0FBSyxPQUFPLEtBQUs7QUFBQSxRQUNuQixLQUFLLEVBQUMsTUFBTSxTQUFTLFNBQVMsK0JBQStCLFNBQVMsS0FBSyxNQUFNLE9BQU0sUUFBUSxDQUFDLEVBQUMsR0FBRyxNQUFLO0FBQUEsUUFDekcsT0FBTyxFQUFDLFFBQVEsVUFBVSxLQUFLLElBQUksRUFBQztBQUFBLE1BQ3RDO0FBQUEsTUFDQSxRQUFRO0FBQUEsTUFDUixLQUFLLEVBQUMsTUFBTSxVQUFVLE1BQUssR0FBRyxNQUFLO0FBQUEsTUFDbkM7QUFBQSxJQUNGO0FBQUEsSUFFQSxJQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsTUFDakIsSUFBSSxTQUFRLElBQUk7QUFBQSxNQUNoQixJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPLElBQUksS0FBSyxVQUFVLFFBQVEsS0FBSyxFQUFFO0FBQUEsUUFBRyxRQUFRO0FBQUEsTUFDcEQsS0FBSyxFQUFDLE1BQU0sVUFBVSxPQUFPLE9BQU8sS0FBSyxNQUFNLFlBQVksQ0FBQyxDQUFDLEVBQUMsR0FBRyxNQUFLO0FBQUEsTUFDdEU7QUFBQSxJQUNGO0FBQUEsSUFFQSxJQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsTUFDakIsSUFBSSxTQUFRLElBQUk7QUFBQSxNQUNoQixJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPLElBQUksS0FBSyxVQUFVLFFBQVEsS0FBSyxFQUFFO0FBQUEsUUFBRyxRQUFRO0FBQUEsTUFDcEQsSUFBSSxRQUFRLEtBQUssTUFBTSxZQUFZLENBQUM7QUFBQSxNQUNwQyxJQUFJLFVBQVUsU0FBUyxVQUFVLFFBQVEsVUFBVTtBQUFBLFFBQU0sS0FBSyxFQUFDLE1BQU0sV0FBVyxNQUFLLEdBQUcsTUFBSztBQUFBLE1BQ3hGO0FBQUEsYUFBSyxFQUFDLE1BQU0sU0FBUyxNQUFLLEdBQUcsTUFBSztBQUFBLE1BQ3ZDO0FBQUEsSUFDRjtBQUFBLElBRUEsSUFBSSxRQUFRLElBQUk7QUFBQSxJQUNoQixRQUFRO0FBQUEsSUFDUixLQUFLLEVBQUMsTUFBTSxTQUFTLFNBQVMseUJBQXlCLFFBQVEsU0FBUyxLQUFJLEdBQUcsS0FBSztBQUFBLEVBQ3RGO0FBQUEsRUFFQSxPQUFPLEVBQUMsUUFBUSxVQUFVLEtBQUssSUFBSSxFQUFDO0FBQUE7QUFBQTtBQUd0QyxNQUFNLE9BQU87QUFBQSxFQUdTO0FBQUEsRUFBeUI7QUFBQSxFQUF3QjtBQUFBLEVBRjdELElBQUk7QUFBQSxFQUVaLFdBQVcsQ0FBUyxRQUF5QixRQUF3QixLQUFVO0FBQUEsSUFBM0Q7QUFBQSxJQUF5QjtBQUFBLElBQXdCO0FBQUE7QUFBQSxFQUVyRSxLQUFLLEdBQVE7QUFBQSxJQUNYLElBQUksTUFBTSxLQUFLLFVBQVU7QUFBQSxJQUN6QixJQUFJLEtBQUssS0FBSyxHQUFHO0FBQUEsTUFDZixJQUFJLFFBQVEsS0FBSyxLQUFLLEVBQUcsS0FBSztBQUFBLE1BQzlCLElBQUksTUFBTSxLQUFLLE9BQU8sS0FBSyxPQUFPLFNBQVMsSUFBSSxLQUFLLE9BQU87QUFBQSxNQUMzRCxPQUFPLEtBQUssVUFBVSwyQ0FBMkMsRUFBQyxPQUFPLElBQUcsR0FBRyxLQUFLLE9BQU8sTUFBTSxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUM7QUFBQSxJQUM1SDtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUEsRUFHRCxTQUFTLEdBQVE7QUFBQSxJQUN2QixJQUFJLEtBQUssVUFBVSxLQUFLO0FBQUEsTUFBRyxPQUFPLEtBQUssU0FBUztBQUFBLElBQ2hELElBQUksS0FBSyxVQUFVLElBQUk7QUFBQSxNQUFHLE9BQU8sS0FBSyxjQUFjO0FBQUEsSUFDcEQsT0FBTyxLQUFLLFVBQVU7QUFBQTtBQUFBLEVBR2hCLFFBQVEsR0FBUTtBQUFBLElBQ3RCLElBQUksUUFBUSxLQUFLLGNBQWMsS0FBSyxFQUFFLEtBQUs7QUFBQSxJQUMzQyxJQUFJLFdBQVcsS0FBSyxlQUFlO0FBQUEsSUFDbkMsSUFBSSxTQUFTLE1BQU07QUFBQSxNQUFTLE9BQU87QUFBQSxJQUVuQyxJQUFJO0FBQUEsSUFDSixJQUFJLEtBQUssU0FBUyxHQUFHLEdBQUc7QUFBQSxNQUN0QixLQUFLLGFBQWEsR0FBRztBQUFBLE1BQ3JCLFFBQVEsS0FBSyxVQUFVO0FBQUEsSUFDekIsRUFBTztBQUFBLE1BQ0wsUUFBUSxLQUFLLEtBQUssSUFBSSxLQUFLLFVBQVUsdUNBQXVDLEtBQUssVUFBVSxDQUFDLElBQUksS0FBSyxVQUFVLHFDQUFxQztBQUFBO0FBQUEsSUFHdEosSUFBSTtBQUFBLElBQ0osSUFBSSxLQUFLLFVBQVUsSUFBSSxHQUFHO0FBQUEsTUFDeEIsS0FBSyxjQUFjLElBQUk7QUFBQSxNQUN2QixRQUFPLEtBQUssVUFBVTtBQUFBLElBQ3hCLEVBQU87QUFBQSxNQUNMLFFBQU8sS0FBSyxLQUFLLElBQUksS0FBSyxVQUFVLHlDQUF5QyxLQUFLLFVBQVUsQ0FBQyxJQUFJLEtBQUssVUFBVSx1Q0FBdUM7QUFBQTtBQUFBLElBR3pKLE9BQU8sTUFBTSxPQUFPLEVBQUMsS0FBSyxVQUFVLE9BQU8sWUFBSSxHQUFHLEVBQUMsT0FBTyxLQUFLLE1BQUssS0FBSyxJQUFHLENBQUM7QUFBQTtBQUFBLEVBR3ZFLGFBQWEsR0FBUTtBQUFBLElBQzNCLElBQUksUUFBUSxLQUFLLGNBQWMsSUFBSSxFQUFFLEtBQUs7QUFBQSxJQUMxQyxJQUFJLE9BQWMsQ0FBQztBQUFBLElBQ25CLE9BQU8sS0FBSyxLQUFLLEdBQUcsU0FBUyxXQUFXLEtBQUssU0FBUyxHQUFHLEdBQUc7QUFBQSxNQUMxRCxJQUFJLFNBQVMsS0FBSyxZQUFZO0FBQUEsTUFDOUIsSUFBSSxPQUFPLE1BQU07QUFBQSxRQUFTLE9BQU8sTUFBTSxZQUFZLEVBQUMsTUFBTSxNQUFNLE9BQU0sR0FBRyxFQUFDLE9BQU8sS0FBSyxPQUFPLEtBQUssSUFBRyxDQUFDO0FBQUEsTUFDdEcsS0FBSyxLQUFLLE1BQU07QUFBQSxJQUNsQjtBQUFBLElBQ0EsSUFBSTtBQUFBLElBQ0osSUFBSSxLQUFLLFdBQVcsR0FBRztBQUFBLE1BQ3JCLElBQUksS0FBSyxXQUFXLE9BQU87QUFBQSxRQUFHLFFBQU8sS0FBSyxVQUFVLDRDQUE0QyxLQUFLLFVBQVUsQ0FBQztBQUFBLE1BQzNHO0FBQUEsZ0JBQU8sS0FBSyxLQUFLLElBQUksS0FBSyxVQUFVLDRDQUE0QyxLQUFLLFVBQVUsQ0FBQyxJQUFJLEtBQUssVUFBVSw0Q0FBNEMsS0FBSztBQUFBLElBQzNLLEVBQU8sU0FBSSxDQUFDLEtBQUssV0FBVyxPQUFPLEdBQUc7QUFBQSxNQUNwQyxRQUFPLEtBQUssS0FBSyxJQUFJLEtBQUssVUFBVSwyQ0FBMkMsS0FBSyxVQUFVLENBQUMsSUFBSSxLQUFLLFVBQVUseUNBQXlDO0FBQUEsSUFDN0osRUFBTztBQUFBLE1BQ0wsUUFBTyxLQUFLLFVBQVU7QUFBQTtBQUFBLElBRXhCLE9BQU8sTUFBTSxZQUFZLEVBQUMsTUFBTSxZQUFJLEdBQUcsRUFBQyxPQUFPLEtBQUssTUFBSyxLQUFLLElBQUcsQ0FBQztBQUFBO0FBQUEsRUFHNUQsU0FBUyxHQUFRO0FBQUEsSUFDdkIsSUFBSSxRQUFRLEtBQUssS0FBSztBQUFBLElBQ3RCLElBQUksQ0FBQztBQUFBLE1BQU8sT0FBTyxLQUFLLFVBQVUseUJBQXlCO0FBQUEsSUFFM0QsSUFBSSxNQUFNLFNBQVMsU0FBUztBQUFBLE1BQzFCLEtBQUs7QUFBQSxNQUNMLE9BQU8sTUFBTSxPQUFPLEVBQUMsTUFBTSxNQUFNLE1BQUssR0FBRyxNQUFNLElBQUk7QUFBQSxJQUNyRDtBQUFBLElBR0EsSUFBSSxNQUFNLFNBQVMsVUFBVTtBQUFBLE1BQzNCLEtBQUs7QUFBQSxNQUNMLE9BQU8sTUFBTSxVQUFVLE1BQU0sT0FBTyxNQUFNLElBQUk7QUFBQSxJQUNoRDtBQUFBLElBRUEsSUFBSSxNQUFNLFNBQVMsVUFBVTtBQUFBLE1BQzNCLEtBQUs7QUFBQSxNQUNMLE9BQU8sTUFBTSxVQUFVLE1BQU0sT0FBTyxNQUFNLElBQUk7QUFBQSxJQUNoRDtBQUFBLElBQ0EsSUFBSSxNQUFNLFNBQVMsU0FBUztBQUFBLE1BQzFCLEtBQUs7QUFBQSxNQUNMLE9BQU8sTUFBTSxTQUFTLEVBQUMsU0FBUyxNQUFNLFNBQVMsU0FBUyxNQUFNLFFBQU8sR0FBRyxNQUFNLElBQUk7QUFBQSxJQUNwRjtBQUFBLElBRUEsSUFBSSxLQUFLLFNBQVMsR0FBRztBQUFBLE1BQUcsT0FBTyxLQUFLLFlBQVk7QUFBQSxJQUNoRCxJQUFJLEtBQUssU0FBUyxHQUFHO0FBQUEsTUFBRyxPQUFPLEtBQUssWUFBWTtBQUFBLElBRWhELEtBQUs7QUFBQSxJQUNMLE9BQU8sS0FBSyxVQUFVLHFCQUFxQixLQUFLLFNBQVMsS0FBSyxLQUFLLE1BQU0sSUFBSTtBQUFBO0FBQUEsRUFHdkUsV0FBVyxHQUFRO0FBQUEsSUFDekIsSUFBSSxPQUFPLEtBQUssYUFBYSxHQUFHO0FBQUEsSUFDaEMsSUFBSSxRQUFlLENBQUM7QUFBQSxJQUNwQixPQUFPLENBQUMsS0FBSyxTQUFTLEdBQUcsR0FBRztBQUFBLE1BQzFCLElBQUksQ0FBQyxLQUFLLEtBQUssR0FBRztBQUFBLFFBQ2hCLElBQUksTUFBTSxNQUFNLFNBQVMsSUFBSSxNQUFNLE1BQU0sU0FBUyxHQUFHLEtBQUssTUFBTSxLQUFLLEtBQUs7QUFBQSxRQUMxRSxPQUFPLEtBQUssVUFBVSx5Q0FBeUMsRUFBQyxPQUFPLEtBQUssS0FBSyxPQUFPLElBQUcsR0FBRyxLQUFLLE9BQU8sTUFBTSxLQUFLLEtBQUssTUFBTSxRQUFRLElBQUksTUFBTSxDQUFDO0FBQUEsTUFDcko7QUFBQSxNQUNBLE1BQU0sS0FBSyxLQUFLLFVBQVUsQ0FBQztBQUFBLElBQzdCO0FBQUEsSUFDQSxJQUFJLFFBQVEsS0FBSyxhQUFhLEdBQUc7QUFBQSxJQUNqQyxJQUFJLE1BQU0sV0FBVztBQUFBLE1BQUcsT0FBTyxLQUFLLFVBQVUscUNBQXFDLEVBQUMsT0FBTyxLQUFLLEtBQUssT0FBTyxLQUFLLE1BQU0sS0FBSyxJQUFHLEdBQUcsS0FBSyxPQUFPLE1BQU0sS0FBSyxLQUFLLE1BQU0sUUFBUSxNQUFNLEtBQUssSUFBSSxNQUFNLENBQUM7QUFBQSxJQUNsTSxJQUFJLE1BQU0sV0FBVztBQUFBLE1BQUcsT0FBTyxNQUFNO0FBQUEsSUFDckMsT0FBTyxNQUFNLE9BQU8sRUFBQyxJQUFJLE1BQU0sSUFBSSxNQUFNLE1BQU0sTUFBTSxDQUFDLEVBQUMsR0FBRyxFQUFDLE9BQU8sS0FBSyxLQUFLLE9BQU8sS0FBSyxNQUFNLEtBQUssSUFBRyxDQUFDO0FBQUE7QUFBQSxFQUdqRyxXQUFXLEdBQVE7QUFBQSxJQUN6QixJQUFJLE9BQU8sS0FBSyxhQUFhLEdBQUc7QUFBQSxJQUNoQyxJQUFJLFNBQXVCLENBQUM7QUFBQSxJQUU1QixPQUFPLENBQUMsS0FBSyxTQUFTLEdBQUcsR0FBRztBQUFBLE1BQzFCLElBQUksQ0FBQyxLQUFLLEtBQUssR0FBRztBQUFBLFFBQ2hCLElBQUksTUFBTSxPQUFPLFNBQVMsSUFBSSxPQUFPLE9BQU8sU0FBUyxHQUFHLEdBQUcsS0FBSyxNQUFNLEtBQUssS0FBSztBQUFBLFFBQ2hGLE9BQU8sS0FBSyxVQUFVLHVCQUF1QixFQUFDLE9BQU8sS0FBSyxLQUFLLE9BQU8sSUFBRyxHQUFHLEtBQUssT0FBTyxNQUFNLEtBQUssS0FBSyxNQUFNLFFBQVEsSUFBSSxNQUFNLENBQUM7QUFBQSxNQUNuSTtBQUFBLE1BQ0EsSUFBSSxPQUFPLEtBQUssV0FBVyxPQUFPO0FBQUEsTUFDbEMsSUFBSSxDQUFDLE1BQU07QUFBQSxRQUNULElBQUksUUFBUSxLQUFLLEtBQUs7QUFBQSxRQUN0QixLQUFLO0FBQUEsUUFDTCxPQUFPLEtBQUssVUFBVSxtQ0FBbUMsS0FBSyxTQUFTLEtBQUssS0FBSyxFQUFDLE9BQU8sS0FBSyxLQUFLLE9BQU8sS0FBSyxNQUFNLEtBQUssSUFBRyxHQUFHLEtBQUssT0FBTyxNQUFNLEtBQUssS0FBSyxNQUFNLFFBQVEsTUFBTSxLQUFLLElBQUksTUFBTSxDQUFDO0FBQUEsTUFDbE07QUFBQSxNQUNBLElBQUksTUFBTSxNQUFNLE9BQU8sRUFBQyxNQUFNLEtBQUssTUFBSyxHQUFHLEtBQUssSUFBSTtBQUFBLE1BQ3BELElBQUksUUFBUSxLQUFLLFNBQVMsR0FBRyxLQUN4QixLQUFLLGFBQWEsR0FBRyxHQUFHLEtBQUssU0FBUyxHQUFHLElBQUksS0FBSyxVQUFVLHVDQUF1QyxJQUFJLEtBQUssVUFBVSxLQUN2SDtBQUFBLE1BQ0osT0FBTyxLQUFLLENBQUMsS0FBSyxLQUFLLENBQUM7QUFBQSxNQUN4QixJQUFJLEtBQUssU0FBUyxHQUFHO0FBQUEsUUFBRyxLQUFLO0FBQUEsTUFDeEI7QUFBQTtBQUFBLElBQ1A7QUFBQSxJQUVBLElBQUksQ0FBQyxLQUFLLFNBQVMsR0FBRyxHQUFHO0FBQUEsTUFDdkIsSUFBSSxNQUFNLE9BQU8sU0FBUyxJQUFJLE9BQU8sT0FBTyxTQUFTLEdBQUcsR0FBRyxLQUFLLE1BQU0sS0FBSyxLQUFLO0FBQUEsTUFDaEYsT0FBTyxLQUFLLFVBQVUsdUJBQXVCLEVBQUMsT0FBTyxLQUFLLEtBQUssT0FBTyxJQUFHLEdBQUcsS0FBSyxPQUFPLE1BQU0sS0FBSyxLQUFLLE1BQU0sUUFBUSxJQUFJLE1BQU0sQ0FBQztBQUFBLElBQ25JO0FBQUEsSUFDQSxJQUFJLFFBQVEsS0FBSyxhQUFhLEdBQUc7QUFBQSxJQUNqQyxPQUFPLE1BQU0sVUFBVSxRQUFRLEVBQUMsT0FBTyxLQUFLLEtBQUssT0FBTyxLQUFLLE1BQU0sS0FBSyxJQUFHLENBQUM7QUFBQTtBQUFBLEVBR3RFLFdBQVcsR0FBMkQ7QUFBQSxJQUM1RSxJQUFJLEtBQUssU0FBUyxHQUFHLEdBQUc7QUFBQSxNQUN0QixLQUFLLGFBQWEsR0FBRztBQUFBLE1BQ3JCLElBQUksZUFBZSxLQUFLLFVBQVU7QUFBQSxNQUNsQyxJQUFJLFFBQU8sS0FBSyxXQUFXLE9BQU87QUFBQSxNQUNsQyxJQUFJLENBQUM7QUFBQSxRQUFNLE9BQU8sS0FBSyxVQUFVLHVDQUF1QztBQUFBLE1BQ3hFLElBQUksQ0FBQyxLQUFLLFNBQVMsR0FBRztBQUFBLFFBQUcsT0FBTyxLQUFLLFVBQVUsbUNBQW1DO0FBQUEsTUFDbEYsS0FBSyxhQUFhLEdBQUc7QUFBQSxNQUNyQixJQUFJLGFBQWEsTUFBTTtBQUFBLFFBQVMsT0FBTztBQUFBLE1BQ3ZDLElBQUksWUFBVyxNQUFNLE9BQU8sRUFBQyxNQUFNLE1BQUssTUFBSyxHQUFHLE1BQUssSUFBSTtBQUFBLE1BQ3pELFVBQVMsT0FBTztBQUFBLE1BQ2hCLE9BQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxJQUFJLE9BQU8sS0FBSyxXQUFXLE9BQU87QUFBQSxJQUNsQyxJQUFJLENBQUM7QUFBQSxNQUFNLE9BQU8sS0FBSyxVQUFVLHFCQUFxQjtBQUFBLElBQ3RELElBQUksV0FBVyxNQUFNLE9BQU8sRUFBQyxNQUFNLEtBQUssTUFBSyxHQUFHLEtBQUssSUFBSTtBQUFBLElBQ3pELElBQUksS0FBSyxTQUFTLEdBQUcsR0FBRztBQUFBLE1BQ3RCLEtBQUssYUFBYSxHQUFHO0FBQUEsTUFDckIsSUFBSSxlQUFlLEtBQUssVUFBVTtBQUFBLE1BQ2xDLElBQUksYUFBYSxNQUFNO0FBQUEsUUFBUyxPQUFPO0FBQUEsTUFDdkMsU0FBUyxPQUFPO0FBQUEsSUFDbEI7QUFBQSxJQUNBLE9BQU87QUFBQTtBQUFBLEVBR0QsY0FBYyxHQUEyRDtBQUFBLElBQy9FLE9BQU8sS0FBSyxZQUFZO0FBQUE7QUFBQSxFQUdsQixJQUFJLEdBQXNCO0FBQUEsSUFDaEMsT0FBTyxLQUFLLE9BQU8sS0FBSztBQUFBO0FBQUEsRUFHbEIsU0FBUyxDQUFDLE9BQXFDO0FBQUEsSUFDckQsSUFBSSxRQUFRLEtBQUssS0FBSztBQUFBLElBQ3RCLE9BQU8sT0FBTyxTQUFTLGFBQWEsTUFBTSxVQUFVO0FBQUE7QUFBQSxFQUc5QyxRQUFRLENBQUMsT0FBeUQ7QUFBQSxJQUN4RSxJQUFJLFFBQVEsS0FBSyxLQUFLO0FBQUEsSUFDdEIsT0FBTyxPQUFPLFNBQVMsWUFBWSxNQUFNLFVBQVU7QUFBQTtBQUFBLEVBRzdDLFdBQW9DLENBQUMsTUFBb0M7QUFBQSxJQUMvRSxJQUFJLFFBQVEsS0FBSyxLQUFLO0FBQUEsSUFDdEIsSUFBSSxDQUFDLFNBQVMsTUFBTSxTQUFTO0FBQUEsTUFBTSxNQUFNLElBQUksTUFBTSxZQUFZLGFBQWEsS0FBSyxTQUFTLEtBQUssR0FBRztBQUFBLElBQ2xHLEtBQUs7QUFBQSxJQUNMLE9BQU87QUFBQTtBQUFBLEVBR0QsVUFBbUMsQ0FBQyxNQUFnRDtBQUFBLElBQzFGLElBQUksUUFBUSxLQUFLLEtBQUs7QUFBQSxJQUN0QixJQUFJLENBQUMsU0FBUyxNQUFNLFNBQVM7QUFBQSxNQUFNO0FBQUEsSUFDbkMsS0FBSztBQUFBLElBQ0wsT0FBTztBQUFBO0FBQUEsRUFHRCxhQUFhLENBQUMsT0FBNEI7QUFBQSxJQUNoRCxJQUFJLFFBQVEsS0FBSyxLQUFLO0FBQUEsSUFDdEIsSUFBSSxPQUFPLFNBQVMsYUFBYSxNQUFNLFVBQVU7QUFBQSxNQUFPLE1BQU0sSUFBSSxNQUFNLG9CQUFvQixjQUFjLEtBQUssU0FBUyxLQUFLLEdBQUc7QUFBQSxJQUNoSSxLQUFLO0FBQUEsSUFDTCxPQUFPO0FBQUE7QUFBQSxFQUdELFlBQVksQ0FBQyxPQUFnRDtBQUFBLElBQ25FLElBQUksUUFBUSxLQUFLLEtBQUs7QUFBQSxJQUN0QixJQUFJLE9BQU8sU0FBUyxZQUFZLE1BQU0sVUFBVTtBQUFBLE1BQU8sTUFBTSxJQUFJLE1BQU0sYUFBYSxlQUFlLEtBQUssU0FBUyxLQUFLLEdBQUc7QUFBQSxJQUN6SCxLQUFLO0FBQUEsSUFDTCxPQUFPO0FBQUE7QUFBQSxFQUdELFFBQVEsQ0FBQyxPQUFrQztBQUFBLElBQ2pELElBQUksQ0FBQztBQUFBLE1BQU8sT0FBTztBQUFBLElBQ25CLElBQUksV0FBVztBQUFBLE1BQU8sT0FBTyxHQUFHLE1BQU0sUUFBUSxPQUFPLE1BQU0sS0FBSztBQUFBLElBQ2hFLElBQUksTUFBTSxTQUFTO0FBQUEsTUFBUyxPQUFPLFNBQVMsTUFBTTtBQUFBLElBQ2xELE9BQU8sTUFBTTtBQUFBO0FBQUEsRUFHUCxTQUFTLENBQUMsU0FBaUIsT0FBYSxTQUE2QjtBQUFBLElBQzNFLElBQUksWUFBWSxTQUFRLEtBQUssVUFBVTtBQUFBLElBQ3ZDLE9BQU8sTUFBTSxTQUFTLEVBQUMsU0FBUyxTQUFTLFdBQVcsS0FBSyxPQUFPLE1BQU0sVUFBVSxNQUFNLFFBQVEsVUFBVSxJQUFJLE1BQU0sRUFBQyxHQUFHLFNBQVM7QUFBQTtBQUFBLEVBR3pILFNBQVMsQ0FBQyxTQUFpQixPQUF1QjtBQUFBLElBQ3hELElBQUksUUFBTyxLQUFLLEtBQUssR0FBRyxRQUFRLEVBQUMsT0FBTyxLQUFLLEtBQUssS0FBSyxLQUFLLElBQUc7QUFBQSxJQUMvRCxPQUFPLEtBQUssVUFBVSxTQUFTLEVBQUMsT0FBTyxTQUFTLE1BQUssT0FBTyxLQUFLLE1BQUssSUFBRyxDQUFDO0FBQUE7QUFBQSxFQUdwRSxTQUFTLENBQUMsU0FBaUIsTUFBZ0I7QUFBQSxJQUNqRCxPQUFPLEtBQUssVUFBVSxTQUFTLEtBQUssTUFBTSxLQUFLLE9BQU8sTUFBTSxLQUFLLEtBQUssTUFBTSxRQUFRLEtBQUssS0FBSyxJQUFJLE1BQU0sQ0FBQztBQUFBO0FBQUEsRUFHbkcsU0FBUyxHQUFTO0FBQUEsSUFDeEIsSUFBSSxRQUFRLEtBQUssS0FBSztBQUFBLElBQ3RCLElBQUk7QUFBQSxNQUFPLE9BQU8sTUFBTTtBQUFBLElBQ3hCLE9BQU8sRUFBQyxPQUFPLEtBQUssS0FBSyxLQUFLLEtBQUssSUFBRztBQUFBO0FBRTFDO0FBRU8sSUFBTSxjQUFjLENBQUMsS0FBVSxXQUFzQixDQUFDLE1BQWtDO0FBQUEsRUFDN0YsSUFBSSxTQUFTLFNBQVMsT0FBTyxDQUFDLEdBQUcsTUFBTSxFQUFFLEtBQUssSUFBSSxTQUFTLElBQUksRUFBRSxLQUFLLElBQUksU0FBUyxHQUFHLElBQUksS0FBSyxJQUFJLE1BQU07QUFBQSxFQUN6RyxJQUFJLE1BQWtDLE1BQU0sS0FBSyxFQUFDLFFBQVEsT0FBTSxHQUFHLE1BQUU7QUFBQSxJQUFFO0FBQUEsR0FBUztBQUFBLEVBQ2hGLE1BQU0sT0FBTyxDQUFDLFNBQWM7QUFBQSxJQUMxQixTQUFTLElBQUksS0FBSyxLQUFLLE1BQU0sT0FBUSxJQUFJLEtBQUssS0FBSyxJQUFJLFFBQVE7QUFBQSxNQUFLLElBQUksS0FBSztBQUFBLElBQzdFLFNBQVMsSUFBSSxFQUFFLFFBQVEsSUFBSTtBQUFBO0FBQUEsRUFFN0IsS0FBSyxHQUFHO0FBQUEsRUFDUixTQUFTLFFBQVEsYUFBVztBQUFBLElBQzFCLFNBQVMsSUFBSSxRQUFRLEtBQUssTUFBTSxPQUFRLElBQUksUUFBUSxLQUFLLElBQUksUUFBUTtBQUFBLE1BQUssSUFBSSxLQUFLO0FBQUEsR0FDcEY7QUFBQSxFQUNELE9BQU87QUFBQTtBQUdGLElBQU0sUUFBUSxDQUFDLFNBQTZCO0FBQUEsRUFDakQsTUFBSyxRQUFRLFVBQVUsUUFBTyxTQUFTLElBQUk7QUFBQSxFQUMzQyxJQUFJLE1BQU0sSUFBSSxPQUFPLFFBQVEsTUFBTSxHQUFHLEVBQUUsTUFBTTtBQUFBLEVBQzlDLE9BQU8sRUFBQyxLQUFLLFVBQVUsUUFBUSxZQUFZLEtBQUssUUFBUSxFQUFDO0FBQUE7QUFHcEQsSUFBTSxXQUFXLENBQUMsU0FBcUIsTUFBTSxJQUFJLEVBQUU7QUFFbkQsSUFBTSxXQUFXLENBQUMsU0FBcUI7QUFBQSxFQUM1QyxJQUFJLEtBQUssTUFBTTtBQUFBLElBQVksT0FBTyxDQUFDLEdBQUcsS0FBSyxRQUFRLE1BQU0sS0FBSyxRQUFRLElBQUk7QUFBQSxFQUMxRSxJQUFJLEtBQUssTUFBTTtBQUFBLElBQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLEdBQUcsS0FBSyxRQUFRLElBQUk7QUFBQSxFQUNuRSxJQUFJLEtBQUssTUFBTTtBQUFBLElBQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxLQUFLLEtBQUssUUFBUSxPQUFPLEtBQUssUUFBUSxJQUFJO0FBQUEsRUFDckYsSUFBSSxLQUFLLE1BQU07QUFBQSxJQUFVLE9BQU8sS0FBSyxRQUFRLFFBQVEsRUFBRSxLQUFLLFdBQVcsQ0FBQyxLQUFLLEtBQUssQ0FBQztBQUFBLEVBQ25GLE9BQU8sQ0FBQztBQUFBO0FBR1YsSUFBTSxhQUFhLENBQUMsUUFBc0I7QUFBQSxFQUN4QyxJQUFJLElBQUksTUFBTTtBQUFBLElBQVksT0FBTyxFQUFDLEdBQUcsSUFBSSxHQUFHLFNBQVMsRUFBQyxNQUFNLElBQUksUUFBUSxLQUFLLElBQUksVUFBVSxHQUFHLE1BQU0sV0FBVyxJQUFJLFFBQVEsSUFBSSxFQUFDLEVBQUM7QUFBQSxFQUNqSSxJQUFJLElBQUksTUFBTTtBQUFBLElBQU8sT0FBTyxFQUFDLEdBQUcsSUFBSSxHQUFHLFNBQVMsRUFBQyxJQUFJLFdBQVcsSUFBSSxRQUFRLEVBQUUsR0FBRyxNQUFNLElBQUksUUFBUSxLQUFLLElBQUksVUFBVSxFQUFDLEVBQUM7QUFBQSxFQUN4SCxJQUFJLElBQUksTUFBTTtBQUFBLElBQU8sT0FBTyxFQUFDLEdBQUcsSUFBSSxHQUFHLFNBQVMsRUFBQyxLQUFLLFdBQVcsSUFBSSxRQUFRLEdBQUcsR0FBRyxPQUFPLFdBQVcsSUFBSSxRQUFRLEtBQUssR0FBRyxNQUFNLFdBQVcsSUFBSSxRQUFRLElBQUksRUFBQyxFQUFDO0FBQUEsRUFDNUosSUFBSSxJQUFJLE1BQU07QUFBQSxJQUFVLE9BQU8sRUFBQyxHQUFHLElBQUksR0FBRyxTQUFTLElBQUksUUFBUSxJQUFJLEVBQUUsTUFBTSxXQUFXLENBQUMsV0FBVyxJQUFJLEdBQUcsV0FBVyxLQUFLLENBQUMsQ0FBQyxFQUFDO0FBQUEsRUFDNUgsSUFBSSxJQUFJLE1BQU07QUFBQSxJQUFTLE9BQU8sRUFBQyxHQUFHLElBQUksR0FBRyxTQUFTLElBQUksUUFBTztBQUFBLEVBQzdELE9BQU8sRUFBQyxHQUFHLElBQUksR0FBRyxTQUFTLElBQUksUUFBTztBQUFBO0FBSXhDLElBQUksWUFBWSxDQUFDLE1BQWUsS0FBSyxVQUFVLEdBQUcsTUFBTSxDQUFDO0FBRXpELElBQU0sYUFBYSxDQUFDLE1BQWMsYUFBa0I7QUFBQSxFQUNsRCxJQUFJLE1BQU0sU0FBUyxJQUFJO0FBQUEsRUFFdkIsSUFBSSxLQUFLLFVBQVUsV0FBVyxHQUFHLENBQUMsTUFBTSxLQUFLLFVBQVUsV0FBVyxRQUFRLENBQUMsR0FBRztBQUFBLElBQzVFLFFBQVEsTUFBTSx5QkFBeUIsSUFBSTtBQUFBLElBQzNDLFFBQVEsTUFBTSxhQUFhLFVBQVUsV0FBVyxRQUFRLENBQUMsQ0FBQztBQUFBLElBQzFELFFBQVEsTUFBTSxRQUFRLFVBQVUsV0FBVyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQ2hELE1BQU0sSUFBSSxNQUFNLHlCQUF5QixNQUFNO0FBQUEsRUFDakQ7QUFBQTtBQUdGLElBQU0sWUFBWSxDQUFDLE1BQWMsYUFBbUI7QUFBQSxFQUNsRCxJQUFJLE1BQU0sU0FBUyxJQUFJO0FBQUEsRUFDdkIsSUFBSSxLQUFLLFVBQVUsSUFBSSxJQUFJLE1BQU0sS0FBSyxVQUFVLFFBQVEsR0FBRztBQUFBLElBQ3pELFFBQVEsTUFBTSw4QkFBOEIsSUFBSTtBQUFBLElBQ2hELFFBQVEsTUFBTSxhQUFhLFFBQVE7QUFBQSxJQUNuQyxRQUFRLE1BQU0sUUFBUSxJQUFJLElBQUk7QUFBQSxJQUM5QixNQUFNLElBQUksTUFBTSw4QkFBOEIsTUFBTTtBQUFBLEVBQ3REO0FBQUE7QUFHSyxJQUFJLFFBQVEsQ0FBQyxNQUFjLE1BQU0sVUFBVSxDQUFDO0FBQzVDLElBQUksUUFBUSxDQUFDLE1BQWMsTUFBTSxVQUFVLENBQUM7QUFDNUMsSUFBSSxRQUFRLENBQUMsU0FBaUIsTUFBTSxPQUFPLEVBQUMsS0FBSSxDQUFDO0FBQ2pELElBQUksUUFBUSxDQUFDLElBQVMsU0FBZ0IsTUFBTSxPQUFPLEVBQUMsSUFBSSxLQUFJLENBQUM7QUFDN0QsSUFBSSxRQUFRLENBQUMsR0FBaUIsT0FBWSxVQUFjLE1BQU0sT0FBTyxFQUFDLEtBQUssT0FBTyxNQUFNLFdBQVcsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLFlBQUksQ0FBQztBQUM3SCxJQUFJLFFBQVEsQ0FBQyxNQUF3QixPQUFXLFFBQWMsTUFBTSxZQUFZLEVBQUMsTUFBTSxLQUFLLElBQUksT0FBSyxPQUFPLE1BQU0sV0FBVyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsYUFBTSxJQUFHLENBQUM7QUFFdEosSUFBSSxXQUFXLENBQUMsV0FBbUMsTUFBTSxVQUFVLE9BQU8sUUFBUSxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUUsT0FBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBRTdILE9BQU8sUUFBUTtBQUFBLEVBQ2IsR0FBSyxNQUFNLEdBQUc7QUFBQSxFQUNkLE1BQU0sTUFBTSxFQUFFO0FBQUEsRUFDZCxXQUFXLE1BQU0sT0FBTztBQUFBLEVBQ3hCLFNBQVMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFBQSxFQUN2QyxXQUFXLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDckQsbUJBQW1CLE1BQU0sS0FBSyxNQUFNLEVBQUUsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUFBLEVBQ25ELGlCQUFpQixTQUFTLEVBQUMsR0FBRyxNQUFNLEVBQUUsR0FBRyxHQUFHLE1BQU0sR0FBRyxFQUFDLENBQUM7QUFBQSxFQUN2RCxhQUFhLE1BQU0sQ0FBQyxHQUFHLEdBQUcsTUFBTSxHQUFHLENBQUM7QUFBQSxFQUNwQyxlQUFlLE1BQU0sQ0FBQyxLQUFLLEdBQUcsR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUFBLEVBQzNDLDRCQUE0QixNQUFNLE9BQU8sT0FBTyxNQUFNLEdBQUcsR0FBRyxFQUFDLE1BQU0sTUFBTSxRQUFRLEVBQUMsQ0FBQyxHQUFHLE1BQU0sRUFBRSxHQUFHLE1BQU0sR0FBRyxDQUFDO0FBQUEsRUFDM0csaUNBQWlDLE1BQU07QUFBQSxJQUNyQyxPQUFPLE9BQU8sTUFBTSxHQUFHLEdBQUcsRUFBQyxNQUFNLE1BQU0sUUFBUSxFQUFDLENBQUM7QUFBQSxJQUNqRCxPQUFPLE9BQU8sTUFBTSxHQUFHLEdBQUcsRUFBQyxNQUFNLE1BQU0sUUFBUSxFQUFDLENBQUM7QUFBQSxFQUNuRCxHQUFHLE1BQU0sR0FBRyxDQUFDO0FBQUEsRUFDYixVQUFXLFNBQVMsRUFBQyxHQUFHLE1BQU0sRUFBRSxFQUFDLENBQUM7QUFBQSxFQUNsQyxPQUFPLFNBQVMsRUFBQyxHQUFHLE1BQU0sR0FBRyxFQUFDLENBQUM7QUFBQSxFQUMvQixpQkFBaUIsU0FBUyxJQUFJO0FBQ2hDLENBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxjQUFjLFdBQVcsTUFBTSxRQUFlLENBQUM7QUFFbEUsT0FBTyxRQUFRO0FBQUEsRUFDYixLQUFLLE1BQU0sU0FBUyxFQUFDLFNBQVMseUNBQXlDLFNBQVMsSUFBRyxDQUFDO0FBQUEsRUFDcEYsaUJBQWlCLE1BQU0sT0FBTztBQUFBLElBQzVCLEtBQUssTUFBTSxHQUFHO0FBQUEsSUFDZCxPQUFPLE1BQU0sU0FBUyxFQUFDLFNBQVMsdUNBQXVDLFNBQVMsS0FBSSxDQUFDO0FBQUEsSUFDckYsTUFBTSxNQUFNLEdBQUc7QUFBQSxFQUNqQixDQUFDO0FBQUEsRUFDRCxRQUFRLFNBQVMsRUFBQyxHQUFHLE1BQU0sU0FBUyxFQUFDLFNBQVMseUNBQXlDLFNBQVMsSUFBRyxDQUFDLEVBQUMsQ0FBQztBQUV4RyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sY0FBYyxXQUFXLE1BQU0sUUFBZSxDQUFDO0FBRWxFLFVBQVU7QUFBQSxPQUFvQjtBQUFBLEVBQzVCLE9BQU8sRUFBQyxRQUFRLEdBQUcsTUFBTSxHQUFHLEtBQUssRUFBQztBQUFBLEVBQ2xDLEtBQUssRUFBQyxRQUFRLElBQUksTUFBTSxHQUFHLEtBQUssRUFBQztBQUNuQyxDQUFDOzs7QUNoaEJNLElBQU0sU0FBUyxDQUFDLE1BQVcsU0FBK0I7QUFBQSxFQUMvRCxJQUFJLEtBQUssS0FBSyxNQUFNLFNBQVMsS0FBSyxLQUFLLE1BQU0sVUFBVSxLQUFLLEtBQUssSUFBSSxTQUFTLEtBQUssS0FBSyxJQUFJO0FBQUEsSUFBUTtBQUFBLEVBQ3BHLFNBQVMsU0FBUyxTQUFTLElBQUksR0FBRTtBQUFBLElBQy9CLElBQUksTUFBTSxPQUFPLE9BQU8sSUFBSTtBQUFBLElBQzVCLElBQUk7QUFBQSxNQUFLLE9BQU87QUFBQSxFQUNsQjtBQUFBLEVBRUEsSUFBSSxLQUFLLE1BQU0sU0FBUyxLQUFLLFFBQVEsSUFBSSxRQUFRLFNBQVMsS0FBSyxRQUFRO0FBQUEsSUFDckUsT0FBTyxLQUFLLFFBQVE7QUFBQSxFQUV0QixJQUFJLEtBQUssTUFBTTtBQUFBLElBQ2IsU0FBUyxLQUFLLEtBQUssUUFBUTtBQUFBLE1BQ3pCLElBQUksRUFBRSxRQUFRLFNBQVMsS0FBSyxRQUFRO0FBQUEsUUFDbEMsT0FBTztBQUFBO0FBQUE7OztBQ1pSLElBQUksU0FBZSxNQUFNLFFBQVE7QUFDakMsSUFBSSxTQUFlLE1BQU0sUUFBUTtBQUNqQyxJQUFJLE9BQWEsTUFBTSxNQUFNO0FBQzdCLElBQUksU0FBYyxNQUFNLFFBQVE7QUFFdkMsT0FBTyxPQUFPO0FBQ2QsT0FBTyxPQUFPO0FBQ2QsS0FBSyxPQUFPO0FBQ1osT0FBTyxPQUFPLE1BQU0sc0JBQXNCLEVBQUU7QUFFckMsSUFBSSxNQUFZLE1BQU0sS0FBSztBQUVsQyxJQUFJLGdCQUFnQixDQUFDLFVBQWtCO0FBQUEsRUFDckMsTUFBTTtBQUFBLEVBQ04sTUFBTSxDQUFDLE1BQVc7QUFBQSxJQUNoQixJQUFJLEVBQUUsTUFBTTtBQUFBLE1BQ1YsSUFBSSxFQUFFLEtBQUssS0FBSyxTQUFTLEVBQUUsS0FBSyxRQUFRLFFBQVE7QUFBQSxRQUFNLE9BQU87QUFBQSxNQUM3RCxNQUFNLElBQUksTUFBTSx3QkFBd0IsYUFBYSxVQUFVLEVBQUUsSUFBSSxHQUFHO0FBQUEsSUFDMUU7QUFBQSxJQUNBLEVBQUUsT0FBTyxNQUFNLElBQUk7QUFBQSxJQUNuQixPQUFPO0FBQUE7QUFFWDtBQUVBLElBQUksV0FBd0U7QUFBQSxFQUMxRSxRQUFRLGNBQWMsUUFBUTtBQUFBLEVBQzlCLFFBQVEsY0FBYyxRQUFRO0FBQUEsRUFDOUIsSUFBTTtBQUFBLElBQ0osTUFBTSxNQUFNLG9DQUFvQyxFQUFFO0FBQUEsSUFDbEQsTUFBTSxDQUFDLEdBQUUsTUFBTSxNQUNaLEVBQUUsS0FBSyxZQUFZLEVBQUUsS0FBSyxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQ3JELEVBQUUsS0FBSyxZQUFZLEVBQUUsS0FBSyxZQUFZLEVBQUUsV0FBVyxFQUFFLFdBQWEsS0FBSyxJQUN0RSxJQUFJLENBQUM7QUFBQSxFQUNYO0FBQUEsRUFDQSxLQUFPO0FBQUEsSUFDTCxNQUFNLE1BQU0scURBQXFELEVBQUU7QUFBQSxJQUNuRSxNQUFNLENBQUMsR0FBRSxNQUFNO0FBQUEsTUFDYixJQUFJLEVBQUUsS0FBSyxZQUFZLEVBQUUsS0FBSztBQUFBLFFBQVUsT0FBTyxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU87QUFBQSxNQUMxRSxNQUFNLElBQUksTUFBTSw0Q0FBNEMsVUFBVSxDQUFDLFNBQVMsVUFBVSxDQUFDLEdBQUc7QUFBQTtBQUFBLEVBRWxHO0FBQUEsRUFDQSxRQUFXO0FBQUEsSUFDVCxNQUFNLE1BQU0sd0VBQXdFLEVBQUU7QUFBQSxJQUN0RixNQUFNLENBQUMsTUFBTSxNQUFNLFFBQVE7QUFBQSxNQUN6QixJQUFJLE1BQU0sS0FBSyxLQUFLLFdBQVcsS0FBSyxVQUFVLEtBQUssS0FBSyxXQUFXLEtBQUssUUFBUSxTQUFTO0FBQUEsTUFDekYsT0FBTyxNQUFNLE9BQU87QUFBQTtBQUFBLEVBRXhCO0FBQUEsRUFDQSxRQUFVO0FBQUEsSUFDUixNQUFNLE1BQU0sc0JBQXNCLEVBQUU7QUFBQSxJQUNwQyxNQUFNLENBQUMsTUFBTTtBQUFBLE1BQ1gsSUFBSSxDQUFDLEVBQUU7QUFBQSxRQUFNLE9BQU8sTUFBTSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDckMsT0FBTyxFQUFFO0FBQUE7QUFBQSxFQUViO0FBQ0Y7QUFHQSxJQUFJLFFBQVE7QUFFWixJQUFJLFlBQVksSUFBSTtBQUVwQixLQUFLLGVBQWUsU0FBUztBQUU3QixJQUFJLFFBQVEsSUFBSSxTQUFtQjtBQUFBLEVBQ2pDLElBQUk7QUFBQSxJQUFPLFVBQVUsT0FBTyxJQUFJLEtBQUssS0FBSyxHQUFHLENBQUMsRUFBRSxNQUFNLEVBQUMsUUFBUSxlQUFlLE1BQU0sT0FBTyxTQUFRLFFBQVEsY0FBYyxRQUFRLFFBQU8sT0FBTSxDQUFDLENBQUM7QUFBQTtBQUczSSxJQUFNLE1BQU0sQ0FBQyxRQUFrQjtBQUFBLEVBRXBDLElBQUksU0FBUyxDQUFDLE1BQWMsUUFBK0M7QUFBQSxJQUN6RSxJQUFJLENBQUM7QUFBQSxNQUFLLE9BQU87QUFBQSxJQUNqQixJQUFJLE1BQU0sUUFBUSxHQUFHO0FBQUEsTUFBRyxPQUFPLE9BQU8sTUFBTSxJQUFJLEVBQUUsS0FBSyxPQUFPLE1BQU0sSUFBSSxFQUFFO0FBQUEsSUFDMUUsSUFBSSxJQUFJLE9BQU8sUUFBUSxTQUFTO0FBQUEsTUFBTSxPQUFPO0FBQUEsSUFDN0MsT0FBTyxPQUFPLE1BQU0sSUFBSSxJQUFJO0FBQUE7QUFBQSxFQUc5QixJQUFJLFdBQVcsQ0FBQyxRQUFpQjtBQUFBLElBQy9CLElBQUksSUFBSTtBQUFBLElBQ1IsT0FBTSxPQUFPLElBQUksS0FBSyxHQUFHO0FBQUEsTUFBRztBQUFBLElBQzVCLE9BQU8sSUFBSTtBQUFBO0FBQUEsRUFFYixJQUFJLE9BQU8sQ0FBQyxLQUFVLFFBQWEsV0FBcUIsRUFBQyxRQUFRLE9BQU8sTUFBTSxJQUFHO0FBQUEsRUFDakYsSUFBSSxZQUFZLENBQUMsS0FBVSxRQUFhLE9BQVksUUFBUSxVQUFlO0FBQUEsSUFFekUsSUFBSSxPQUFPO0FBQUEsTUFDVCxJQUFJLE1BQU0sUUFBUSxVQUFVLE9BQU8sSUFBSSxLQUFLLFVBQVUsTUFBTSxJQUFLO0FBQUEsUUFDL0QsTUFBTSxJQUFJLE1BQU0sK0JBQStCLFVBQVUsT0FBTyxJQUFJLFVBQVUsVUFBVSxNQUFNLElBQUssR0FBRztBQUFBLE1BQ3JHO0FBQUEsZUFBTyxPQUFPLE1BQU07QUFBQSxJQUN6QixPQUFPLEtBQUssS0FBSyxRQUFRLEtBQUs7QUFBQTtBQUFBLEVBSWhDLElBQUksUUFBUSxDQUFDLE1BQVUsU0FBb0I7QUFBQSxJQUN6QyxJQUFJLFFBQVE7QUFBQSxNQUFXLE1BQU0sSUFBSSxNQUFNLHFDQUFxQztBQUFBLElBQzVFLElBQUksS0FBSSxRQUFRLFVBQVUsS0FBSSxJQUFJLEtBQUssVUFBVSxJQUFJO0FBQUEsTUFBRyxNQUFNLElBQUksTUFBTSx3QkFBd0IsVUFBVSxJQUFJLFVBQVUsVUFBVSxLQUFJLElBQUksR0FBRztBQUFBLElBQzdJLEtBQUksT0FBTztBQUFBLElBQ1gsT0FBTztBQUFBO0FBQUEsRUFHVCxNQUFNLE1BQU0sQ0FBQyxNQUFVLFFBQWtCO0FBQUEsSUFDdkMsSUFBSSxPQUFPLENBQUMsSUFBVSxTQUFxQjtBQUFBLE1BQ3pDLE1BQU0sV0FBVyxVQUFVLEVBQUUsR0FBRyxhQUFhLEtBQUssSUFBSSxTQUFTLEVBQUUsS0FBSztBQUFBLENBQUksQ0FBQztBQUFBLE1BQzNFLElBQUksR0FBRyxLQUFLLFNBQVMsU0FBUyxHQUFHLFFBQVE7QUFBQSxRQUFPLE1BQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUFBLE1BQ2pGLElBQUksR0FBRyxLQUFLLFlBQVc7QUFBQSxRQUNyQixJQUFJLEdBQUcsUUFBUSxLQUFLLFdBQVcsS0FBSztBQUFBLFVBQVEsTUFBTSxJQUFJLE1BQU0sWUFBWSxHQUFHLFFBQVEsS0FBSyx5QkFBeUIsS0FBSyxRQUFRO0FBQUEsUUFDOUgsSUFBSSxHQUFHLFFBQVEsUUFBUTtBQUFBLFVBQVcsTUFBTSxJQUFJLE1BQU0sNkJBQTZCO0FBQUEsUUFDL0UsT0FBTyxHQUNMLEdBQUcsUUFBUSxNQUNYLEdBQUcsUUFBUSxLQUFLLE9BQU8sQ0FBQyxNQUFLLEdBQUcsTUFBTSxVQUFVLE1BQUssR0FBRyxLQUFLLElBQUksSUFBSSxHQUFHLEdBQUcsUUFBUSxHQUFVLENBQy9GO0FBQUEsTUFDRjtBQUFBLE1BQ0EsT0FBTyxNQUFNLElBQUcsSUFBSTtBQUFBO0FBQUEsSUFJdEIsUUFBTyxLQUFJO0FBQUEsV0FDSjtBQUFBLFFBQVUsT0FBTyxNQUFNLE1BQUssTUFBTTtBQUFBLFdBQ2xDO0FBQUEsUUFBVSxPQUFPLE1BQU0sTUFBSyxNQUFNO0FBQUEsV0FFbEMsT0FBTztBQUFBLFFBQ1YsSUFBSSxTQUFTLEtBQUksUUFBUTtBQUFBLFVBQU8sTUFBTSxNQUFLLFNBQVMsS0FBSSxRQUFRLE1BQU0sSUFBSTtBQUFBLFFBQzFFLElBQUksTUFBTSxPQUFPLEtBQUksUUFBUSxNQUFNLENBQUMsS0FBSyxFQUFDLFFBQVEsTUFBSyxPQUFPLE1BQUssTUFBTSxLQUFJLENBQUMsQ0FBQztBQUFBLFFBQy9FLElBQUksSUFBSSxPQUFPO0FBQUEsVUFBTSxNQUFNLE1BQUssSUFBSSxPQUFPLElBQUk7QUFBQSxRQUMvQyxPQUFPLElBQUk7QUFBQSxNQUViO0FBQUEsV0FDSyxPQUFPO0FBQUEsUUFDVixJQUFJLFFBQVEsR0FBRyxLQUFJLFFBQVEsT0FBTyxHQUFHO0FBQUEsUUFDckMsTUFBTSxLQUFJLFFBQVEsS0FBSyxNQUFNLElBQUs7QUFBQSxRQUNsQyxJQUFJLE1BQU0sR0FBRyxLQUFJLFFBQVEsTUFBTSxVQUFVLEtBQUssS0FBSSxRQUFRLEtBQUssT0FBTyxJQUFJLENBQUM7QUFBQSxRQUMzRSxNQUFNLE1BQUssSUFBSSxJQUFJO0FBQUEsUUFDbkIsT0FBTztBQUFBLE1BQ1Q7QUFBQSxXQUNLLFlBQVc7QUFBQSxRQUNkLElBQUksS0FBSSxRQUFRLE9BQU87QUFBQSxVQUFXLEtBQUksUUFBUSxNQUFNO0FBQUEsUUFDcEQsSUFBSSxTQUFTLEtBQUssTUFBSyxLQUFJLFFBQVEsSUFBSTtBQUFBLFFBQ3ZDLElBQUksT0FBTyxNQUFNLFNBQVMsR0FBRyxDQUFDO0FBQUEsUUFDOUIsSUFBSSxRQUFRLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxLQUFJLFFBQVEsTUFBTSxNQUFNLENBQUM7QUFBQSxRQUN6RCxPQUFPLE1BQU0sTUFBTSxLQUFJLFFBQVEsTUFBTSxRQUFRLEtBQUksUUFBUSxHQUFHLEdBQUcsS0FBSztBQUFBLE1BQ3RFO0FBQUEsV0FFSyxPQUFPO0FBQUEsUUFDVixJQUFJLEtBQUssR0FBRyxLQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsUUFDL0IsSUFBSSxPQUFPLEtBQUksUUFBUSxLQUFLLElBQUksU0FBTyxHQUFHLEtBQUssR0FBRyxDQUFDO0FBQUEsUUFDbkQsSUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJO0FBQUEsUUFDdkIsSUFBSSxJQUFJO0FBQUEsVUFBTSxNQUFNLE1BQUssSUFBSSxJQUFJO0FBQUEsUUFDakMsT0FBTztBQUFBLE1BQ1Q7QUFBQTtBQUFBLFFBQ1MsT0FBTztBQUFBO0FBQUE7QUFBQSxFQUlwQixNQUFNLEtBQUssQ0FBQyxNQUFVLFFBQWtCO0FBQUEsSUFDdEMsSUFBSSxNQUFNLElBQUksTUFBSyxHQUFHO0FBQUEsSUFDdEIsTUFBTSxRQUFRLFVBQVUsSUFBRyxHQUFHO0FBQUEsUUFBVyxVQUFVLElBQUksUUFBUSxHQUFHLEdBQUc7QUFBQSxLQUFRLFVBQVUsR0FBRyxDQUFDO0FBQUEsSUFDM0YsSUFBSSxVQUFVLElBQUk7QUFBQSxJQUNsQixJQUFJO0FBQUEsTUFBUyxNQUFNLE1BQUssT0FBTztBQUFBLElBQy9CLE9BQU87QUFBQTtBQUFBLEVBRVQsT0FBTyxHQUFHLEtBQUssSUFBSTtBQUFBO0FBS3JCLFFBQVE7QUFFUixJQUFJLE1BQU0sTUFBTSx1QkFBdUIsRUFBRTtBQUN6QyxJQUFJLE1BQU0sSUFBSSxHQUFJO0FBRWxCLFFBQVE7OztBQ2xLUixJQUFNLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUF5Q25CLElBQUksVUFBVSxLQUFLLEtBQUssRUFBRSxFQUFFLE1BQU07QUFBQSxFQUNoQyxXQUFXLGVBQWEsTUFBTTtBQUFBLEVBQzlCLFlBQVk7QUFDZCxDQUFDO0FBRUQsSUFBSTtBQUNKLElBQUksZ0JBQTRDLENBQUM7QUFHakQsSUFBSSxPQUFjO0FBRWxCLElBQUksT0FBTyxPQUNULGFBQWEsUUFBUSxPQUFPLEtBQUssWUFDakMsT0FBSTtBQUFBLEVBQ0YsSUFBRztBQUFBLElBQ0QsSUFBSSxTQUFTLE1BQU0sQ0FBQztBQUFBLElBQ3BCLE9BQU0sT0FBTztBQUFBLElBQ2IsZ0JBQWdCLE9BQU87QUFBQSxJQUN2QixPQUFPO0FBQUEsSUFDUCxJQUFJLE9BQU0sSUFBSSxJQUFHO0FBQUEsSUFDakIsUUFBUSxHQUFHLGNBQWMsVUFBVSxJQUFHO0FBQUEsSUFFdkMsT0FBTSxHQUFFO0FBQUEsSUFDUCxPQUFNO0FBQUEsSUFDTixnQkFBZ0IsQ0FBQztBQUFBLElBQ2pCLFFBQVEsR0FBRyxjQUFjLGFBQWEsUUFBUSxFQUFFLFVBQVUsT0FBTyxDQUFDO0FBQUE7QUFBQSxHQUd0RSxNQUFLLGVBQ0wsQ0FBQyxRQUFRO0FBQUEsRUFDUCxJQUFJLE1BQU0sSUFBSSxLQUFLLFFBQVEsT0FBTyxNQUFNLEdBQUcsSUFBSTtBQUFBLEVBQy9DLElBQUk7QUFBQSxJQUFLLEtBQUssVUFBVSxFQUFDLEtBQUssSUFBSSxLQUFLLE1BQU0sT0FBSyxHQUFHLEtBQUssSUFBSSxLQUFLLE1BQU0sTUFBSSxFQUFDLENBQUM7QUFBQSxHQUVqRixDQUFDLFNBQVM7QUFBQSxFQUNSLElBQUksS0FBSyxNQUFNO0FBQUEsSUFBVyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7QUFBQSxFQUV4QyxJQUFJLE1BQU8sS0FBSyxJQUFJO0FBQUEsRUFDcEIsSUFBSSxNQUFtQyxJQUFJLE1BQU0sRUFBRSxFQUFFLElBQUksT0FBQztBQUFBLElBQUc7QUFBQSxHQUFTO0FBQUEsRUFFdEUsSUFBSSxPQUFVLEtBQUssT0FBTyxLQUFLLE9BQU87QUFBQSxFQUV0QyxJQUFJLEtBQUssVUFBVSxJQUFHO0FBQUEsRUFDdEIsSUFBSSxLQUFLLEdBQUcsTUFBTSxFQUFFLEVBQUUsTUFBTTtBQUFBLEVBQzVCLE9BQU87QUFBQSxFQUVQLE9BQU8sQ0FBQyxLQUFLLEdBQUc7QUFBQSxDQUVwQjtBQUtBLEtBQUssTUFBTSxFQUFDLFNBQVMsUUFBTyxZQUFZLGFBQWEsQ0FBQztBQUd0RCxJQUFJLFFBQVEsQ0FBQyxHQUFVLFlBQXVCLEtBQUssR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFDLE9BQU8sUUFBUSxRQUFRLGtCQUFrQixjQUFjLE9BQU8sU0FBUyxXQUFXLGFBQWEsTUFBSyxDQUFDO0FBRTNLLEtBQUssT0FDSCxJQUNFLEtBQUssSUFBRyxFQUFFLE1BQU0sRUFBQyxVQUFVLE9BQU8sYUFBYSxNQUFLLENBQUMsR0FDckQsS0FBSyxLQUFLLEVBQUUsTUFBTSxFQUFDLFVBQVUsU0FBUyxZQUFZLFFBQVEsWUFBWSxZQUFXLENBQUMsQ0FDcEYsRUFBRSxNQUFNLEVBQUMsU0FBUyxRQUFRLFlBQVksVUFBVSxjQUFjLFFBQVEsT0FBTyxPQUFNLENBQUMsR0FFcEYsS0FBSyxJQUNMLFNBQ0EsTUFBTSxTQUFTLE1BQU0sS0FBSyxRQUFRLFVBQVUsQ0FBQyxHQUM3QyxNQUFNLFVBQVUsTUFBTSxPQUFPLEtBQUssc0NBQXNDLENBQUMsQ0FDM0U7IiwKICAiZGVidWdJZCI6ICJCQzc0MDEyMzEzMjYwNjdDNjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
