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
      return node;
    },
    onclick: (f) => {
      el.onclick = f;
      return node;
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
var prettyEnv = (env) => "[[" + _prettyEnv(env);
var _prettyEnv = (env) => env === null ? "]]" : Array.isArray(env) ? "[[" + _prettyEnv(env[0]) + " | [[" + _prettyEnv(env[1]) : env.binder.content.name + ", " + _prettyEnv(env.next);
var prettyAST = (node) => {
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
      return `${node.content.env ? "ENV: [[" + prettyEnv(node.content.env) : ""}fn ${node.content.vars.map(prettyBinder).join(" ")} => ${prettyAST(node.content.body)}`;
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
var astView = (ast) => {
  let _view = (ast2) => {
    let el = span();
    switch (ast2.$) {
      case "number":
      case "string":
        return el.append(String(ast2.content)).style({ color: color.blue });
      case "var":
        return el.append(ast2.content.name);
      case "function":
        return el.append(ast2.content.env ? prettyEnv(ast2.content.env) : "", "fn (", ...ast2.content.vars.map(go), ") => ").append(go(ast2.content.body));
      case "app":
        return el.append("(", go(ast2.content.fn), " ", ...ast2.content.args.map((arg) => go(arg)), ")");
      case "let":
        return el.append("let ", ast2.content.var.content.name, " = ", go(ast2.content.value), " in ", go(ast2.content.body));
      default:
        return el.append(`[${ast2.$}]`);
    }
  };
  let go = (ast2) => {
    let el = span(_view(ast2)).style({ color: colorOf(ast2), cursor: "pointer" }).onclick((e) => {
      el.replaceChilren(span("TYPE:").style({ color: color.gray }).onclick((e2) => {
        el.replaceChilren(_view(ast2));
        e2.stopImmediatePropagation();
      }), ast2.type ? astView(ast2.type) : "*", go(ast2));
      e.stopPropagation();
    });
    return el;
  };
  return div(go(ast)).style({ padding: ".4em", border: "1px solid " + color.gray, borderRadius: ".4em", margin: ".4em 0" });
};
var debug = (...args) => {
  if (!DEBUG)
    return;
  let pr = loggerPre;
  for (let arg of args) {
    if (typeof arg == "string" || typeof arg == "number")
      pr.append(String(arg));
    else if (Array.isArray(arg))
      ["[", ...arg, "]"].forEach((a) => debug(a));
    else if (arg === undefined || arg === null)
      pr.append(span(String(arg)).style({ color: color.gray }));
    else if ("$" in arg) {
      if (arg.$ == "NODE")
        pr.append(arg);
      else
        pr.append(astView(arg));
    }
  }
};
var debugCall = (fn) => (...args) => {
  debug("@ ", fn.name, ...args);
  let oldpre = loggerPre;
  let callpre = pre().style({ borderLeft: "4px solid " + color.gray, marginLeft: "8px", paddingLeft: "8px" });
  loggerPre.append(callpre);
  loggerPre = callpre;
  let res = fn(...args);
  loggerPre = oldpre;
  debug(res);
  return res;
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
  let go = (ast2, env) => {
    if (env)
      debug(prettyEnv(env));
    let call = (fn, args) => {
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
    call = debugCall(call);
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
  go = debugCall(go);
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

//# debugId=8BCB9E741D3F76A664756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCk9PiBOT0RFLFxuICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IE5PREU8SD4sXG4gIGFzc2lnbjogKGh0bWxQcm9wczogUGFydGlhbDxIVE1MRWxlbWVudD4pID0+IE5PREVcbn1cblxuZXhwb3J0IHR5cGUgQVJHID0gTk9ERSB8IHN0cmluZyB8ICgoZTpNb3VzZUV2ZW50KT0+dm9pZClcblxuZXhwb3J0IGNvbnN0IGh0bWwgPSA8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4gKHRhZzpLKSA9PiAoLi4uY2hpbGRyZW46QVJHW10pOiBOT0RFIDxIVE1MRWxlbWVudFRhZ05hbWVNYXBbS10+ID0+IHtcbiAgbGV0IG9uY2xpY2sgPSBjaGlsZHJlbi5maW5kKGMgPT4gdHlwZW9mIGMgPT09IFwiZnVuY3Rpb25cIikgYXMgRnVuY3Rpb25cbiAgbGV0IGVsID0gZnJvbUhUTUwgKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSkuYXBwZW5kKC4uLiBjaGlsZHJlbi5maWx0ZXIoYyA9PiB0eXBlb2YgYyAhPT0gXCJmdW5jdGlvblwiKSBhcyAoTk9ERSB8IHN0cmluZylbXSkgYXMgTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPjtcbiAgaWYgKG9uY2xpY2spIGVsLmVsLiBvbmNsaWNrID0gKG9uY2xpY2sgYXMgKGU6TW91c2VFdmVudCk9PnZvaWQpXG4gIFxuICByZXR1cm4gZWxcbn1cblxuXG5leHBvcnQgY29uc3QgZnJvbUhUTUwgID0gPEggZXh0ZW5kcyBIVE1MRWxlbWVudD4gIChlbDpIKTogTk9ERSA8SD4gPT4ge1xuXG4gIGxldCBub2RlIDogTk9ERTxIPiA9IHtcbiAgICAkOiBcIk5PREVcIixcbiAgICBlbCxcbiAgICBhcHBlbmQ6ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBjaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gXCJzdHJpbmdcIikgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpKTtcbiAgICAgICAgZWxzZSBlbC5hcHBlbmRDaGlsZChjaGlsZC5lbCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG4gICAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCkgPT4ge1xuICAgICAgZWwub25jbGljayA9IGZcbiAgICAgIHJldHVybiBub2RlXG4gICAgfSxcbiAgICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGVsLnJlcGxhY2VDaGlsZHJlbigpXG4gICAgICByZXR1cm4gbm9kZS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gICAgfSxcbiAgICBzdHlsZTogKHN0eWxlczogUGFydGlhbDxDU1NTdHlsZURlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgc3R5bGVzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfSxcbiAgICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiB7XG4gICAgICBPYmplY3QuYXNzaWduKGVsLCBodG1sUHJvcHMpO1xuICAgICAgcmV0dXJuIGZyb21IVE1MKGVsKTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBub2RlXG59XG5cblxuZXhwb3J0IGNvbnN0IGRpdiA9IGh0bWwoXCJkaXZcIik7XG5leHBvcnQgY29uc3Qgc3BhbiA9IGh0bWwoXCJzcGFuXCIpO1xuZXhwb3J0IGNvbnN0IHAgPSBodG1sKFwicFwiKTtcbmV4cG9ydCBjb25zdCBib2R5ID0gZnJvbUhUTUwoZG9jdW1lbnQuYm9keSk7XG5leHBvcnQgY29uc3QgaDEgPSBodG1sKFwiaDFcIik7XG5leHBvcnQgY29uc3QgaDIgPSBodG1sKFwiaDJcIik7XG5leHBvcnQgY29uc3QgaDMgPSBodG1sKFwiaDNcIik7XG5leHBvcnQgY29uc3QgaDQgPSBodG1sKFwiaDRcIik7XG5leHBvcnQgY29uc3QgdGFibGUgPSBodG1sKFwidGFibGVcIik7XG5leHBvcnQgY29uc3QgdHIgPSBodG1sKFwidHJcIik7XG5leHBvcnQgY29uc3QgdGQgPSBodG1sKFwidGRcIik7XG5leHBvcnQgY29uc3QgcHJlID0gaHRtbChcInByZVwiKVxuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNmVlZWZmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMjIyMTIyO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZjEwZjIyO1xuICAgICAgLS1ncmVlbjogIzU0YzgwMTtcbiAgICAgIC0tYmx1ZTogIzFmMzJmZjtcbiAgICAgIC0teWVsbG93OiAjZDM5ZTNkO1xuICAgICAgLS1icm93bjogI2M1NWQwMDtcbiAgICAgIC0tcHVycGxlOiAjYTYxZmQwO1xuICAgICAgLS1jeWFuOiAjMGJhZWJjO1xuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuZXhwb3J0IGNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IHVuZGVmaW5lZCk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJcbmV4cG9ydCB0eXBlIEVudiA9IHtiaW5kZXI6IFZhciwgdmFsdWU6IEFTVCwgbmV4dDogRW52fSB8IFtFbnYsIEVudl0gfCBudWxsXG5cbmV4cG9ydCB0eXBlIFBvcyA9IHtvZmZzZXQ6IG51bWJlciwgbGluZTogbnVtYmVyLCBjb2w6IG51bWJlcn1cbmV4cG9ydCB0eXBlIFNwYW4gPSB7c3RhcnQ6IFBvcywgZW5kOiBQb3N9XG5cbmV4cG9ydCB0eXBlIFRhZyA8VCBleHRlbmRzIHN0cmluZywgQz4gPSB7JDogVCwgY29udGVudDogQywgc3BhbjogU3BhbiwgdHlwZT86IEFTVH1cblxuZXhwb3J0IHR5cGUgVmFyID0gVGFnPFwidmFyXCIsIHtuYW1lOiBzdHJpbmd9PlxuZXhwb3J0IHR5cGUgQ29tbWVudCA9IFRhZzxcImNvbW1lbnRcIiwgc3RyaW5nPlxuZXhwb3J0IHR5cGUgRnVuYyA9IFRhZzxcImZ1bmN0aW9uXCIsIHt2YXJzOiBWYXJbXSwgYm9keTogQVNULCBlbnY/IDpFbnZ9PlxuXG5leHBvcnQgdHlwZSBFcnJvck5vZGUgPSBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PlxuXG5leHBvcnQgdHlwZSBBU1QgPVxuICB8IFRhZzxcImFwcFwiLCB7Zm46IEFTVCwgYXJnczogQVNUW119PlxuICB8IFZhclxuICB8IEZ1bmNcbiAgfCBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPlxuICB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG4gIHwgVGFnPFwibGV0XCIsIHt2YXI6IFZhciwgdmFsdWU6IEFTVCwgYm9keTogQVNUfT5cbiAgfCBUYWc8XCJyZWNvcmRcIiwgW1ZhciwgQVNUXVtdPlxuICB8IEVycm9yTm9kZVxuXG5leHBvcnQgdHlwZSBTeW50YXhOb2RlID0gQVNUIHwgQ29tbWVudFxuZXhwb3J0IHR5cGUgUGFyc2VSZXN1bHQgPSB7YXN0OiBBU1QsIGNvbW1lbnRzOiBDb21tZW50W10sIGFzdG1hcDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW119XG5cbmNvbnN0IGhhc1Nob3duVHlwZSA9ICh2OiBWYXIpID0+IHYudHlwZSAmJiAhKHYudHlwZS4kID09PSBcInZhclwiICYmIHYudHlwZS5jb250ZW50Lm5hbWUgPT09IFwiYW55XCIpXG5jb25zdCBwcmV0dHlCaW5kZXIgPSAodjogVmFyKTogc3RyaW5nID0+IGhhc1Nob3duVHlwZSh2KSA/IGAoJHtwcmV0dHlBU1Qodi50eXBlISl9ICR7di5jb250ZW50Lm5hbWV9KWAgOiB2LmNvbnRlbnQubmFtZVxuXG5leHBvcnQgY29uc3QgcHJldHR5RW52ID0gKGVudjogRW52KSA9PiBcIltbXCIgKyBfcHJldHR5RW52KGVudilcblxuY29uc3QgIF9wcmV0dHlFbnYgPSAoKGVudjpFbnYpIDogc3RyaW5nID0+IChlbnYgPT09IG51bGwpID8gXCJdXVwiXG4gIDogKEFycmF5LmlzQXJyYXkoZW52KSkgPyBcIltbXCIgKyBfcHJldHR5RW52KGVudlswXSkgKyBcIiB8IFtbXCIgKyBfcHJldHR5RW52KGVudlsxXSlcbiAgOiBlbnYuYmluZGVyLmNvbnRlbnQubmFtZSArIFwiLCBcIiArIF9wcmV0dHlFbnYoZW52Lm5leHQpKTtcbmV4cG9ydCBjb25zdCBwcmV0dHlBU1QgPSAobm9kZTogQVNUKTogc3RyaW5nID0+e1xuXG4gIHN3aXRjaChub2RlLiQpe1xuICAgIGNhc2UgXCJudW1iZXJcIiA6IHJldHVybiBub2RlLmNvbnRlbnQudG9TdHJpbmcoKVxuICAgIGNhc2UgXCJzdHJpbmdcIiA6IHJldHVybiBKU09OLnN0cmluZ2lmeShub2RlLmNvbnRlbnQpXG4gICAgY2FzZSBcInZhclwiOiByZXR1cm4gbm9kZS5jb250ZW50Lm5hbWVcbiAgICBjYXNlIFwibGV0XCI6IHJldHVybiBgbGV0ICR7cHJldHR5QmluZGVyKG5vZGUuY29udGVudC52YXIpfSA9ICR7cHJldHR5QVNUKG5vZGUuY29udGVudC52YWx1ZSl9IGluXFxuJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIGAke25vZGUuY29udGVudC5lbnY/IFwiRU5WOiBbW1wiKyBwcmV0dHlFbnYobm9kZS5jb250ZW50LmVudikgOiBcIlwifWZuICR7bm9kZS5jb250ZW50LnZhcnMubWFwKHByZXR0eUJpbmRlcikuam9pbihcIiBcIil9ID0+ICR7cHJldHR5QVNUKG5vZGUuY29udGVudC5ib2R5KX1gXG4gICAgY2FzZSBcImFwcFwiOiByZXR1cm4gYCgke3ByZXR0eUFTVChub2RlLmNvbnRlbnQuZm4pfSAke25vZGUuY29udGVudC5hcmdzLm1hcChwcmV0dHlBU1QpLmpvaW4oXCIgXCIpfSlgXG4gICAgY2FzZSBcInJlY29yZFwiOiByZXR1cm4gYHske25vZGUuY29udGVudC5tYXAoKFtrLCB2XSkgPT4gYCR7ay5jb250ZW50Lm5hbWV9OiAke3ByZXR0eUFTVCh2KX1gKS5qb2luKFwiLCBcIil9fWBcbiAgICBjYXNlIFwiZXJyb3JcIjogcmV0dXJuIGBbRVJST1I6ICR7bm9kZS5jb250ZW50Lm1lc3NhZ2V9XWBcbiAgfVxufVxuXG5cbmNvbnN0IHplcm9Qb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9KVxuY29uc3QgemVyb1NwYW4gPSAoKTogU3BhbiA9PiAoe3N0YXJ0OiB6ZXJvUG9zKCksIGVuZDogemVyb1BvcygpfSlcblxuZXhwb3J0IGNvbnN0IG1rQXN0ID0gPFQgZXh0ZW5kcyBzdHJpbmcsIEM+KHRhZzogVCwgY29udGVudDogQywgc3BhbjogU3BhbiA9IHplcm9TcGFuKCkpOiBUYWc8VCwgQz4gPT4gKHskOiB0YWcsIGNvbnRlbnQsIHNwYW59KVxuXG50eXBlIFRva2VuQmFzZSA9IHtzcGFuOiBTcGFufVxuXG50eXBlIFRva2VuID1cbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiaWRlbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogbnVtYmVyfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiYXJyb3dcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImNvbW1lbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30pXG5cbnR5cGUgVG9rZW5Ob1NwYW4gPSBUb2tlbiBleHRlbmRzIGluZmVyIFQgPyBUIGV4dGVuZHMge3NwYW46IFNwYW59ID8gT21pdDxULCBcInNwYW5cIj4gOiBuZXZlciA6IG5ldmVyXG5cbmNvbnN0IHRva2VuaXplID0gKGNvZGU6IHN0cmluZyk6IHt0b2tlbnM6IFRva2VuW10sIGNvbW1lbnRzOiBDb21tZW50W10sIGVvZjogUG9zfSA9PiB7XG4gIGxldCB0b2tlbnM6IFRva2VuW10gPSBbXVxuICBsZXQgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdXG4gIGxldCBpID0gMFxuICBsZXQgbGluZSA9IDFcbiAgbGV0IGNvbCA9IDFcblxuICBsZXQgaXNBbHBoYSA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16X10vLnRlc3QoY2hhcilcbiAgbGV0IGlzRGlnaXQgPSAoY2hhcjogc3RyaW5nKSA9PiAvWzAtOV0vLnRlc3QoY2hhcilcbiAgbGV0IGlzSWRlbnQgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtejAtOV9dLy50ZXN0KGNoYXIpXG4gIGxldCBwb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiBpLCBsaW5lLCBjb2x9KVxuICBsZXQgYWR2YW5jZSA9ICgpID0+IHtcbiAgICBpZiAoY29kZVtpXSA9PT0gXCJcXG5cIikge1xuICAgICAgaSsrXG4gICAgICBsaW5lKytcbiAgICAgIGNvbCA9IDFcbiAgICB9IGVsc2Uge1xuICAgICAgaSsrXG4gICAgICBjb2wrK1xuICAgIH1cbiAgfVxuICBsZXQgcHVzaCA9ICh0b2tlbjogVG9rZW5Ob1NwYW4sIHN0YXJ0OiBQb3MpID0+IHtcbiAgICB0b2tlbnMucHVzaCh7Li4udG9rZW4sIHNwYW46IHtzdGFydCwgZW5kOiBwb3MoKX19IGFzIFRva2VuKVxuICB9XG5cbiAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgIGxldCBjaGFyID0gY29kZVtpXVxuXG4gICAgaWYgKC9cXHMvLnRlc3QoY2hhcikpIHtcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCIvXCIgJiYgY29kZVtpICsgMV0gPT09IFwiL1wiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgY29kZVtpXSAhPT0gXCJcXG5cIikgYWR2YW5jZSgpXG4gICAgICBjb21tZW50cy5wdXNoKG1rQXN0KFwiY29tbWVudFwiLCBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSksIHtzdGFydCwgZW5kOiBwb3MoKX0pKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCI9XCIgJiYgY29kZVtpICsgMV0gPT09IFwiPlwiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwiYXJyb3dcIn0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoXCIoKXt9PSw6XCIuaW5jbHVkZXMoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWUgPSBjaGFyIGFzIFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBcIlwiXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gY29kZVtpXVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICBsZXQgbmV4dCA9IGNvZGVbaSArIDFdXG4gICAgICAgICAgaWYgKG5leHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBlc2NhcGVcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBlc2NhcGVkID0gKHtuOiBcIlxcblwiLCByOiBcIlxcclwiLCB0OiBcIlxcdFwiLCAnXCInOiAnXCInLCBcIlxcXFxcIjogXCJcXFxcXCJ9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pW25leHRdXG4gICAgICAgICAgdmFsdWUgKz0gZXNjYXBlZCA/PyBuZXh0XG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gJ1wiJykgYnJlYWtcbiAgICAgICAgdmFsdWUgKz0gY3VycmVudFxuICAgICAgICBhZHZhbmNlKClcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlW2ldICE9PSAnXCInKSB7XG4gICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGxpdGVyYWxcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgIH1cbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzRGlnaXQoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNEaWdpdChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogTnVtYmVyKGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSkpfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0FscGhhKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzSWRlbnQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKVxuICAgICAgaWYgKHZhbHVlID09PSBcImxldFwiIHx8IHZhbHVlID09PSBcImluXCIgfHwgdmFsdWUgPT09IFwiZm5cIikgcHVzaCh7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBlbHNlIHB1c2goe3R5cGU6IFwiaWRlbnRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICBhZHZhbmNlKClcbiAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IGBVbmV4cGVjdGVkIGNoYXJhY3RlcjogJHtjaGFyfWAsIGNvbnRlbnQ6IGNoYXJ9LCBzdGFydClcbiAgfVxuXG4gIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbn1cblxuY2xhc3MgUGFyc2VyIHtcbiAgcHJpdmF0ZSBpID0gMFxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdG9rZW5zOiBUb2tlbltdLCBwcml2YXRlIHNvdXJjZTogc3RyaW5nLCBwcml2YXRlIGVvZjogUG9zKSB7fVxuXG4gIHBhcnNlKCk6IEFTVCB7XG4gICAgbGV0IGFzdCA9IHRoaXMucGFyc2VFeHByKClcbiAgICBpZiAodGhpcy5wZWVrKCkpIHtcbiAgICAgIGxldCBzdGFydCA9IHRoaXMucGVlaygpIS5zcGFuLnN0YXJ0XG4gICAgICBsZXQgZW5kID0gdGhpcy50b2tlbnNbdGhpcy50b2tlbnMubGVuZ3RoIC0gMV0/LnNwYW4uZW5kID8/IHN0YXJ0XG4gICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbmV4cGVjdGVkIGV4dHJhIGlucHV0IGFmdGVyIGV4cHJlc3Npb25cIiwge3N0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICByZXR1cm4gYXN0XG4gIH1cblxuICBwcml2YXRlIHBhcnNlRXhwcigpOiBBU1Qge1xuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImxldFwiKSkgcmV0dXJuIHRoaXMucGFyc2VMZXQoKVxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImZuXCIpKSByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKClcbiAgICByZXR1cm4gdGhpcy5wYXJzZUF0b20oKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldCgpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImxldFwiKS5zcGFuLnN0YXJ0XG4gICAgbGV0IHZhcmlhYmxlID0gdGhpcy5wYXJzZUxldEJpbmRlcigpXG4gICAgaWYgKHZhcmlhYmxlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIHZhcmlhYmxlXG5cbiAgICBsZXQgdmFsdWU6IEFTVFxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiPVwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCI9XCIpXG4gICAgICB2YWx1ZSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIpXG4gICAgfVxuXG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImluXCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdEtleXdvcmQoXCJpblwiKVxuICAgICAgYm9keSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIpXG4gICAgfVxuXG4gICAgcmV0dXJuIG1rQXN0KFwibGV0XCIsIHt2YXI6IHZhcmlhYmxlLCB2YWx1ZSwgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VGdW5jdGlvbigpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImZuXCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyczogVmFyW10gPSBbXVxuICAgIHdoaWxlICh0aGlzLnBlZWsoKT8udHlwZSA9PT0gXCJpZGVudFwiIHx8IHRoaXMuaXNTeW1ib2woXCIoXCIpKSB7XG4gICAgICBsZXQgYmluZGVyID0gdGhpcy5wYXJzZUJpbmRlcigpXG4gICAgICBpZiAoYmluZGVyLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHk6IGJpbmRlcn0sIHtzdGFydCwgZW5kOiBiaW5kZXIuc3Bhbi5lbmR9KVxuICAgICAgdmFycy5wdXNoKGJpbmRlcilcbiAgICB9XG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh2YXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKHRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSBib2R5ID0gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpXG4gICAgICBlbHNlIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCBzdGFydClcbiAgICB9IGVsc2UgaWYgKCF0aGlzLm1hdGNoVG9rZW4oXCJhcnJvd1wiKSkge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPT4nIGFmdGVyIGZ1bmN0aW9uIHBhcmFtZXRlcnNcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH1cbiAgICByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBdG9tKCk6IEFTVCB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dFwiKVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiaWRlbnRcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInZhclwiLCB7bmFtZTogdG9rZW4udmFsdWV9LCB0b2tlbi5zcGFuKVxuICAgIH1cblxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJudW1iZXJcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJzdHJpbmdcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogdG9rZW4ubWVzc2FnZSwgY29udGVudDogdG9rZW4uY29udGVudH0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCIoXCIpKSByZXR1cm4gdGhpcy5wYXJzZVBhcmVucygpXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCJ7XCIpKSByZXR1cm4gdGhpcy5wYXJzZVJlY29yZCgpXG5cbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShgVW5leHBlY3RlZCB0b2tlbjogJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB0b2tlbi5zcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVBhcmVucygpOiBBU1Qge1xuICAgIGxldCBvcGVuID0gdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgbGV0IGl0ZW1zOiBBU1RbXSA9IFtdXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gaXRlbXMubGVuZ3RoID4gMCA/IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGl0ZW1zLnB1c2godGhpcy5wYXJzZUV4cHIoKSlcbiAgICB9XG4gICAgbGV0IGNsb3NlID0gdGhpcy5leHBlY3RTeW1ib2woXCIpXCIpXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiRW1wdHkgcGFyZW50aGVzZXMgYXJlIG5vdCBhbGxvd2VkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgY2xvc2Uuc3Bhbi5lbmQub2Zmc2V0KSlcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAxKSByZXR1cm4gaXRlbXNbMF1cbiAgICByZXR1cm4gbWtBc3QoXCJhcHBcIiwge2ZuOiBpdGVtc1swXSwgYXJnczogaXRlbXMuc2xpY2UoMSl9LCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVjb3JkKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIntcIilcbiAgICBsZXQgZmllbGRzOiBbVmFyLCBBU1RdW10gPSBbXVxuXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcmVjb3JkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkge1xuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKSFcbiAgICAgICAgdGhpcy5pKytcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBFeHBlY3RlZCByZWNvcmQgZmllbGQgbmFtZSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YCwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogdG9rZW4uc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCB0b2tlbi5zcGFuLmVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IGtleSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgbGV0IHZhbHVlID0gdGhpcy5pc1N5bWJvbChcIjpcIilcbiAgICAgICAgPyAodGhpcy5leHBlY3RTeW1ib2woXCI6XCIpLCB0aGlzLmlzU3ltYm9sKFwifVwiKSA/IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiKSA6IHRoaXMucGFyc2VFeHByKCkpXG4gICAgICAgIDoga2V5XG4gICAgICBmaWVsZHMucHVzaChba2V5LCB2YWx1ZV0pXG4gICAgICBpZiAodGhpcy5pc1N5bWJvbChcIixcIikpIHRoaXMuaSsrXG4gICAgICBlbHNlIGJyZWFrXG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgbGV0IGVuZCA9IGZpZWxkcy5sZW5ndGggPiAwID8gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXVsxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIn1cIilcbiAgICByZXR1cm4gbWtBc3QoXCJyZWNvcmRcIiwgZmllbGRzLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlQmluZGVyKCk6IFZhciB8IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+IHtcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKFwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgaWRlbnRpZmllciBpbiBiaW5kZXIgcGF0dGVyblwiKVxuICAgICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJyknIGFmdGVyIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICAgIHZhcmlhYmxlLnR5cGUgPSBkZWNsYXJlZFR5cGVcbiAgICAgIHJldHVybiB2YXJpYWJsZVxuICAgIH1cbiAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyXCIpXG4gICAgbGV0IHZhcmlhYmxlID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI6XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIjpcIilcbiAgICAgIGxldCBkZWNsYXJlZFR5cGUgPSB0aGlzLnBhcnNlQXRvbSgpXG4gICAgICBpZiAoZGVjbGFyZWRUeXBlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGRlY2xhcmVkVHlwZVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgIH1cbiAgICByZXR1cm4gdmFyaWFibGVcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VMZXRCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQmluZGVyKClcbiAgfVxuXG4gIHByaXZhdGUgcGVlaygpOiBUb2tlbiB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMuaV1cbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKTogYm9vbGVhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICByZXR1cm4gdG9rZW4/LnR5cGUgPT09IFwia2V5d29yZFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBpc1N5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJzeW1ib2xcIiAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWVcbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0VG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7dHlwZX0sIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaFRva2VuPEsgZXh0ZW5kcyBUb2tlbltcInR5cGVcIl0+KHR5cGU6IEspOiBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+IHwgdW5kZWZpbmVkIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4gfHwgdG9rZW4udHlwZSAhPT0gdHlwZSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuIGFzIEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT5cbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0S2V5d29yZCh2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIikge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuPy50eXBlICE9PSBcImtleXdvcmRcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQga2V5d29yZCAke3ZhbHVlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RTeW1ib2wodmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwic3ltYm9sXCIgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcke3ZhbHVlfScsIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW5cbiAgfVxuXG4gIHByaXZhdGUgZGVzY3JpYmUodG9rZW46IFRva2VuIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gXCJlbmQgb2YgaW5wdXRcIlxuICAgIGlmIChcInZhbHVlXCIgaW4gdG9rZW4pIHJldHVybiBgJHt0b2tlbi50eXBlfSgke1N0cmluZyh0b2tlbi52YWx1ZSl9KWBcbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJlcnJvclwiKSByZXR1cm4gYGVycm9yKCR7dG9rZW4ubWVzc2FnZX0pYFxuICAgIHJldHVybiB0b2tlbi50eXBlXG4gIH1cblxuICBwcml2YXRlIGVycm9yTm9kZShtZXNzYWdlOiBzdHJpbmcsIHNwYW4/OiBTcGFuLCBjb250ZW50Pzogc3RyaW5nKTogRXJyb3JOb2RlIHtcbiAgICBsZXQgZmluYWxTcGFuID0gc3BhbiA/PyB0aGlzLnBvaW50U3BhbigpXG4gICAgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2UsIGNvbnRlbnQ6IGNvbnRlbnQgPz8gdGhpcy5zb3VyY2Uuc2xpY2UoZmluYWxTcGFuLnN0YXJ0Lm9mZnNldCwgZmluYWxTcGFuLmVuZC5vZmZzZXQpfSwgZmluYWxTcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvckhlcmUobWVzc2FnZTogc3RyaW5nLCBzdGFydD86IFBvcyk6RXJyb3JOb2RlIHtcbiAgICBsZXQgc3BhbiA9IHRoaXMucGVlaygpPy5zcGFuID8/IHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIHtzdGFydDogc3RhcnQgPz8gc3Bhbi5zdGFydCwgZW5kOiBzcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHdyYXBFcnJvcihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEFTVCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIG5vZGUuc3BhbiwgdGhpcy5zb3VyY2Uuc2xpY2Uobm9kZS5zcGFuLnN0YXJ0Lm9mZnNldCwgbm9kZS5zcGFuLmVuZC5vZmZzZXQpKVxuICB9XG5cbiAgcHJpdmF0ZSBwb2ludFNwYW4oKTogU3BhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4pIHJldHVybiB0b2tlbi5zcGFuXG4gICAgcmV0dXJuIHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGJ1aWxkQXN0TWFwID0gKGFzdDogQVNULCBjb21tZW50czogQ29tbWVudFtdID0gW10pOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9PiB7XG4gIGxldCBtYXhFbmQgPSBjb21tZW50cy5yZWR1Y2UoKG0sIGMpID0+IGMuc3Bhbi5lbmQub2Zmc2V0ID4gbSA/IGMuc3Bhbi5lbmQub2Zmc2V0IDogbSwgYXN0LnNwYW4uZW5kLm9mZnNldClcbiAgbGV0IHJlczogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBBcnJheS5mcm9tKHtsZW5ndGg6IG1heEVuZH0sICgpPT51bmRlZmluZWQpXG4gIGNvbnN0IHdhbGsgPSAobm9kZTogQVNUKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IG5vZGUuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBub2RlLnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBub2RlXG4gICAgY2hpbGRyZW4obm9kZSkuZm9yRWFjaCh3YWxrKVxuICB9XG4gIHdhbGsoYXN0KVxuICBjb21tZW50cy5mb3JFYWNoKGNvbW1lbnQgPT4ge1xuICAgIGZvciAobGV0IGkgPSBjb21tZW50LnNwYW4uc3RhcnQub2Zmc2V0OyBpIDwgY29tbWVudC5zcGFuLmVuZC5vZmZzZXQ7IGkrKykgcmVzW2ldID0gY29tbWVudFxuICB9KVxuICByZXR1cm4gcmVzXG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZSA9IChjb2RlOnN0cmluZyk6IFBhcnNlUmVzdWx0ID0+IHtcbiAgbGV0IHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Z9ID0gdG9rZW5pemUoY29kZSlcbiAgbGV0IGFzdCA9IG5ldyBQYXJzZXIodG9rZW5zLCBjb2RlLCBlb2YpLnBhcnNlKClcbiAgcmV0dXJuIHthc3QsIGNvbW1lbnRzLCBhc3RtYXA6IGJ1aWxkQXN0TWFwKGFzdCwgY29tbWVudHMpfVxufVxuXG5leHBvcnQgY29uc3QgcGFyc2VBU1QgPSAoY29kZTpzdHJpbmcpOiBBU1QgPT4gcGFyc2UoY29kZSkuYXN0XG5cbmV4cG9ydCBjb25zdCBjaGlsZHJlbiA9IChub2RlOiBBU1QpOiBBU1RbXSA9PiB7XG4gIGlmIChub2RlLiQgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFsuLi5ub2RlLmNvbnRlbnQudmFycywgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwiYXBwXCIpIHJldHVybiBbbm9kZS5jb250ZW50LmZuLCAuLi5ub2RlLmNvbnRlbnQuYXJnc11cbiAgaWYgKG5vZGUuJCA9PT0gXCJsZXRcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQudmFyLCBub2RlLmNvbnRlbnQudmFsdWUsIG5vZGUuY29udGVudC5ib2R5XVxuICBpZiAobm9kZS4kID09PSBcInJlY29yZFwiKSByZXR1cm4gbm9kZS5jb250ZW50LmZsYXRNYXAoKFtrZXksIHZhbHVlXSkgPT4gW2tleSwgdmFsdWVdKVxuICByZXR1cm4gW11cbn1cblxuY29uc3Qgc3RyaXBTcGFucyA9IChhc3Q6IEFTVCk6IHVua25vd24gPT4ge1xuICBpZiAoYXN0LiQgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge3ZhcnM6IGFzdC5jb250ZW50LnZhcnMubWFwKHN0cmlwU3BhbnMpLCBib2R5OiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmJvZHkpfX1cbiAgaWYgKGFzdC4kID09PSBcImFwcFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7Zm46IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuZm4pLCBhcmdzOiBhc3QuY29udGVudC5hcmdzLm1hcChzdHJpcFNwYW5zKX19XG4gIGlmIChhc3QuJCA9PT0gXCJsZXRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge3Zhcjogc3RyaXBTcGFucyhhc3QuY29udGVudC52YXIpLCB2YWx1ZTogc3RyaXBTcGFucyhhc3QuY29udGVudC52YWx1ZSksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwicmVjb3JkXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50Lm1hcCgoW25hbWUsIHZhbHVlXSkgPT4gW3N0cmlwU3BhbnMobmFtZSksIHN0cmlwU3BhbnModmFsdWUpXSl9XG4gIGlmIChhc3QuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbiAgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnR9XG59XG5cblxubGV0IHN0cmluZ2lmeSA9ICh4OiB1bmtub3duKSA9PiBKU09OLnN0cmluZ2lmeSh4LCBudWxsLCAyKVxuXG5jb25zdCB0ZXN0X3BhcnNlID0gKGNvZGU6IHN0cmluZywgZXhwZWN0ZWQ6IEFTVCkgPT4ge1xuICBsZXQgYXN0ID0gcGFyc2VBU1QoY29kZSlcblxuICBpZiAoSlNPTi5zdHJpbmdpZnkoc3RyaXBTcGFucyhhc3QpKSAhPT0gSlNPTi5zdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlRlc3QgZmFpbGVkIGZvciBjb2RlOlwiLCBjb2RlKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJFeHBlY3RlZDpcIiwgc3RyaW5naWZ5KHN0cmlwU3BhbnMoZXhwZWN0ZWQpKSlcbiAgICBjb25zb2xlLmVycm9yKFwiR290OlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhhc3QpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRlc3QgZmFpbGVkIGZvciBjb2RlOiAke2NvZGV9YClcbiAgfVxufVxuXG5jb25zdCB0ZXN0X3NwYW4gPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogU3BhbikgPT4ge1xuICBsZXQgYXN0ID0gcGFyc2VBU1QoY29kZSlcbiAgaWYgKEpTT04uc3RyaW5naWZ5KGFzdC5zcGFuKSAhPT0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWQpKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBleHBlY3RlZClcbiAgICBjb25zb2xlLmVycm9yKFwiR290OlwiLCBhc3Quc3BhbilcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmV4cG9ydCBsZXQgbWtudW0gPSAobjogbnVtYmVyKSA9PiBta0FzdChcIm51bWJlclwiLCBuKVxuZXhwb3J0IGxldCBta3N0ciA9IChzOiBzdHJpbmcpID0+IG1rQXN0KFwic3RyaW5nXCIsIHMpXG5leHBvcnQgbGV0IG1rdmFyID0gKG5hbWU6IHN0cmluZykgPT4gbWtBc3QoXCJ2YXJcIiwge25hbWV9KVxuZXhwb3J0IGxldCBta2FwcCA9IChmbjogQVNULCBhcmdzOiBBU1RbXSkgPT4gbWtBc3QoXCJhcHBcIiwge2ZuLCBhcmdzfSlcbmV4cG9ydCBsZXQgbWtsZXQgPSAodjogc3RyaW5nIHwgVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1QpID0+IG1rQXN0KFwibGV0XCIsIHt2YXI6IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2LCB2YWx1ZSwgYm9keX0pXG5leHBvcnQgbGV0IG1rZnVuID0gKHZhcnM6IChzdHJpbmcgfCBWYXIpW10sIGJvZHk6IEFTVCwgZW52PyA6RW52KSA9PiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzOiB2YXJzLm1hcCh2ID0+IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2KSwgYm9keSwgZW52fSkgYXMgRnVuY1xuZXhwb3J0IGxldCBhbm5vdCA9ICh0eXBlOiBBU1QsIHZhbHVlOiBBU1QpID0+IG1rQXN0KFwiYW5ub3RcIiwge3R5cGUsIHZhbHVlfSlcbmV4cG9ydCBsZXQgbWtyZWNvcmQgPSAoZmllbGRzOiB7W2tleSA6IHN0cmluZ10gOiBBU1R9KSA9PiBta0FzdChcInJlY29yZFwiLCBPYmplY3QuZW50cmllcyhmaWVsZHMpLm1hcCgoW2ssdl0pPT4gW21rdmFyKGspLCB2XSkpXG5cbk9iamVjdC5lbnRyaWVzKHtcbiAgXCJ4XCI6IG1rdmFyKFwieFwiKSxcbiAgXCIyMlwiOiBta251bSgyMiksXG4gICdcImhlbGxvXCInOiBta3N0cihcImhlbGxvXCIpLFxuICBcIihmIHgpXCI6IG1rYXBwKG1rdmFyKFwiZlwiKSwgW21rdmFyKFwieFwiKV0pLFxuICBcIihmIHggeSlcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpLCBta3ZhcihcInlcIildKSxcbiAgXCJsZXQgeCA9IDIyIGluIHhcIjogbWtsZXQoXCJ4XCIsIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJ7YTogMjIsIGI6IHh9XCI6IG1rcmVjb3JkKHthOiBta251bSgyMiksIGI6IG1rdmFyKFwieFwiKX0pLFxuICBcImZuIHggPT4geFwiOiBta2Z1bihbXCJ4XCJdLCBta3ZhcihcInhcIikpLFxuICBcImZuIHggeSA9PiB4XCI6IG1rZnVuKFtcInhcIiwgXCJ5XCJdLCBta3ZhcihcInhcIikpLFxuICBcImxldCAobnVtYmVyIHgpID0gMjIgaW4geFwiOiBta2xldChPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiAobnVtYmVyIHgpIChzdHJpbmcgeSkgPT4geFwiOiBta2Z1bihbXG4gICAgT2JqZWN0LmFzc2lnbihta3ZhcihcInhcIiksIHt0eXBlOiBta3ZhcihcIm51bWJlclwiKX0pLFxuICAgIE9iamVjdC5hc3NpZ24obWt2YXIoXCJ5XCIpLCB7dHlwZTogbWt2YXIoXCJzdHJpbmdcIil9KSxcbiAgXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJ7ZToyMn1cIiA6IG1rcmVjb3JkKHtlOiBta251bSgyMil9KSxcbiAgXCJ7ZX1cIjogbWtyZWNvcmQoe2U6IG1rdmFyKFwiZVwiKX0pLFxuICBcIi8vY29tbWVudFxcbjIyXCI6IHBhcnNlQVNUKFwiMjJcIiksXG59KS5mb3JFYWNoKChbY29kZSwgZXhwZWN0ZWRdKSA9PiB0ZXN0X3BhcnNlKGNvZGUsIGV4cGVjdGVkIGFzIEFTVCkpXG5cbk9iamVjdC5lbnRyaWVzKHtcbiAgXCIoXCI6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiLCBjb250ZW50OiBcIihcIn0pLFxuICBcImxldCB4IDIyIGluIHhcIjogbWtBc3QoXCJsZXRcIiwge1xuICAgIHZhcjogbWt2YXIoXCJ4XCIpLFxuICAgIHZhbHVlOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIsIGNvbnRlbnQ6IFwiMjJcIn0pLFxuICAgIGJvZHk6IG1rdmFyKFwieFwiKSxcbiAgfSksXG4gIFwie2U6fVwiOiBta3JlY29yZCh7ZTogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCByZWNvcmQgZmllbGQgdmFsdWUgYWZ0ZXIgJzonXCIsIGNvbnRlbnQ6IFwifVwifSl9KSxcblxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG50ZXN0X3NwYW4oXCJsZXQgeCA9IDIyXFxuaW4geFwiLCB7XG4gIHN0YXJ0OiB7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9LFxuICBlbmQ6IHtvZmZzZXQ6IDE1LCBsaW5lOiAyLCBjb2w6IDV9LFxufSlcbiIsCiAgICAiaW1wb3J0IHsgQVNULCBWYXIgfSBmcm9tIFwiLi9wYXJzZXJcIlxuaW1wb3J0IHtjaGlsZHJlbn0gZnJvbSBcIi4vcGFyc2VyXCJcblxuXG5leHBvcnQgY29uc3QgZ2V0ZGVmID0gKHJvb3Q6IEFTVCwgdmFyaTogVmFyKTogQVNUIHwgdW5kZWZpbmVkID0+IHtcbiAgaWYgKHJvb3Quc3Bhbi5zdGFydC5vZmZzZXQgPiB2YXJpLnNwYW4uc3RhcnQub2Zmc2V0IHx8IHJvb3Quc3Bhbi5lbmQub2Zmc2V0IDwgdmFyaS5zcGFuLmVuZC5vZmZzZXQpIHJldHVybiB1bmRlZmluZWRcbiAgZm9yIChsZXQgY2hpbGQgb2YgY2hpbGRyZW4ocm9vdCkpe1xuICAgIGxldCByZXMgPSBnZXRkZWYoY2hpbGQsIHZhcmkpXG4gICAgaWYgKHJlcykgcmV0dXJuIHJlc1xuICB9XG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJsZXRcIiAmJiByb290LmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgcmV0dXJuIHJvb3QuY29udGVudC52YXJcblxuICBpZiAocm9vdC4kID09PSBcImZ1bmN0aW9uXCIpXG4gICAgZm9yIChsZXQgdiBvZiByb290LmNvbnRlbnQudmFycylcbiAgICAgIGlmICh2LmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgICAgIHJldHVybiB2XG59XG4iLAogICAgImltcG9ydCB7IGNvbG9yT2YgfSBmcm9tIFwiLi9lZGl0b3JcIlxuaW1wb3J0IHsgQVJHLCBib2R5LCBjb2xvciwgZGl2LCBOT0RFLCBwLCBwcmUsIHNwYW4gfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7RW52LCBta251bSwgcHJldHR5RW52LCB0eXBlIEFTVCwgdHlwZSBGdW5jfSBmcm9tIFwiLi9wYXJzZXJcIlxuaW1wb3J0IHtwYXJzZSwgcHJldHR5QVNULCBta3ZhciwgbWthcHAsIG1rZnVuLCBta2xldCwgVmFyfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5cbmV4cG9ydCBsZXQgTlVNQkVSIDogQVNUID0gbWt2YXIoXCJudW1iZXJcIilcbmV4cG9ydCBsZXQgU1RSSU5HIDogQVNUID0gbWt2YXIoXCJzdHJpbmdcIilcbmV4cG9ydCBsZXQgVFlQRSA6IEFTVCA9IG1rdmFyKFwidHlwZVwiKVxuZXhwb3J0IGxldCBUWVBFT0Y6IEFTVCA9IG1rdmFyKFwidHlwZW9mXCIpO1xuXG5OVU1CRVIudHlwZSA9IFRZUEVcblNUUklORy50eXBlID0gVFlQRVxuVFlQRS50eXBlID0gVFlQRVxuVFlQRU9GLnR5cGUgPSBwYXJzZShcImZuIGYgPT4gZm4geCA9PiB0eXBlXCIpLmFzdCFcblxuZXhwb3J0IGxldCBBTlkgOiBBU1QgPSBta3ZhcihcImFueVwiKVxuXG5sZXQgcHJpbWl0aXZlVHlwZSA9IChuYW1lOiBzdHJpbmcpID0+ICh7XG4gIHR5cGU6IFRZUEUsXG4gIGltcGw6ICh4OiBBU1QpID0+IHtcbiAgICBpZiAoeC50eXBlKSB7XG4gICAgICBpZiAoeC50eXBlLiQgPT0gXCJ2YXJcIiAmJiB4LnR5cGUuY29udGVudC5uYW1lID09IG5hbWUpIHJldHVybiB4XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkICR7bmFtZX0sIGdvdCAke3ByZXR0eUFTVCh4LnR5cGUpfWApXG4gICAgfVxuICAgIHgudHlwZSA9IG1rdmFyKG5hbWUpXG4gICAgcmV0dXJuIHhcbiAgfVxufSlcblxubGV0IGJ1aWx0aW5zOiBSZWNvcmQ8c3RyaW5nLCB7IHR5cGU6IEFTVCwgaW1wbDogKC4uLmFyZ3M6QVNUW10pID0+IEFTVCB9PiA9IHtcbiAgbnVtYmVyOiBwcmltaXRpdmVUeXBlKFwibnVtYmVyXCIpLFxuICBzdHJpbmc6IHByaW1pdGl2ZVR5cGUoXCJzdHJpbmdcIiksXG4gIFwiZXFcIjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4IHkgPT4gKG51bWJlciAoZiB4IHkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IG1rbnVtKFxuICAgICAgKHguJCA9PSBcIm51bWJlclwiICYmIHkuJCA9PSBcIm51bWJlclwiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8XG4gICAgICAoeC4kID09IFwic3RyaW5nXCIgJiYgeS4kID09IFwic3RyaW5nXCIgJiYgeC5jb250ZW50ID09IHkuY29udGVudCkgfHwgKHggPT0geSlcbiAgICAgID8gMSA6IDApXG4gIH0sXG4gIFwiYWRkXCI6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGY9PiBmbiB4IHkgPT4gKG51bWJlciAoZiAobnVtYmVyIHgpIChudW1iZXIgeSkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IHtcbiAgICAgIGlmICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIikgcmV0dXJuIG1rbnVtKHguY29udGVudCArIHkuY29udGVudClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBhZGQ6IGV4cGVjdGVkIG51bWJlcnMsIGdvdCAke3ByZXR0eUFTVCh4KX0gYW5kICR7cHJldHR5QVNUKHkpfWApXG4gICAgfVxuICB9LFxuICBcImlmZWxzZVwiIDoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiBUIGNvbmQgdGhlbiBlbHNlID0+IChUIChmIChudW1iZXIgY29uZCkgKFQgdGhlbikgKFQgZWxzZSkpKVwiKS5hc3QhLFxuICAgIGltcGw6IChjb25kLCB0aGVuLCBlbHMpID0+IHtcbiAgICAgIGxldCB2YWwgPSBjb25kLiQgPT0gXCJudW1iZXJcIiA/IGNvbmQuY29udGVudCA6IGNvbmQuJCA9PSBcInN0cmluZ1wiID8gY29uZC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgIHJldHVybiB2YWwgPyB0aGVuIDogZWxzXG4gICAgfVxuICB9LFxuICBcInR5cGVvZlwiOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIHggPT4gdHlwZVwiKS5hc3QhLFxuICAgIGltcGw6ICh4KSA9PiB7XG4gICAgICBpZiAoIXgudHlwZSkgcmV0dXJuIG1rYXBwKFRZUEVPRiwgW3hdKVxuICAgICAgcmV0dXJuIHgudHlwZVxuICAgIH1cbiAgfVxufVxuXG5sZXQgREVCVUcgPSAwXG5cbmxldCBsb2dnZXJQcmUgPSBwcmUoKVxuXG5ib2R5LnJlcGxhY2VDaGlscmVuKGxvZ2dlclByZSlcblxuXG5jb25zdCBhc3RWaWV3ID0gKGFzdDogQVNUKTogTk9ERSA9PiB7XG5cblxuICBsZXQgX3ZpZXcgPSAoYXN0OiBBU1QpOiBOT0RFID0+IHtcbiAgICBsZXQgZWwgPSBzcGFuKClcbiAgICBzd2l0Y2goYXN0LiQpe1xuICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gZWwuYXBwZW5kKFN0cmluZyhhc3QuY29udGVudCkpLnN0eWxlKHtjb2xvcjogY29sb3IuYmx1ZX0pICBcbiAgICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIGVsLmFwcGVuZChhc3QuY29udGVudC5uYW1lKVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBlbC5hcHBlbmQoIGFzdC5jb250ZW50LmVudiA/IHByZXR0eUVudihhc3QuY29udGVudC5lbnYpIDogXCJcIiAsIFwiZm4gKFwiLC4uLmFzdC5jb250ZW50LnZhcnMubWFwKGdvKSxcIikgPT4gXCIpLmFwcGVuZChnbyhhc3QuY29udGVudC5ib2R5KSlcbiAgICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGVsLmFwcGVuZChcIihcIiwgZ28oYXN0LmNvbnRlbnQuZm4pLCBcIiBcIiwgLi4uYXN0LmNvbnRlbnQuYXJncy5tYXAoYXJnPT5nbyhhcmcpKSwgXCIpXCIpXG4gICAgICBjYXNlIFwibGV0XCI6IHJldHVybiBlbC5hcHBlbmQoXCJsZXQgXCIsIGFzdC5jb250ZW50LnZhci5jb250ZW50Lm5hbWUsIFwiID0gXCIsIGdvKGFzdC5jb250ZW50LnZhbHVlKSwgXCIgaW4gXCIsIGdvKGFzdC5jb250ZW50LmJvZHkpKVxuICAgICAgZGVmYXVsdDogcmV0dXJuIGVsLmFwcGVuZChgWyR7YXN0LiR9XWApXG4gICAgfSAgXG4gIH1cblxuICBsZXQgZ28gPSAoYXN0OkFTVCk6IE5PREUgPT4ge1xuICAgIGxldCBlbCA9IHNwYW4oX3ZpZXcoYXN0KSkuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdCksIGN1cnNvcjogXCJwb2ludGVyXCJ9KVxuICAgIC5vbmNsaWNrKGU9PntcbiAgICAgIGVsLnJlcGxhY2VDaGlscmVuKFxuICAgICAgICBzcGFuKFwiVFlQRTpcIikuc3R5bGUoe2NvbG9yOiBjb2xvci5ncmF5fSlcbiAgICAgICAgLm9uY2xpY2soZT0+e1xuICAgICAgICAgIGVsLnJlcGxhY2VDaGlscmVuKF92aWV3KGFzdCkpXG4gICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgICB9KSxcbiAgICAgICAgYXN0LnR5cGUgPyBhc3RWaWV3KGFzdC50eXBlKSA6IFwiKlwiLFxuICAgICAgICBnbyhhc3QpXG4gICAgICApXG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgfSlcbiAgICByZXR1cm4gZWxcbiAgfVxuICByZXR1cm4gZGl2KGdvKGFzdCkpLnN0eWxlKHtwYWRkaW5nOlwiLjRlbVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmdyYXksIGJvcmRlclJhZGl1czogXCIuNGVtXCIsIG1hcmdpbjpcIi40ZW0gMFwifSlcblxufVxuXG5cblxudHlwZSBWaXMgPSBOT0RFfHN0cmluZ3wgdW5kZWZpbmVkIHwgbnVsbCB8IEFTVCB8IFZpc1tdIHwgbnVtYmVyXG5cbmxldCBkZWJ1ZyA9ICguLi5hcmdzOiBWaXNbXSkgPT4ge1xuICBpZiAoIURFQlVHKSByZXR1cm5cbiAgbGV0IHByID0gbG9nZ2VyUHJlXG4gIGZvciAobGV0IGFyZyBvZiBhcmdzKXtcbiAgICBpZiAodHlwZW9mIGFyZyA9PSBcInN0cmluZ1wiIHx8IHR5cGVvZiBhcmcgPT0gXCJudW1iZXJcIikgcHIuYXBwZW5kKFN0cmluZyhhcmcpKVxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkgW1wiW1wiLCAuLi5hcmcsIFwiXVwiXS5mb3JFYWNoKGE9PiBkZWJ1ZyhhKSlcbiAgICBlbHNlIGlmIChhcmcgPT09IHVuZGVmaW5lZCB8fCBhcmcgPT09IG51bGwpIHByLmFwcGVuZChzcGFuKFN0cmluZyhhcmcpKS5zdHlsZSh7Y29sb3I6IGNvbG9yLmdyYXl9KSlcbiAgICBlbHNlIGlmIChcIiRcIiBpbiBhcmcpe1xuICAgICAgaWYgKGFyZy4kID09IFwiTk9ERVwiKSBwci5hcHBlbmQoYXJnKVxuICAgICAgZWxzZSBwci5hcHBlbmQoYXN0VmlldyhhcmcpKVxuICAgIH1cbiAgfVxufVxuXG5sZXQgZGVidWdDYWxsID0gPEFSR1MgZXh0ZW5kcyBhbnlbXSwgVD4gKGZuOiAoLi4uYXJnczogQVJHUykgPT4gVCkgPT4gKC4uLmFyZ3M6IEFSR1MpIDogVCA9PiB7XG4gIGRlYnVnKFwiQCBcIiwgZm4ubmFtZSwgLi4uYXJncylcbiAgbGV0IG9sZHByZSA9IGxvZ2dlclByZVxuICBsZXQgY2FsbHByZSA9IHByZSgpLnN0eWxlKHtib3JkZXJMZWZ0OiBcIjRweCBzb2xpZCBcIitjb2xvci5ncmF5LCBtYXJnaW5MZWZ0OiBcIjhweFwiLCBwYWRkaW5nTGVmdDogXCI4cHhcIn0pXG4gIGxvZ2dlclByZS5hcHBlbmQoY2FsbHByZSlcbiAgbG9nZ2VyUHJlID0gY2FsbHByZVxuICBsZXQgcmVzID0gZm4oLi4uYXJncylcbiAgbG9nZ2VyUHJlID0gb2xkcHJlXG4gIGRlYnVnKHJlcyBhcyBhbnkpXG4gIHJldHVybiByZXNcbn1cblxuXG5leHBvcnQgY29uc3QgcnVuID0gKGFzdDogQVNUKTogQVNUID0+IHtcblxuICBsZXQgbG9va3VwID0gKG5hbWU6IHN0cmluZywgZW52OiBFbnYpOiB7YmluZGVyOiBWYXIsIHZhbHVlOiBBU1R9IHwgbnVsbCA9PiB7XG4gICAgaWYgKCFlbnYpIHJldHVybiBudWxsXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZW52KSkgcmV0dXJuIGxvb2t1cChuYW1lLCBlbnZbMF0pIHx8IGxvb2t1cChuYW1lLCBlbnZbMV0pXG4gICAgaWYgKGVudi5iaW5kZXIuY29udGVudC5uYW1lID09PSBuYW1lKSByZXR1cm4gZW52XG4gICAgcmV0dXJuIGxvb2t1cChuYW1lLCBlbnYubmV4dClcbiAgfVxuXG4gIGxldCBmcmVlbmFtZSA9IChlbnY6RW52KTpzdHJpbmc9PntcbiAgICBsZXQgbiA9IDBcbiAgICB3aGlsZShsb29rdXAoYHgke259YCwgZW52KSkgbisrXG4gICAgcmV0dXJuIGB4JHtufWBcbiAgfVxuICBsZXQgYmluZCA9IChlbnY6IEVudiwgYmluZGVyOiBWYXIsIHZhbHVlOiBBU1QpOiBFbnYgPT4gKHtiaW5kZXIsIHZhbHVlLCBuZXh0OiBlbnZ9KVxuICBsZXQgYmluZFZhbHVlID0gKGVudjogRW52LCBiaW5kZXI6IFZhciwgdmFsdWU6IEFTVCwgaW5mZXIgPSBmYWxzZSk6IEVudiA9PiB7XG5cbiAgICBpZiAoYmluZGVyLnR5cGUpXG4gICAgICBpZiAodmFsdWUudHlwZSAmJiBwcmV0dHlBU1QoYmluZGVyLnR5cGUpICE9IHByZXR0eUFTVCh2YWx1ZS50eXBlISkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBsZXQ6IGV4cGVjdGVkICR7cHJldHR5QVNUKGJpbmRlci50eXBlKX0sIGdvdCAke3ByZXR0eUFTVCh2YWx1ZS50eXBlISl9YClcbiAgICBlbHNlIGJpbmRlci50eXBlID0gdmFsdWUudHlwZVxuICAgIHJldHVybiBiaW5kKGVudiwgYmluZGVyLCB2YWx1ZSlcblxuICB9XG5cbiAgbGV0IGFubm90ID0gKGFzdDogQVNULCB0eXBlPzogQVNUKTogQVNUID0+IHtcbiAgICBpZiAodHlwZSA9PSB1bmRlZmluZWQpIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBhbm5vdGF0ZSB3aXRoIHVuZGVmaW5lZCB0eXBlXCIpXG4gICAgaWYgKGFzdC50eXBlICYmIHByZXR0eUFTVChhc3QudHlwZSkgIT0gcHJldHR5QVNUKHR5cGUpKSB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkICR7cHJldHR5QVNUKHR5cGUpfSwgZ290ICR7cHJldHR5QVNUKGFzdC50eXBlKX1gKVxuICAgIGFzdC50eXBlID0gdHlwZVxuICAgIHJldHVybiBhc3RcbiAgfVxuXG4gIGxldCBnbyA9IChhc3Q6IEFTVCwgZW52OiBFbnYpOiBBU1QgPT4ge1xuXG4gICAgaWYgKGVudikgZGVidWcocHJldHR5RW52KGVudikpXG4gICAgbGV0IGNhbGwgPSAoZm4gOiBBU1QsIGFyZ3M6IEFTVFtdICk6IEFTVCA9PntcbiAgICAgIGlmIChmbi4kID09IFwidmFyXCIgJiYgYnVpbHRpbnNbZm4uY29udGVudC5uYW1lXSkgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpXG4gICAgICBpZiAoZm4uJCA9PSBcImZ1bmN0aW9uXCIpe1xuICAgICAgICBpZiAoZm4uY29udGVudC52YXJzLmxlbmd0aCAhPT0gYXJncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtmbi5jb250ZW50LnZhcnMubGVuZ3RofSBhcmd1bWVudHMsIGdvdCAke2FyZ3MubGVuZ3RofWApXG4gICAgICAgIGlmIChmbi5jb250ZW50LmVudiA9PT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoXCJGdW5jdGlvbiBoYXMgbm8gZW52aXJvbm1lbnRcIilcbiAgICAgICAgcmV0dXJuIGdvKFxuICAgICAgICAgIGZuLmNvbnRlbnQuYm9keSxcbiAgICAgICAgICBmbi5jb250ZW50LnZhcnMucmVkdWNlKChlbnYsIHYsIGkpID0+IGJpbmRWYWx1ZShlbnYsIHYsIGFyZ3NbaV0sIHRydWUpLCBmbi5jb250ZW50LmVudiBhcyBFbnYpXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHJldHVybiBta2FwcChmbixhcmdzKVxuICAgIH1cbiAgICBjYWxsID0gZGVidWdDYWxsKGNhbGwpXG5cbiAgICBzd2l0Y2goYXN0LiQpe1xuICAgICAgY2FzZSBcIm51bWJlclwiOiByZXR1cm4gYW5ub3QoYXN0LCBOVU1CRVIpXG4gICAgICBjYXNlIFwic3RyaW5nXCI6IHJldHVybiBhbm5vdChhc3QsIFNUUklORylcblxuICAgICAgY2FzZSBcInZhclwiOiB7XG4gICAgICAgIGlmIChidWlsdGluc1thc3QuY29udGVudC5uYW1lXSkgYW5ub3QoYXN0LCBidWlsdGluc1thc3QuY29udGVudC5uYW1lXS50eXBlKVxuICAgICAgICBsZXQgaGl0ID0gbG9va3VwKGFzdC5jb250ZW50Lm5hbWUsIFtlbnYsIHtiaW5kZXI6IGFzdCAsdmFsdWU6IGFzdCwgbmV4dDogbnVsbH1dKSFcbiAgICAgICAgaWYgKGhpdC5iaW5kZXIudHlwZSkgYW5ub3QoYXN0LCBoaXQuYmluZGVyLnR5cGUpXG4gICAgICAgIHJldHVybiBoaXQudmFsdWVcblxuICAgICAgfVxuICAgICAgY2FzZSBcImxldFwiOiB7XG4gICAgICAgIGxldCB2YWx1ZSA9IGdvKGFzdC5jb250ZW50LnZhbHVlLCBlbnYpXG4gICAgICAgIGFubm90KGFzdC5jb250ZW50LnZhciwgdmFsdWUudHlwZSEpXG4gICAgICAgIGxldCByZXMgPSBnbyhhc3QuY29udGVudC5ib2R5LCBiaW5kVmFsdWUoZW52LCBhc3QuY29udGVudC52YXIsIHZhbHVlLCB0cnVlKSlcbiAgICAgICAgYW5ub3QoYXN0LCByZXMudHlwZSlcbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6e1xuICAgICAgICBpZiAoYXN0LmNvbnRlbnQuZW52ID09IHVuZGVmaW5lZCkgYXN0LmNvbnRlbnQuZW52ID0gZW52XG4gICAgICAgIGxldCBydW5ib2QgPSBjYWxsKGFzdCwgYXN0LmNvbnRlbnQudmFycylcbiAgICAgICAgbGV0IGZ2YXIgPSBta3ZhcihmcmVlbmFtZShlbnYpKVxuICAgICAgICBsZXQgZnR5cGUgPSBta2Z1bihbZnZhcl0sIG1rZnVuKGFzdC5jb250ZW50LnZhcnMsIHJ1bmJvZCkpXG4gICAgICAgIHJldHVybiBhbm5vdChta2Z1bihhc3QuY29udGVudC52YXJzLCBydW5ib2QsIGFzdC5jb250ZW50LmVudiksIGZ0eXBlKVxuICAgICAgfVxuXG4gICAgICBjYXNlIFwiYXBwXCI6IHtcbiAgICAgICAgbGV0IGZuID0gZ28oYXN0LmNvbnRlbnQuZm4sIGVudilcbiAgICAgICAgbGV0IGFyZ3MgPSBhc3QuY29udGVudC5hcmdzLm1hcChhcmcgPT4gZ28oYXJnLCBlbnYpKVxuICAgICAgICBsZXQgcmVzID0gY2FsbChmbiwgYXJncylcbiAgICAgICAgaWYgKHJlcy50eXBlKSBhbm5vdChhc3QsIHJlcy50eXBlKVxuICAgICAgICByZXR1cm4gcmVzXG4gICAgICB9XG4gICAgICBkZWZhdWx0OiByZXR1cm4gYXN0XG4gICAgfVxuICB9XG5cbiAgZ28gPSBkZWJ1Z0NhbGwoZ28pXG4gIHJldHVybiBnbyhhc3QsIG51bGwpXG59XG5cblxuLy8gbGV0IEYgPSAoeDpudW1iZXIsIHk6c3RyaW5nKSA9PiB4XG4vLyB0eXBlIGFyZyA9IHR5cGVvZiBGIGV4dGVuZHMgKC4uLmFyZ3M6IGluZmVyIEEpID0+IGFueSA/IEEgOiBuZXZlclxuXG5cbkRFQlVHID0gMVxuXG5cbmxldCBhc3QgPSBwYXJzZSgnKGZuIHggPT4gZm4geSA9PiB4IDMpJykuYXN0XG5sZXQgcmVzID0gcnVuKGFzdCEpXG5cblxuXG5ERUJVRyA9IDBcblxuXG4vLyBsZXQgc2FtcGxlcyA9IFtcbi8vICAgXCIyMiB8IG51bWJlciB8IDIyXCIsXG4vLyAgICdsZXQgeCA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4vLyAgICdsZXQgKG51bWJlciB4KSA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4vLyAgICdmbiB4ID0+IHggfCBmbiB4MCA9PiBmbiB4ID0+ICh0eXBlb2YgeCknLFxuLy8gICAnKG51bWJlciAyMikgfCBudW1iZXIgfCAyMicsXG4vLyAgICdmbiAobnVtYmVyIHgpID0+IHggfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlciB8IGZuIChudW1iZXIgeCkgPT4geCcsXG4vLyAgICdmbiB4ID0+IChudW1iZXIgeCkgfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlcicsXG4vLyAgICcoZm4geCA9PiB4IDIyKSB8IG51bWJlcicsXG4vLyAgICcoZm4gKG51bWJlciB4KSA9PiB4IDIyKSB8IG51bWJlcicsXG4vLyAgICcoZm4gKHN0cmluZyB4KSA9PiB4IDIyKSB8IGVycm9yJyxcbi8vICAgJ2xldCBpZCA9IGZuIHggPT4geCBpbiBmbiB5ID0+IChpZCB5KSB8IGZuIHgwID0+IGZuIHkgPT4gKHR5cGVvZiB5KSB8IGZuIHkgPT4geScsXG4vLyAgICdmbiAobnVtYmVyIHgpID0+IChzdHJpbmcgeCkgfCBlcnJvcicsXG4vLyAgICdmbiB4ID0+IGZuIHkgPT4geSB8IGZuIHgwID0+IGZuIHggPT4gZm4geDAgPT4gZm4geSA9PiAodHlwZW9mIHkpJyxcbi8vICAgJ2ZuIHggPT4gZm4geSA9PiB4IHwgZm4geDAgPT4gZm4geCA9PiBmbiB4MCA9PiBmbiB5ID0+ICh0eXBlb2YgeCknLFxuLy8gICAnKGZuIHg9PiBmbiB5ID0+IHggMykgfCBmbiB4MCA9PiBmbiB5ID0+IG51bWJlcicsXG4vLyAgICcoKGZuIHg9PiBmbiB5PT4geCAzKSAyKSB8IG51bWJlciB8IDMnXG5cbi8vIF0ubWFwKGNvZGUgPT4gY29kZS5zcGxpdChcInxcIikubWFwKHMgPT4gcy50cmltKCkpKVxuXG5cbi8vIGxldCByZXN1bHRzID0gdGFibGUoKS5zdHlsZSh7XG4vLyAgIHdpZHRoOiBcIjEwMCVcIixcbi8vICAgd2hpdGVTcGFjZTogXCJwcmVcIixcbi8vIH0pXG5cblxuXG5cbi8vIGZvciAobGV0IFtjb2RlLCBleHBlY3RlZFR5cGUsIGV4cGVjdGVkUmVzdWx0XSBvZiBzYW1wbGVzKXtcblxuLy8gICBsZXQgYXN0ID0gcGFyc2UoY29kZSlcbi8vICAgbGV0IHJlcyA6IEFTVCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXG4vLyAgIGxldCBlcnJtZXNzYWdlOiBzdHJpbmcgPSBcIlwiXG4vLyAgIHRyeXsgcmVzID0gcnVuKGFzdC5hc3QpXG4vLyAgIH0gY2F0Y2goZSkge1xuLy8gICAgIGVycm1lc3NhZ2UgPSBTdHJpbmcoZSlcbi8vICAgICBpZiAoZXhwZWN0ZWRUeXBlICE9IFwiZXJyb3JcIikgY29uc29sZS5lcnJvcihgRXJyb3IgcnVubmluZyBjb2RlOiAke2NvZGV9XFxuYCwgZSlcbi8vICAgfVxuXG4vLyAgIGxldCB0eXBlU3RyID0gcmVzID8gcmVzLnR5cGUgPyBwcmV0dHlBU1QocmVzLnR5cGUpIDogXCJubyB0eXBlXCIgOiBcImVycm9yXCJcbi8vICAgbGV0IHJlc1N0ciA9IHJlcyA/IHByZXR0eUFTVChyZXMpIDogXCJlcnJvclwiXG4vLyAgIGxldCBjaGVjayA9ICh0eXBlU3RyID09IChleHBlY3RlZFR5cGUgPz8gdHlwZVN0cikgJiYgcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpKVxuXG4vLyAgIHR5cGVTdHIgPSB0eXBlU3RyID09IFwiZXJyb3JcIiA/IGVycm1lc3NhZ2UgOiB0eXBlU3RyXG4vLyAgIHJlc1N0ciA9IHJlc1N0ciA9PSBcImVycm9yXCIgPyBlcnJtZXNzYWdlIDogcmVzU3RyXG5cbi8vICAgaWYgKCFjaGVjaykge1xuLy8gICAgIHJlc3VsdHMuYXBwZW5kKFxuLy8gICAgICAgdHIoXG4vLyAgICAgICAgIHRkKGNvZGUpLFxuLy8gICAgICAgICB0ZCh0eXBlU3RyKS5zdHlsZSh7Y29sb3I6IHR5cGVTdHIgPT0gKGV4cGVjdGVkVHlwZSA/PyB0eXBlU3RyKSA/IFwiZ3JlZW5cIiA6IFwicmVkXCIsIHBhZGRpbmc6IFwiMCA4cHhcIn0pLFxuLy8gICAgICAgICB0ZChyZXNTdHIpLnN0eWxlKHtjb2xvcjogcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpID8gXCJncmVlblwiIDogXCJyZWRcIn0pXG4vLyAgICAgICApXG4vLyAgICAgICAuc3R5bGUoe2JvcmRlckJvdHRvbTogXCIxcHggc29saWQgXCIrY29sb3IuY29sb3IsfSlcbi8vICAgICApXG4vLyAgICAgYm9keS5hcHBlbmQoZGl2KHJlc3VsdHMpXG4vLyAgICAgLnN0eWxlKHtcbi8vICAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsXG4vLyAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuLy8gICAgICAgcGFkZGluZzogXCIxNnB4XCIsXG4vLyAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4vLyAgICAgfSkpXG4vLyAgIH1cbi8vIH0gICAgXG5cblxuXG4iLAogICAgIlxuXG5cblxuaW1wb3J0IHsgYm9keSwgaHRtbCwgc3BhbiAsIGZyb21IVE1MLCBoMiwgZGl2fSBmcm9tIFwiLi9odG1sXCI7XG5pbXBvcnQgeyBlZGl0b3IgfSBmcm9tIFwiLi9lZGl0b3JcIjtcbmltcG9ydCB7IHBhcnNlLCBwcmV0dHlBU1QsIHR5cGUgQVNULCB0eXBlIFNwYW4sIHR5cGUgU3ludGF4Tm9kZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgZ2V0ZGVmIH0gZnJvbSBcIi4vbHNwXCJcbmltcG9ydCB7IHJ1biwgQU5ZIH0gZnJvbSBcIi4vcnVudGltZVwiXG5pbXBvcnQgeyBjb2xvciB9IGZyb20gXCIuL2h0bWxcIjtcblxuXG5cbmNvbnN0IGFib3V0X3RleHQgPSBgXG5cbi8vIFRoaXMgaXMgYSB0b3kgY29kZSBlZGl0b3Igc3RpbGwgaW4gZGV2ZWxvcG1lbnQuXG5cbi8vIHRoZSBnb2FsIGlzIHRvIGJ1aWxkIGEgbGFuZ3VhZ2Ugd2l0aDpcblxuLy8gZXh0cmVtZWx5IG1pbmltYWwgc3ludGF4XG4vLyBmaXJzdCBjbGFzcyBzdXBwb3J0IGZvciB0eXBlcyBhcyB2YWx1ZXNcbi8vIGZpcnN0IGNhc3MgTFNQIHByb2dyYW1uZyBpbiBhIHN0cmFpZ2h0Zm9yd2FyZCB3YXkuXG5cbi8vIGhvdmVyIG92ZXIgeCB0byBzZWUgaXRzIGluZmVycmVkIHR5cGVcbmxldCBuID0gMjIgaW5cblxuLy8gdGhpcyBpcyBob3cgdHlwZXMgYXJlIGFubm90YXRlZC4gdHlwZXMgYXJlIGVzc2VudGlhbGx5IGp1c3QgZnVuY3Rpb25zIG92ZXIgdmFsdWVzLlxubGV0IGsgPSAobnVtYmVyIDMzKSBpblxubGV0IHUgPSAoc3RyaW5nIFwiaGxsb1wiKSBpblxuXG4vLyB1bnR5cGVkIGlkXG5sZXQgaWQgPSBmbiB4ID0+IHggaW5cblxuLy8gbnVtYmVyIHR5cGVkIGlkXG5sZXQgaWRuID0gZm4geCA9PiAobnVtYmVyIHgpIGluXG5cbi8vIHR5cGUgb2YgbnVtYmVyIC0+IG51bWJlclxubGV0IFQgPSBmbiBmID0+IGZuIChudW1iZXIgeCkgPT4gKG51bWJlciAoZiB4KSkgaW5cblxubGV0IF9pZCA9IChUIGlkKSBpblxuXG4vL2xldCBiYWQgPSAoX2lkIFwiZVwiKSBpblxuXG5sZXQgciA9IChpZCBcIjJcIikgaW5cblxuLy8gdGhpcyBpcyB3aWxsIHJlc3VsdCBpbiB0eXBlIGVycm9yLlxuLy8gbGV0IEJBRCA9IChpZG5fIFwiMlwiKSBpblxuXG4obnVtYmVyIHN0KVxuYFxuXG5cblxuXG5sZXQgb3V0dmlldyA9IGh0bWwoJ3ByZScpKCkuc3R5bGUoe1xuICBib3JkZXJUb3A6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICBwYWRkaW5nVG9wOiBcIjE2cHhcIixcbn0pXG5cbmxldCBhc3Q6IEFTVCB8IHVuZGVmaW5lZFxubGV0IGN1cnJlbnRBc3RNYXA6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gW11cblxuXG5sZXQgY29kZTpzdHJpbmcgPSAnJ1xuXG5sZXQgRWRpdCA9IGVkaXRvcihcbiAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJsaW5lc1wiKSA/PyBhYm91dF90ZXh0LFxuICBzPT4ge1xuICAgIHRyeXtcbiAgICAgIGxldCBwYXJzZWQgPSBwYXJzZShzKVxuICAgICAgYXN0ID0gcGFyc2VkLmFzdFxuICAgICAgY3VycmVudEFzdE1hcCA9IHBhcnNlZC5hc3RtYXBcbiAgICAgIGNvZGUgPSBzXG4gICAgICBsZXQgcmVzID0gcnVuKGFzdClcbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBwcmV0dHlBU1QocmVzKVxuXG4gICAgfWNhdGNoKGUpe1xuICAgICAgYXN0ID0gdW5kZWZpbmVkXG4gICAgICBjdXJyZW50QXN0TWFwID0gW11cbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSlcbiAgICB9XG4gIH0sXG4gICgpPT4gY3VycmVudEFzdE1hcCxcbiAgKHJlcSkgPT4ge1xuICAgIGxldCBkZWYgPSByZXEuJCA9PSBcInZhclwiID8gZ2V0ZGVmKGFzdCEsIHJlcSkgOiB1bmRlZmluZWRcbiAgICBpZiAoZGVmKSBFZGl0LnNldEN1cnNvcih7cm93OiBkZWYuc3Bhbi5zdGFydC5saW5lLTEsIGNvbDogZGVmLnNwYW4uc3RhcnQuY29sLTF9KVxuICB9LFxuICAobm9kZSkgPT4ge1xuICAgIGlmIChub2RlLiQgPT09IFwiY29tbWVudFwiKSByZXR1cm4gWycnLCBbXV1cblxuICAgIGxldCBzdHIgPSAobm9kZS4kICsgXCI6IFwiKVxuICAgIGxldCBtYXAgOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IHN0ci5zcGxpdCgnJykubWFwKGM9PiB1bmRlZmluZWQpXG5cbiAgICBsZXQgYXN0OkFTVCA9IG5vZGUudHlwZSA/IG5vZGUudHlwZSA6IEFOWVxuXG4gICAgbGV0IGNvID0gcHJldHR5QVNUKGFzdClcbiAgICBtYXAucHVzaCguLi5wYXJzZShjbykuYXN0bWFwKVxuICAgIHN0ciArPSBjb1xuXG4gICAgcmV0dXJuIFtzdHIsIG1hcF1cbiAgfVxuKVxuXG5cblxuXG5ib2R5LnN0eWxlKHtwYWRkaW5nOiBcIjQ0cHhcIixmb250RmFtaWx5OiBcInNhbnMtc2VyaWZcIix9KVxuXG5cbmxldCBidXR0biA9ICh0OnN0cmluZywgb25DbGljazooKSA9PiB2b2lkKSA9PiBzcGFuKHQsIG9uQ2xpY2spLnN0eWxlKHtjb2xvcjogXCJncmF5XCIsIGJvcmRlcjogXCIxcHggc29saWQgZ3JheVwiLCBib3JkZXJSYWRpdXM6IFwiNHB4XCIsIHBhZGRpbmc6IFwiMnB4IDRweFwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pXG5cbmJvZHkuYXBwZW5kKFxuICBkaXYoXG4gICAgc3Bhbign4pyI77iOJykuc3R5bGUoe2ZvbnRTaXplOiBcIjNlbVwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pLFxuICAgIHNwYW4oXCJNaUdcIikuc3R5bGUoe2ZvbnRTaXplOiBcIjEuNWVtXCIsIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLCBmb250RmFtaWx5OiBcIm1vbm9zcGFjZVwifSlcbiAgKS5zdHlsZSh7ZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIxNnB4XCIsIGNvbG9yOiBcImdyYXlcIn0pLFxuXG4gIEVkaXQuZWwsXG4gIG91dHZpZXcsXG4gIGJ1dHRuKFwiYWJvdXRcIiwgKCkgPT4gRWRpdC5zZXRUZXh0KGFib3V0X3RleHQpKSxcbiAgYnV0dG4oXCJnaXRodWJcIiwgKCkgPT4gd2luZG93Lm9wZW4oXCJodHRwczovL2dpdGh1Yi5jb20vZGtvcm1hbm4vbXllZGl0b3JcIikpXG4pXG5cblxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQWNPLElBQU0sT0FBTyxDQUF5QyxRQUFVLElBQUksYUFBb0Q7QUFBQSxFQUM3SCxJQUFJLFVBQVUsU0FBUyxLQUFLLE9BQUssT0FBTyxNQUFNLFVBQVU7QUFBQSxFQUN4RCxJQUFJLEtBQUssU0FBVSxTQUFTLGNBQWMsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFJLFNBQVMsT0FBTyxPQUFLLE9BQU8sTUFBTSxVQUFVLENBQXNCO0FBQUEsRUFDN0gsSUFBSTtBQUFBLElBQVMsR0FBRyxHQUFJLFVBQVc7QUFBQSxFQUUvQixPQUFPO0FBQUE7QUFJRixJQUFNLFdBQVksQ0FBMEIsT0FBbUI7QUFBQSxFQUVwRSxJQUFJLE9BQWlCO0FBQUEsSUFDbkIsR0FBRztBQUFBLElBQ0g7QUFBQSxJQUNBLFFBQVEsSUFBSSxhQUE4QjtBQUFBLE1BQ3hDLFNBQVMsUUFBUSxXQUFTO0FBQUEsUUFDeEIsSUFBSSxPQUFPLFVBQVU7QUFBQSxVQUFVLEdBQUcsWUFBWSxTQUFTLGVBQWUsS0FBSyxDQUFDO0FBQUEsUUFDdkU7QUFBQSxhQUFHLFlBQVksTUFBTSxFQUFFO0FBQUEsT0FDN0I7QUFBQSxNQUNELE9BQU87QUFBQTtBQUFBLElBRVQsU0FBUyxDQUFDLE1BQTZCO0FBQUEsTUFDckMsR0FBRyxVQUFVO0FBQUEsTUFDYixPQUFPO0FBQUE7QUFBQSxJQUVULGdCQUFnQixJQUFJLGFBQThCO0FBQUEsTUFDaEQsR0FBRyxnQkFBZ0I7QUFBQSxNQUNuQixPQUFPLEtBQUssT0FBTyxHQUFHLFFBQVE7QUFBQTtBQUFBLElBRWhDLE9B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QUFBLElBQUc7QUFBQSxHQUFTO0FBQUEsRUFFdEUsSUFBSSxPQUFVLEtBQUssT0FBTyxLQUFLLE9BQU87QUFBQSxFQUV0QyxJQUFJLEtBQUssVUFBVSxJQUFHO0FBQUEsRUFDdEIsSUFBSSxLQUFLLEdBQUcsTUFBTSxFQUFFLEVBQUUsTUFBTTtBQUFBLEVBQzVCLE9BQU87QUFBQSxFQUVQLE9BQU8sQ0FBQyxLQUFLLEdBQUc7QUFBQSxDQUVwQjtBQUtBLEtBQUssTUFBTSxFQUFDLFNBQVMsUUFBTyxZQUFZLGFBQWEsQ0FBQztBQUd0RCxJQUFJLFFBQVEsQ0FBQyxHQUFVLFlBQXVCLEtBQUssR0FBRyxPQUFPLEVBQUUsTUFBTSxFQUFDLE9BQU8sUUFBUSxRQUFRLGtCQUFrQixjQUFjLE9BQU8sU0FBUyxXQUFXLGFBQWEsTUFBSyxDQUFDO0FBRTNLLEtBQUssT0FDSCxJQUNFLEtBQUssSUFBRyxFQUFFLE1BQU0sRUFBQyxVQUFVLE9BQU8sYUFBYSxNQUFLLENBQUMsR0FDckQsS0FBSyxLQUFLLEVBQUUsTUFBTSxFQUFDLFVBQVUsU0FBUyxZQUFZLFFBQVEsWUFBWSxZQUFXLENBQUMsQ0FDcEYsRUFBRSxNQUFNLEVBQUMsU0FBUyxRQUFRLFlBQVksVUFBVSxjQUFjLFFBQVEsT0FBTyxPQUFNLENBQUMsR0FFcEYsS0FBSyxJQUNMLFNBQ0EsTUFBTSxTQUFTLE1BQU0sS0FBSyxRQUFRLFVBQVUsQ0FBQyxHQUM3QyxNQUFNLFVBQVUsTUFBTSxPQUFPLEtBQUssc0NBQXNDLENBQUMsQ0FDM0U7IiwKICAiZGVidWdJZCI6ICI4QkNCOUU3NDFEM0Y3NkE2NjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
