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
      return `fn ${node.content.vars.map(prettyBinder).join(" ")} => ${prettyAST(node.content.body)}`;
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
var mkfun = (vars, body2) => mkAst("function", { vars: vars.map((v) => typeof v === "string" ? mkvar(v) : v), body: body2 });
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
      throw new Error(`Type error: expected ${name}, got ${x.type}`);
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
        return el.append("fn (", ...ast2.content.vars.map(go), ") => ").append(go(ast2.content.body));
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
astView = debugCall(astView);
var evaluate = (term, env) => {
  switch (term.$) {
    case "var": {
      if (env[term.content.name])
        return env[term.content.name];
      return term;
    }
    case "function":
      return mkAst("function", { ...term.content, env });
    case "app":
      return apply(evaluate(term.content.fn, env), term.content.args.map((arg) => evaluate(arg, env)));
    case "let":
      return evaluate(term.content.body, { ...env, [term.content.var.content.name]: evaluate(term.content.value, env) });
    case "number":
    case "string":
      return term;
  }
  throw new Error(`Cannot evaluate term of type ${term.$}`);
};
var apply = (fn, args) => {
  if (fn.$ == "function") {
    if (fn.content.vars.length != args.length)
      throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`);
    let env = { ...fn.content.env };
    fn.content.vars.forEach((v, i) => env[v.content.name] = args[i]);
    return evaluate(fn.content.body, env);
  }
  return mkAst("Napp", { fn, args });
};
var readback = (val) => {
  if (val.$ == "function")
    return mkfun(val.content.vars, readback(apply(val, val.content.vars)));
  if (val.$ == "Napp")
    return mkapp(readback(val.content.fn), val.content.args.map(readback));
  return val;
};
var run = (ast) => readback(evaluate(ast, {}));
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

//# debugId=9CD8063FAC5D790164756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCk9PiBOT0RFLFxuICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IE5PREU8SD4sXG4gIGFzc2lnbjogKGh0bWxQcm9wczogUGFydGlhbDxIVE1MRWxlbWVudD4pID0+IE5PREVcbn1cblxuZXhwb3J0IHR5cGUgQVJHID0gTk9ERSB8IHN0cmluZyB8ICgoZTpNb3VzZUV2ZW50KT0+dm9pZClcblxuZXhwb3J0IGNvbnN0IGh0bWwgPSA8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4gKHRhZzpLKSA9PiAoLi4uY2hpbGRyZW46QVJHW10pOiBOT0RFIDxIVE1MRWxlbWVudFRhZ05hbWVNYXBbS10+ID0+IHtcbiAgbGV0IG9uY2xpY2sgPSBjaGlsZHJlbi5maW5kKGMgPT4gdHlwZW9mIGMgPT09IFwiZnVuY3Rpb25cIikgYXMgRnVuY3Rpb25cbiAgbGV0IGVsID0gZnJvbUhUTUwgKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSkuYXBwZW5kKC4uLiBjaGlsZHJlbi5maWx0ZXIoYyA9PiB0eXBlb2YgYyAhPT0gXCJmdW5jdGlvblwiKSBhcyAoTk9ERSB8IHN0cmluZylbXSkgYXMgTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPjtcbiAgaWYgKG9uY2xpY2spIGVsLmVsLiBvbmNsaWNrID0gKG9uY2xpY2sgYXMgKGU6TW91c2VFdmVudCk9PnZvaWQpXG4gIFxuICByZXR1cm4gZWxcbn1cblxuXG5leHBvcnQgY29uc3QgZnJvbUhUTUwgID0gPEggZXh0ZW5kcyBIVE1MRWxlbWVudD4gIChlbDpIKTogTk9ERSA8SD4gPT4ge1xuXG4gIGxldCBub2RlIDogTk9ERTxIPiA9IHtcbiAgICAkOiBcIk5PREVcIixcbiAgICBlbCxcbiAgICBhcHBlbmQ6ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBjaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gXCJzdHJpbmdcIikgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpKTtcbiAgICAgICAgZWxzZSBlbC5hcHBlbmRDaGlsZChjaGlsZC5lbCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG4gICAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCkgPT4ge1xuICAgICAgZWwub25jbGljayA9IGZcbiAgICAgIHJldHVybiBub2RlXG4gICAgfSxcbiAgICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGVsLnJlcGxhY2VDaGlsZHJlbigpXG4gICAgICByZXR1cm4gbm9kZS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gICAgfSxcbiAgICBzdHlsZTogKHN0eWxlczogUGFydGlhbDxDU1NTdHlsZURlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgc3R5bGVzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfSxcbiAgICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiB7XG4gICAgICBPYmplY3QuYXNzaWduKGVsLCBodG1sUHJvcHMpO1xuICAgICAgcmV0dXJuIGZyb21IVE1MKGVsKTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBub2RlXG59XG5cblxuZXhwb3J0IGNvbnN0IGRpdiA9IGh0bWwoXCJkaXZcIik7XG5leHBvcnQgY29uc3Qgc3BhbiA9IGh0bWwoXCJzcGFuXCIpO1xuZXhwb3J0IGNvbnN0IHAgPSBodG1sKFwicFwiKTtcbmV4cG9ydCBjb25zdCBib2R5ID0gZnJvbUhUTUwoZG9jdW1lbnQuYm9keSk7XG5leHBvcnQgY29uc3QgaDEgPSBodG1sKFwiaDFcIik7XG5leHBvcnQgY29uc3QgaDIgPSBodG1sKFwiaDJcIik7XG5leHBvcnQgY29uc3QgaDMgPSBodG1sKFwiaDNcIik7XG5leHBvcnQgY29uc3QgaDQgPSBodG1sKFwiaDRcIik7XG5leHBvcnQgY29uc3QgdGFibGUgPSBodG1sKFwidGFibGVcIik7XG5leHBvcnQgY29uc3QgdHIgPSBodG1sKFwidHJcIik7XG5leHBvcnQgY29uc3QgdGQgPSBodG1sKFwidGRcIik7XG5leHBvcnQgY29uc3QgcHJlID0gaHRtbChcInByZVwiKVxuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNmVlZWZmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMjIyMTIyO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZjEwZjIyO1xuICAgICAgLS1ncmVlbjogIzU0YzgwMTtcbiAgICAgIC0tYmx1ZTogIzFmMzJmZjtcbiAgICAgIC0teWVsbG93OiAjZDM5ZTNkO1xuICAgICAgLS1icm93bjogI2M1NWQwMDtcbiAgICAgIC0tcHVycGxlOiAjYTYxZmQwO1xuICAgICAgLS1jeWFuOiAjMGJhZWJjO1xuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuZXhwb3J0IGNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IGFueSk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJcblxuXG5leHBvcnQgdHlwZSBQb3MgPSB7b2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXJ9XG5leHBvcnQgdHlwZSBTcGFuID0ge3N0YXJ0OiBQb3MsIGVuZDogUG9zfVxuXG5leHBvcnQgdHlwZSBUYWcgPFQgZXh0ZW5kcyBzdHJpbmcsIEM+ID0geyQ6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4sIHR5cGU/OiBBU1R9XG5cbmV4cG9ydCB0eXBlIFZhciA9IFRhZzxcInZhclwiLCB7bmFtZTogc3RyaW5nfT5cbmV4cG9ydCB0eXBlIENvbW1lbnQgPSBUYWc8XCJjb21tZW50XCIsIHN0cmluZz5cbmV4cG9ydCB0eXBlIEZ1bmMgPSBUYWc8XCJmdW5jdGlvblwiLCB7dmFyczogVmFyW10sIGJvZHk6IEFTVH0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIFByaW0gPSBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPiB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFByaW1cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSwgYXN0bWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXX1cblxuY29uc3QgaGFzU2hvd25UeXBlID0gKHY6IFZhcikgPT4gdi50eXBlICYmICEodi50eXBlLiQgPT09IFwidmFyXCIgJiYgdi50eXBlLmNvbnRlbnQubmFtZSA9PT0gXCJhbnlcIilcbmNvbnN0IHByZXR0eUJpbmRlciA9ICh2OiBWYXIpOiBzdHJpbmcgPT4gaGFzU2hvd25UeXBlKHYpID8gYCgke3ByZXR0eUFTVCh2LnR5cGUhKX0gJHt2LmNvbnRlbnQubmFtZX0pYCA6IHYuY29udGVudC5uYW1lXG5cblxuZXhwb3J0IGNvbnN0IHByZXR0eUFTVCA9IChub2RlOiBBU1QpOiBzdHJpbmcgPT57XG4gIHN3aXRjaChub2RlLiQpe1xuICAgIGNhc2UgXCJudW1iZXJcIiA6IHJldHVybiBub2RlLmNvbnRlbnQudG9TdHJpbmcoKVxuICAgIGNhc2UgXCJzdHJpbmdcIiA6IHJldHVybiBKU09OLnN0cmluZ2lmeShub2RlLmNvbnRlbnQpXG4gICAgY2FzZSBcInZhclwiOiByZXR1cm4gbm9kZS5jb250ZW50Lm5hbWVcbiAgICBjYXNlIFwibGV0XCI6IHJldHVybiBgbGV0ICR7cHJldHR5QmluZGVyKG5vZGUuY29udGVudC52YXIpfSA9ICR7cHJldHR5QVNUKG5vZGUuY29udGVudC52YWx1ZSl9IGluXFxuJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIGBmbiAke25vZGUuY29udGVudC52YXJzLm1hcChwcmV0dHlCaW5kZXIpLmpvaW4oXCIgXCIpfSA9PiAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQuYm9keSl9YFxuICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGAoJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmZuKX0gJHtub2RlLmNvbnRlbnQuYXJncy5tYXAocHJldHR5QVNUKS5qb2luKFwiIFwiKX0pYFxuICAgIGNhc2UgXCJyZWNvcmRcIjogcmV0dXJuIGB7JHtub2RlLmNvbnRlbnQubWFwKChbaywgdl0pID0+IGAke2suY29udGVudC5uYW1lfTogJHtwcmV0dHlBU1Qodil9YCkuam9pbihcIiwgXCIpfX1gXG4gICAgY2FzZSBcImVycm9yXCI6IHJldHVybiBgW0VSUk9SOiAke25vZGUuY29udGVudC5tZXNzYWdlfV1gXG4gIH1cbn1cblxuXG5jb25zdCB6ZXJvUG9zID0gKCk6IFBvcyA9PiAoe29mZnNldDogMCwgbGluZTogMSwgY29sOiAxfSlcbmNvbnN0IHplcm9TcGFuID0gKCk6IFNwYW4gPT4gKHtzdGFydDogemVyb1BvcygpLCBlbmQ6IHplcm9Qb3MoKX0pXG5cbmV4cG9ydCBjb25zdCBta0FzdCA9IDxUIGV4dGVuZHMgc3RyaW5nLCBDPih0YWc6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4gPSB6ZXJvU3BhbigpKTogVGFnPFQsIEM+ID0+ICh7JDogdGFnLCBjb250ZW50LCBzcGFufSlcblxudHlwZSBUb2tlbkJhc2UgPSB7c3BhbjogU3Bhbn1cblxudHlwZSBUb2tlbiA9XG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImlkZW50XCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJudW1iZXJcIiwgdmFsdWU6IG51bWJlcn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcInN0cmluZ1wiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImFycm93XCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJjb21tZW50XCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9KVxuXG50eXBlIFRva2VuTm9TcGFuID0gVG9rZW4gZXh0ZW5kcyBpbmZlciBUID8gVCBleHRlbmRzIHtzcGFuOiBTcGFufSA/IE9taXQ8VCwgXCJzcGFuXCI+IDogbmV2ZXIgOiBuZXZlclxuXG5jb25zdCB0b2tlbml6ZSA9IChjb2RlOiBzdHJpbmcpOiB7dG9rZW5zOiBUb2tlbltdLCBjb21tZW50czogQ29tbWVudFtdLCBlb2Y6IFBvc30gPT4ge1xuICBsZXQgdG9rZW5zOiBUb2tlbltdID0gW11cbiAgbGV0IGNvbW1lbnRzOiBDb21tZW50W10gPSBbXVxuICBsZXQgaSA9IDBcbiAgbGV0IGxpbmUgPSAxXG4gIGxldCBjb2wgPSAxXG5cbiAgbGV0IGlzQWxwaGEgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtel9dLy50ZXN0KGNoYXIpXG4gIGxldCBpc0RpZ2l0ID0gKGNoYXI6IHN0cmluZykgPT4gL1swLTldLy50ZXN0KGNoYXIpXG4gIGxldCBpc0lkZW50ID0gKGNoYXI6IHN0cmluZykgPT4gL1tBLVphLXowLTlfXS8udGVzdChjaGFyKVxuICBsZXQgcG9zID0gKCk6IFBvcyA9PiAoe29mZnNldDogaSwgbGluZSwgY29sfSlcbiAgbGV0IGFkdmFuY2UgPSAoKSA9PiB7XG4gICAgaWYgKGNvZGVbaV0gPT09IFwiXFxuXCIpIHtcbiAgICAgIGkrK1xuICAgICAgbGluZSsrXG4gICAgICBjb2wgPSAxXG4gICAgfSBlbHNlIHtcbiAgICAgIGkrK1xuICAgICAgY29sKytcbiAgICB9XG4gIH1cbiAgbGV0IHB1c2ggPSAodG9rZW46IFRva2VuTm9TcGFuLCBzdGFydDogUG9zKSA9PiB7XG4gICAgdG9rZW5zLnB1c2goey4uLnRva2VuLCBzcGFuOiB7c3RhcnQsIGVuZDogcG9zKCl9fSBhcyBUb2tlbilcbiAgfVxuXG4gIHdoaWxlIChpIDwgY29kZS5sZW5ndGgpIHtcbiAgICBsZXQgY2hhciA9IGNvZGVbaV1cblxuICAgIGlmICgvXFxzLy50ZXN0KGNoYXIpKSB7XG4gICAgICBhZHZhbmNlKClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09IFwiL1wiICYmIGNvZGVbaSArIDFdID09PSBcIi9cIikge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGNvZGVbaV0gIT09IFwiXFxuXCIpIGFkdmFuY2UoKVxuICAgICAgY29tbWVudHMucHVzaChta0FzdChcImNvbW1lbnRcIiwgY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpLCB7c3RhcnQsIGVuZDogcG9zKCl9KSlcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09IFwiPVwiICYmIGNvZGVbaSArIDFdID09PSBcIj5cIikge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcImFycm93XCJ9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKFwiKCl7fT0sOlwiLmluY2x1ZGVzKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlID0gY2hhciBhcyBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIlxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcInN5bWJvbFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gXCJcIlxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IGNvZGVbaV1cbiAgICAgICAgaWYgKGN1cnJlbnQgPT09IFwiXFxcXFwiKSB7XG4gICAgICAgICAgbGV0IG5leHQgPSBjb2RlW2kgKyAxXVxuICAgICAgICAgIGlmIChuZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGFkdmFuY2UoKVxuICAgICAgICAgICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVudGVybWluYXRlZCBzdHJpbmcgZXNjYXBlXCIsIGNvbnRlbnQ6IGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKX0sIHN0YXJ0KVxuICAgICAgICAgICAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgZXNjYXBlZCA9ICh7bjogXCJcXG5cIiwgcjogXCJcXHJcIiwgdDogXCJcXHRcIiwgJ1wiJzogJ1wiJywgXCJcXFxcXCI6IFwiXFxcXFwifSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KVtuZXh0XVxuICAgICAgICAgIHZhbHVlICs9IGVzY2FwZWQgPz8gbmV4dFxuICAgICAgICAgIGFkdmFuY2UoKVxuICAgICAgICAgIGFkdmFuY2UoKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnJlbnQgPT09ICdcIicpIGJyZWFrXG4gICAgICAgIHZhbHVlICs9IGN1cnJlbnRcbiAgICAgICAgYWR2YW5jZSgpXG4gICAgICB9XG4gICAgICBpZiAoY29kZVtpXSAhPT0gJ1wiJykge1xuICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBsaXRlcmFsXCIsIGNvbnRlbnQ6IGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKX0sIHN0YXJ0KVxuICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICB9XG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0RpZ2l0KGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzRGlnaXQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJudW1iZXJcIiwgdmFsdWU6IE51bWJlcihjb2RlLnNsaWNlKHZhbHVlU3RhcnQsIGkpKX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoaXNBbHBoYShjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZVN0YXJ0ID0gaVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBpc0lkZW50KGNvZGVbaV0pKSBhZHZhbmNlKClcbiAgICAgIGxldCB2YWx1ZSA9IGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSlcbiAgICAgIGlmICh2YWx1ZSA9PT0gXCJsZXRcIiB8fCB2YWx1ZSA9PT0gXCJpblwiIHx8IHZhbHVlID09PSBcImZuXCIpIHB1c2goe3R5cGU6IFwia2V5d29yZFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgZWxzZSBwdXNoKHt0eXBlOiBcImlkZW50XCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgYWR2YW5jZSgpXG4gICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBgVW5leHBlY3RlZCBjaGFyYWN0ZXI6ICR7Y2hhcn1gLCBjb250ZW50OiBjaGFyfSwgc3RhcnQpXG4gIH1cblxuICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG59XG5cbmNsYXNzIFBhcnNlciB7XG4gIHByaXZhdGUgaSA9IDBcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRva2VuczogVG9rZW5bXSwgcHJpdmF0ZSBzb3VyY2U6IHN0cmluZywgcHJpdmF0ZSBlb2Y6IFBvcykge31cblxuICBwYXJzZSgpOiBBU1Qge1xuICAgIGxldCBhc3QgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgaWYgKHRoaXMucGVlaygpKSB7XG4gICAgICBsZXQgc3RhcnQgPSB0aGlzLnBlZWsoKSEuc3Bhbi5zdGFydFxuICAgICAgbGV0IGVuZCA9IHRoaXMudG9rZW5zW3RoaXMudG9rZW5zLmxlbmd0aCAtIDFdPy5zcGFuLmVuZCA/PyBzdGFydFxuICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW5leHBlY3RlZCBleHRyYSBpbnB1dCBhZnRlciBleHByZXNzaW9uXCIsIHtzdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICB9XG4gICAgcmV0dXJuIGFzdFxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUV4cHIoKTogQVNUIHtcbiAgICBpZiAodGhpcy5pc0tleXdvcmQoXCJsZXRcIikpIHJldHVybiB0aGlzLnBhcnNlTGV0KClcbiAgICBpZiAodGhpcy5pc0tleXdvcmQoXCJmblwiKSkgcmV0dXJuIHRoaXMucGFyc2VGdW5jdGlvbigpXG4gICAgcmV0dXJuIHRoaXMucGFyc2VBdG9tKClcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VMZXQoKTogQVNUIHtcbiAgICBsZXQgc3RhcnQgPSB0aGlzLmV4cGVjdEtleXdvcmQoXCJsZXRcIikuc3Bhbi5zdGFydFxuICAgIGxldCB2YXJpYWJsZSA9IHRoaXMucGFyc2VMZXRCaW5kZXIoKVxuICAgIGlmICh2YXJpYWJsZS4kID09PSBcImVycm9yXCIpIHJldHVybiB2YXJpYWJsZVxuXG4gICAgbGV0IHZhbHVlOiBBU1RcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIj1cIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiPVwiKVxuICAgICAgdmFsdWUgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiKVxuICAgIH1cblxuICAgIGxldCBib2R5OiBBU1RcbiAgICBpZiAodGhpcy5pc0tleXdvcmQoXCJpblwiKSkge1xuICAgICAgdGhpcy5leHBlY3RLZXl3b3JkKFwiaW5cIilcbiAgICAgIGJvZHkgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfSBlbHNlIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQga2V5d29yZCBpbiBhZnRlciBsZXQgYmluZGluZ1wiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQga2V5d29yZCBpbiBhZnRlciBsZXQgYmluZGluZ1wiKVxuICAgIH1cblxuICAgIHJldHVybiBta0FzdChcImxldFwiLCB7dmFyOiB2YXJpYWJsZSwgdmFsdWUsIGJvZHl9LCB7c3RhcnQsIGVuZDogYm9keS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlRnVuY3Rpb24oKTogQVNUIHtcbiAgICBsZXQgc3RhcnQgPSB0aGlzLmV4cGVjdEtleXdvcmQoXCJmblwiKS5zcGFuLnN0YXJ0XG4gICAgbGV0IHZhcnM6IFZhcltdID0gW11cbiAgICB3aGlsZSAodGhpcy5wZWVrKCk/LnR5cGUgPT09IFwiaWRlbnRcIiB8fCB0aGlzLmlzU3ltYm9sKFwiKFwiKSkge1xuICAgICAgbGV0IGJpbmRlciA9IHRoaXMucGFyc2VCaW5kZXIoKVxuICAgICAgaWYgKGJpbmRlci4kID09PSBcImVycm9yXCIpIHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzLCBib2R5OiBiaW5kZXJ9LCB7c3RhcnQsIGVuZDogYmluZGVyLnNwYW4uZW5kfSlcbiAgICAgIHZhcnMucHVzaChiaW5kZXIpXG4gICAgfVxuICAgIGxldCBib2R5OiBBU1RcbiAgICBpZiAodmFycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGlmICh0aGlzLm1hdGNoVG9rZW4oXCJhcnJvd1wiKSkgYm9keSA9IHRoaXMud3JhcEVycm9yKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCB0aGlzLnBhcnNlRXhwcigpKVxuICAgICAgZWxzZSBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgc3RhcnQpXG4gICAgfSBlbHNlIGlmICghdGhpcy5tYXRjaFRva2VuKFwiYXJyb3dcIikpIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQgJz0+JyBhZnRlciBmdW5jdGlvbiBwYXJhbWV0ZXJzXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnPT4nIGFmdGVyIGZ1bmN0aW9uIHBhcmFtZXRlcnNcIilcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9XG4gICAgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHl9LCB7c3RhcnQsIGVuZDogYm9keS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlQXRvbSgpOiBBU1Qge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiVW5leHBlY3RlZCBlbmQgb2YgaW5wdXRcIilcblxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImlkZW50XCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJ2YXJcIiwge25hbWU6IHRva2VuLnZhbHVlfSwgdG9rZW4uc3BhbilcbiAgICB9XG5cblxuICAgIGlmICh0b2tlbi50eXBlID09PSBcIm51bWJlclwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwibnVtYmVyXCIsIHRva2VuLnZhbHVlLCB0b2tlbi5zcGFuKVxuICAgIH1cblxuICAgIGlmICh0b2tlbi50eXBlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwic3RyaW5nXCIsIHRva2VuLnZhbHVlLCB0b2tlbi5zcGFuKVxuICAgIH1cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJlcnJvclwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IHRva2VuLm1lc3NhZ2UsIGNvbnRlbnQ6IHRva2VuLmNvbnRlbnR9LCB0b2tlbi5zcGFuKVxuICAgIH1cblxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiKFwiKSkgcmV0dXJuIHRoaXMucGFyc2VQYXJlbnMoKVxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwie1wiKSkgcmV0dXJuIHRoaXMucGFyc2VSZWNvcmQoKVxuXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoYFVuZXhwZWN0ZWQgdG9rZW46ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YCwgdG9rZW4uc3BhbilcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VQYXJlbnMoKTogQVNUIHtcbiAgICBsZXQgb3BlbiA9IHRoaXMuZXhwZWN0U3ltYm9sKFwiKFwiKVxuICAgIGxldCBpdGVtczogQVNUW10gPSBbXVxuICAgIHdoaWxlICghdGhpcy5pc1N5bWJvbChcIilcIikpIHtcbiAgICAgIGlmICghdGhpcy5wZWVrKCkpIHtcbiAgICAgICAgbGV0IGVuZCA9IGl0ZW1zLmxlbmd0aCA+IDAgPyBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBpdGVtcy5wdXNoKHRoaXMucGFyc2VFeHByKCkpXG4gICAgfVxuICAgIGxldCBjbG9zZSA9IHRoaXMuZXhwZWN0U3ltYm9sKFwiKVwiKVxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLmVycm9yTm9kZShcIkVtcHR5IHBhcmVudGhlc2VzIGFyZSBub3QgYWxsb3dlZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGNsb3NlLnNwYW4uZW5kLm9mZnNldCkpXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMSkgcmV0dXJuIGl0ZW1zWzBdXG4gICAgcmV0dXJuIG1rQXN0KFwiYXBwXCIsIHtmbjogaXRlbXNbMF0sIGFyZ3M6IGl0ZW1zLnNsaWNlKDEpfSwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVJlY29yZCgpOiBBU1Qge1xuICAgIGxldCBvcGVuID0gdGhpcy5leHBlY3RTeW1ib2woXCJ7XCIpXG4gICAgbGV0IGZpZWxkczogW1ZhciwgQVNUXVtdID0gW11cblxuICAgIHdoaWxlICghdGhpcy5pc1N5bWJvbChcIn1cIikpIHtcbiAgICAgIGlmICghdGhpcy5wZWVrKCkpIHtcbiAgICAgICAgbGV0IGVuZCA9IGZpZWxkcy5sZW5ndGggPiAwID8gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXVsxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHJlY29yZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKCkhXG4gICAgICAgIHRoaXMuaSsrXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShgRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIG5hbWUsIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWAsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IHRva2VuLnNwYW4uZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgdG9rZW4uc3Bhbi5lbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGxldCBrZXkgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICAgIGxldCB2YWx1ZSA9IHRoaXMuaXNTeW1ib2woXCI6XCIpXG4gICAgICAgID8gKHRoaXMuZXhwZWN0U3ltYm9sKFwiOlwiKSwgdGhpcy5pc1N5bWJvbChcIn1cIikgPyB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIHJlY29yZCBmaWVsZCB2YWx1ZSBhZnRlciAnOidcIikgOiB0aGlzLnBhcnNlRXhwcigpKVxuICAgICAgICA6IGtleVxuICAgICAgZmllbGRzLnB1c2goW2tleSwgdmFsdWVdKVxuICAgICAgaWYgKHRoaXMuaXNTeW1ib2woXCIsXCIpKSB0aGlzLmkrK1xuICAgICAgZWxzZSBicmVha1xuICAgIH1cblxuICAgIGlmICghdGhpcy5pc1N5bWJvbChcIn1cIikpIHtcbiAgICAgIGxldCBlbmQgPSBmaWVsZHMubGVuZ3RoID4gMCA/IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV1bMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcmVjb3JkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICB9XG4gICAgbGV0IGNsb3NlID0gdGhpcy5leHBlY3RTeW1ib2woXCJ9XCIpXG4gICAgcmV0dXJuIG1rQXN0KFwicmVjb3JkXCIsIGZpZWxkcywge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUJpbmRlcigpOiBWYXIgfCBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PiB7XG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCIoXCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIihcIilcbiAgICAgIGxldCBkZWNsYXJlZFR5cGUgPSB0aGlzLnBhcnNlQXRvbSgpXG4gICAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgICBpZiAoIW5hbWUpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGlkZW50aWZpZXIgaW4gYmluZGVyIHBhdHRlcm5cIilcbiAgICAgIGlmICghdGhpcy5pc1N5bWJvbChcIilcIikpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICcpJyBhZnRlciBiaW5kZXIgcGF0dGVyblwiKVxuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCIpXCIpXG4gICAgICBpZiAoZGVjbGFyZWRUeXBlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGRlY2xhcmVkVHlwZVxuICAgICAgbGV0IHZhcmlhYmxlID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgICB2YXJpYWJsZS50eXBlID0gZGVjbGFyZWRUeXBlXG4gICAgICByZXR1cm4gdmFyaWFibGVcbiAgICB9XG4gICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgIGlmICghbmFtZSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgaWRlbnRpZmllclwiKVxuICAgIGxldCB2YXJpYWJsZSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiOlwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCI6XCIpXG4gICAgICBsZXQgZGVjbGFyZWRUeXBlID0gdGhpcy5wYXJzZUF0b20oKVxuICAgICAgaWYgKGRlY2xhcmVkVHlwZS4kID09PSBcImVycm9yXCIpIHJldHVybiBkZWNsYXJlZFR5cGVcbiAgICAgIHZhcmlhYmxlLnR5cGUgPSBkZWNsYXJlZFR5cGVcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhYmxlXG4gIH1cblxuICBwcml2YXRlIHBhcnNlTGV0QmluZGVyKCk6IFZhciB8IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+IHtcbiAgICByZXR1cm4gdGhpcy5wYXJzZUJpbmRlcigpXG4gIH1cblxuICBwcml2YXRlIHBlZWsoKTogVG9rZW4gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLmldXG4gIH1cblxuICBwcml2YXRlIGlzS2V5d29yZCh2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIik6IGJvb2xlYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgcmV0dXJuIHRva2VuPy50eXBlID09PSBcImtleXdvcmRcIiAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWVcbiAgfVxuXG4gIHByaXZhdGUgaXNTeW1ib2wodmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiKTogYm9vbGVhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICByZXR1cm4gdG9rZW4/LnR5cGUgPT09IFwic3ltYm9sXCIgJiYgdG9rZW4udmFsdWUgPT09IHZhbHVlXG4gIH1cblxuICBwcml2YXRlIGV4cGVjdFRva2VuPEsgZXh0ZW5kcyBUb2tlbltcInR5cGVcIl0+KHR5cGU6IEspOiBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+IHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4gfHwgdG9rZW4udHlwZSAhPT0gdHlwZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke3R5cGV9LCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuIGFzIEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT5cbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hUb2tlbjxLIGV4dGVuZHMgVG9rZW5bXCJ0eXBlXCJdPih0eXBlOiBLKTogRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PiB8IHVuZGVmaW5lZCB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuIHx8IHRva2VuLnR5cGUgIT09IHR5cGUpIHJldHVybiB1bmRlZmluZWRcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlbiBhcyBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+XG4gIH1cblxuICBwcml2YXRlIGV4cGVjdEtleXdvcmQodmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCIpIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbj8udHlwZSAhPT0gXCJrZXl3b3JkXCIgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGtleXdvcmQgJHt2YWx1ZX0sIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW5cbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0U3ltYm9sKHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIikge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuPy50eXBlICE9PSBcInN5bWJvbFwiIHx8IHRva2VuLnZhbHVlICE9PSB2YWx1ZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAnJHt2YWx1ZX0nLCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuXG4gIH1cblxuICBwcml2YXRlIGRlc2NyaWJlKHRva2VuOiBUb2tlbiB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIFwiZW5kIG9mIGlucHV0XCJcbiAgICBpZiAoXCJ2YWx1ZVwiIGluIHRva2VuKSByZXR1cm4gYCR7dG9rZW4udHlwZX0oJHtTdHJpbmcodG9rZW4udmFsdWUpfSlgXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiZXJyb3JcIikgcmV0dXJuIGBlcnJvcigke3Rva2VuLm1lc3NhZ2V9KWBcbiAgICByZXR1cm4gdG9rZW4udHlwZVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvck5vZGUobWVzc2FnZTogc3RyaW5nLCBzcGFuPzogU3BhbiwgY29udGVudD86IHN0cmluZyk6IEVycm9yTm9kZSB7XG4gICAgbGV0IGZpbmFsU3BhbiA9IHNwYW4gPz8gdGhpcy5wb2ludFNwYW4oKVxuICAgIHJldHVybiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlLCBjb250ZW50OiBjb250ZW50ID8/IHRoaXMuc291cmNlLnNsaWNlKGZpbmFsU3Bhbi5zdGFydC5vZmZzZXQsIGZpbmFsU3Bhbi5lbmQub2Zmc2V0KX0sIGZpbmFsU3BhbilcbiAgfVxuXG4gIHByaXZhdGUgZXJyb3JIZXJlKG1lc3NhZ2U6IHN0cmluZywgc3RhcnQ/OiBQb3MpOkVycm9yTm9kZSB7XG4gICAgbGV0IHNwYW4gPSB0aGlzLnBlZWsoKT8uc3BhbiA/PyB7c3RhcnQ6IHRoaXMuZW9mLCBlbmQ6IHRoaXMuZW9mfVxuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShtZXNzYWdlLCB7c3RhcnQ6IHN0YXJ0ID8/IHNwYW4uc3RhcnQsIGVuZDogc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSB3cmFwRXJyb3IobWVzc2FnZTogc3RyaW5nLCBub2RlOiBBU1QpOiBBU1Qge1xuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShtZXNzYWdlLCBub2RlLnNwYW4sIHRoaXMuc291cmNlLnNsaWNlKG5vZGUuc3Bhbi5zdGFydC5vZmZzZXQsIG5vZGUuc3Bhbi5lbmQub2Zmc2V0KSlcbiAgfVxuXG4gIHByaXZhdGUgcG9pbnRTcGFuKCk6IFNwYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuKSByZXR1cm4gdG9rZW4uc3BhblxuICAgIHJldHVybiB7c3RhcnQ6IHRoaXMuZW9mLCBlbmQ6IHRoaXMuZW9mfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBidWlsZEFzdE1hcCA9IChhc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdKTogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPT4ge1xuICBsZXQgbWF4RW5kID0gY29tbWVudHMucmVkdWNlKChtLCBjKSA9PiBjLnNwYW4uZW5kLm9mZnNldCA+IG0gPyBjLnNwYW4uZW5kLm9mZnNldCA6IG0sIGFzdC5zcGFuLmVuZC5vZmZzZXQpXG4gIGxldCByZXM6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gQXJyYXkuZnJvbSh7bGVuZ3RoOiBtYXhFbmR9LCAoKT0+dW5kZWZpbmVkKVxuICBjb25zdCB3YWxrID0gKG5vZGU6IEFTVCkgPT4ge1xuICAgIGZvciAobGV0IGkgPSBub2RlLnNwYW4uc3RhcnQub2Zmc2V0OyBpIDwgbm9kZS5zcGFuLmVuZC5vZmZzZXQ7IGkrKykgcmVzW2ldID0gbm9kZVxuICAgIGNoaWxkcmVuKG5vZGUpLmZvckVhY2god2FsaylcbiAgfVxuICB3YWxrKGFzdClcbiAgY29tbWVudHMuZm9yRWFjaChjb21tZW50ID0+IHtcbiAgICBmb3IgKGxldCBpID0gY29tbWVudC5zcGFuLnN0YXJ0Lm9mZnNldDsgaSA8IGNvbW1lbnQuc3Bhbi5lbmQub2Zmc2V0OyBpKyspIHJlc1tpXSA9IGNvbW1lbnRcbiAgfSlcbiAgcmV0dXJuIHJlc1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2UgPSAoY29kZTpzdHJpbmcpOiBQYXJzZVJlc3VsdCA9PiB7XG4gIGxldCB7dG9rZW5zLCBjb21tZW50cywgZW9mfSA9IHRva2VuaXplKGNvZGUpXG4gIGxldCBhc3QgPSBuZXcgUGFyc2VyKHRva2VucywgY29kZSwgZW9mKS5wYXJzZSgpXG4gIHJldHVybiB7YXN0LCBjb21tZW50cywgYXN0bWFwOiBidWlsZEFzdE1hcChhc3QsIGNvbW1lbnRzKX1cbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlQVNUID0gKGNvZGU6c3RyaW5nKTogQVNUID0+IHBhcnNlKGNvZGUpLmFzdFxuXG5leHBvcnQgY29uc3QgY2hpbGRyZW4gPSAobm9kZTogQVNUKTogQVNUW10gPT4ge1xuICBpZiAobm9kZS4kID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBbLi4ubm9kZS5jb250ZW50LnZhcnMsIG5vZGUuY29udGVudC5ib2R5XVxuICBpZiAobm9kZS4kID09PSBcImFwcFwiKSByZXR1cm4gW25vZGUuY29udGVudC5mbiwgLi4ubm9kZS5jb250ZW50LmFyZ3NdXG4gIGlmIChub2RlLiQgPT09IFwibGV0XCIpIHJldHVybiBbbm9kZS5jb250ZW50LnZhciwgbm9kZS5jb250ZW50LnZhbHVlLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJyZWNvcmRcIikgcmV0dXJuIG5vZGUuY29udGVudC5mbGF0TWFwKChba2V5LCB2YWx1ZV0pID0+IFtrZXksIHZhbHVlXSlcbiAgcmV0dXJuIFtdXG59XG5cbmNvbnN0IHN0cmlwU3BhbnMgPSAoYXN0OiBBU1QpOiB1bmtub3duID0+IHtcbiAgaWYgKGFzdC4kID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHt2YXJzOiBhc3QuY29udGVudC52YXJzLm1hcChzdHJpcFNwYW5zKSwgYm9keTogc3RyaXBTcGFucyhhc3QuY29udGVudC5ib2R5KX19XG4gIGlmIChhc3QuJCA9PT0gXCJhcHBcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge2ZuOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmZuKSwgYXJnczogYXN0LmNvbnRlbnQuYXJncy5tYXAoc3RyaXBTcGFucyl9fVxuICBpZiAoYXN0LiQgPT09IFwibGV0XCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHt2YXI6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQudmFyKSwgdmFsdWU6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQudmFsdWUpLCBib2R5OiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmJvZHkpfX1cbiAgaWYgKGFzdC4kID09PSBcInJlY29yZFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudC5tYXAoKFtuYW1lLCB2YWx1ZV0pID0+IFtzdHJpcFNwYW5zKG5hbWUpLCBzdHJpcFNwYW5zKHZhbHVlKV0pfVxuICBpZiAoYXN0LiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnR9XG4gIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50fVxufVxuXG5cbmxldCBzdHJpbmdpZnkgPSAoeDogdW5rbm93bikgPT4gSlNPTi5zdHJpbmdpZnkoeCwgbnVsbCwgMilcblxuY29uc3QgdGVzdF9wYXJzZSA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBBU1QpID0+IHtcbiAgbGV0IGFzdCA9IHBhcnNlQVNUKGNvZGUpXG5cbiAgaWYgKEpTT04uc3RyaW5naWZ5KHN0cmlwU3BhbnMoYXN0KSkgIT09IEpTT04uc3RyaW5naWZ5KHN0cmlwU3BhbnMoZXhwZWN0ZWQpKSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJUZXN0IGZhaWxlZCBmb3IgY29kZTpcIiwgY29kZSlcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIHN0cmluZ2lmeShzdHJpcFNwYW5zKGV4cGVjdGVkKSkpXG4gICAgY29uc29sZS5lcnJvcihcIkdvdDpcIiwgc3RyaW5naWZ5KHN0cmlwU3BhbnMoYXN0KSkpXG4gICAgdGhyb3cgbmV3IEVycm9yKGBUZXN0IGZhaWxlZCBmb3IgY29kZTogJHtjb2RlfWApXG4gIH1cbn1cblxuY29uc3QgdGVzdF9zcGFuID0gKGNvZGU6IHN0cmluZywgZXhwZWN0ZWQ6IFNwYW4pID0+IHtcbiAgbGV0IGFzdCA9IHBhcnNlQVNUKGNvZGUpXG4gIGlmIChKU09OLnN0cmluZ2lmeShhc3Quc3BhbikgIT09IEpTT04uc3RyaW5naWZ5KGV4cGVjdGVkKSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJTcGFuIHRlc3QgZmFpbGVkIGZvciBjb2RlOlwiLCBjb2RlKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJFeHBlY3RlZDpcIiwgZXhwZWN0ZWQpXG4gICAgY29uc29sZS5lcnJvcihcIkdvdDpcIiwgYXN0LnNwYW4pXG4gICAgdGhyb3cgbmV3IEVycm9yKGBTcGFuIHRlc3QgZmFpbGVkIGZvciBjb2RlOiAke2NvZGV9YClcbiAgfVxufVxuXG5leHBvcnQgbGV0IG1rbnVtID0gKG46IG51bWJlcikgPT4gbWtBc3QoXCJudW1iZXJcIiwgbilcbmV4cG9ydCBsZXQgbWtzdHIgPSAoczogc3RyaW5nKSA9PiBta0FzdChcInN0cmluZ1wiLCBzKVxuZXhwb3J0IGxldCBta3ZhciA9IChuYW1lOiBzdHJpbmcpID0+IG1rQXN0KFwidmFyXCIsIHtuYW1lfSlcbmV4cG9ydCBsZXQgbWthcHAgPSAoZm46IEFTVCwgYXJnczogQVNUW10pID0+IG1rQXN0KFwiYXBwXCIsIHtmbiwgYXJnc30pXG5leHBvcnQgbGV0IG1rbGV0ID0gKHY6IHN0cmluZyB8IFZhciwgdmFsdWU6IEFTVCwgYm9keTogQVNUKSA9PiBta0FzdChcImxldFwiLCB7dmFyOiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IG1rdmFyKHYpIDogdiwgdmFsdWUsIGJvZHl9KVxuZXhwb3J0IGxldCBta2Z1biA9ICh2YXJzOiAoc3RyaW5nIHwgVmFyKVtdLCBib2R5OiBBU1QpID0+IG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnM6IHZhcnMubWFwKHYgPT4gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYpLCBib2R5fSkgYXMgRnVuY1xuZXhwb3J0IGxldCBhbm5vdCA9ICh0eXBlOiBBU1QsIHZhbHVlOiBBU1QpID0+IG1rQXN0KFwiYW5ub3RcIiwge3R5cGUsIHZhbHVlfSlcbmV4cG9ydCBsZXQgbWtyZWNvcmQgPSAoZmllbGRzOiB7W2tleSA6IHN0cmluZ10gOiBBU1R9KSA9PiBta0FzdChcInJlY29yZFwiLCBPYmplY3QuZW50cmllcyhmaWVsZHMpLm1hcCgoW2ssdl0pPT4gW21rdmFyKGspLCB2XSkpXG5cbk9iamVjdC5lbnRyaWVzKHtcbiAgXCJ4XCI6IG1rdmFyKFwieFwiKSxcbiAgXCIyMlwiOiBta251bSgyMiksXG4gICdcImhlbGxvXCInOiBta3N0cihcImhlbGxvXCIpLFxuICBcIihmIHgpXCI6IG1rYXBwKG1rdmFyKFwiZlwiKSwgW21rdmFyKFwieFwiKV0pLFxuICBcIihmIHggeSlcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpLCBta3ZhcihcInlcIildKSxcbiAgXCJsZXQgeCA9IDIyIGluIHhcIjogbWtsZXQoXCJ4XCIsIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJ7YTogMjIsIGI6IHh9XCI6IG1rcmVjb3JkKHthOiBta251bSgyMiksIGI6IG1rdmFyKFwieFwiKX0pLFxuICBcImZuIHggPT4geFwiOiBta2Z1bihbXCJ4XCJdLCBta3ZhcihcInhcIikpLFxuICBcImZuIHggeSA9PiB4XCI6IG1rZnVuKFtcInhcIiwgXCJ5XCJdLCBta3ZhcihcInhcIikpLFxuICBcImxldCAobnVtYmVyIHgpID0gMjIgaW4geFwiOiBta2xldChPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiAobnVtYmVyIHgpIChzdHJpbmcgeSkgPT4geFwiOiBta2Z1bihbXG4gICAgT2JqZWN0LmFzc2lnbihta3ZhcihcInhcIiksIHt0eXBlOiBta3ZhcihcIm51bWJlclwiKX0pLFxuICAgIE9iamVjdC5hc3NpZ24obWt2YXIoXCJ5XCIpLCB7dHlwZTogbWt2YXIoXCJzdHJpbmdcIil9KSxcbiAgXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJ7ZToyMn1cIiA6IG1rcmVjb3JkKHtlOiBta251bSgyMil9KSxcbiAgXCJ7ZX1cIjogbWtyZWNvcmQoe2U6IG1rdmFyKFwiZVwiKX0pLFxuICBcIi8vY29tbWVudFxcbjIyXCI6IHBhcnNlQVNUKFwiMjJcIiksXG59KS5mb3JFYWNoKChbY29kZSwgZXhwZWN0ZWRdKSA9PiB0ZXN0X3BhcnNlKGNvZGUsIGV4cGVjdGVkIGFzIEFTVCkpXG5cbk9iamVjdC5lbnRyaWVzKHtcbiAgXCIoXCI6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiLCBjb250ZW50OiBcIihcIn0pLFxuICBcImxldCB4IDIyIGluIHhcIjogbWtBc3QoXCJsZXRcIiwge1xuICAgIHZhcjogbWt2YXIoXCJ4XCIpLFxuICAgIHZhbHVlOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIsIGNvbnRlbnQ6IFwiMjJcIn0pLFxuICAgIGJvZHk6IG1rdmFyKFwieFwiKSxcbiAgfSksXG4gIFwie2U6fVwiOiBta3JlY29yZCh7ZTogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCByZWNvcmQgZmllbGQgdmFsdWUgYWZ0ZXIgJzonXCIsIGNvbnRlbnQ6IFwifVwifSl9KSxcblxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG50ZXN0X3NwYW4oXCJsZXQgeCA9IDIyXFxuaW4geFwiLCB7XG4gIHN0YXJ0OiB7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9LFxuICBlbmQ6IHtvZmZzZXQ6IDE1LCBsaW5lOiAyLCBjb2w6IDV9LFxufSlcbiIsCiAgICAiaW1wb3J0IHsgQVNULCBWYXIgfSBmcm9tIFwiLi9wYXJzZXJcIlxuaW1wb3J0IHtjaGlsZHJlbn0gZnJvbSBcIi4vcGFyc2VyXCJcblxuXG5leHBvcnQgY29uc3QgZ2V0ZGVmID0gKHJvb3Q6IEFTVCwgdmFyaTogVmFyKTogQVNUIHwgdW5kZWZpbmVkID0+IHtcbiAgaWYgKHJvb3Quc3Bhbi5zdGFydC5vZmZzZXQgPiB2YXJpLnNwYW4uc3RhcnQub2Zmc2V0IHx8IHJvb3Quc3Bhbi5lbmQub2Zmc2V0IDwgdmFyaS5zcGFuLmVuZC5vZmZzZXQpIHJldHVybiB1bmRlZmluZWRcbiAgZm9yIChsZXQgY2hpbGQgb2YgY2hpbGRyZW4ocm9vdCkpe1xuICAgIGxldCByZXMgPSBnZXRkZWYoY2hpbGQsIHZhcmkpXG4gICAgaWYgKHJlcykgcmV0dXJuIHJlc1xuICB9XG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJsZXRcIiAmJiByb290LmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgcmV0dXJuIHJvb3QuY29udGVudC52YXJcblxuICBpZiAocm9vdC4kID09PSBcImZ1bmN0aW9uXCIpXG4gICAgZm9yIChsZXQgdiBvZiByb290LmNvbnRlbnQudmFycylcbiAgICAgIGlmICh2LmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgICAgIHJldHVybiB2XG59XG4iLAogICAgImltcG9ydCB7IGNvbG9yT2YgfSBmcm9tIFwiLi9lZGl0b3JcIlxuaW1wb3J0IHsgYm9keSwgY29sb3IsIGRpdiwgTk9ERSwgcHJlLCBzcGFuIH0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQge21rbnVtLCBQcmltLCBUYWcsIHR5cGUgQVNULCB0eXBlIEZ1bmMsIHBhcnNlLCBta3ZhciwgbWthcHAsIFZhciwgcHJldHR5QVNULCBta0FzdCwgbWtmdW59IGZyb20gXCIuL3BhcnNlclwiXG5cbmV4cG9ydCBsZXQgTlVNQkVSIDogQVNUID0gbWt2YXIoXCJudW1iZXJcIilcbmV4cG9ydCBsZXQgU1RSSU5HIDogQVNUID0gbWt2YXIoXCJzdHJpbmdcIilcbmV4cG9ydCBsZXQgVFlQRSAgIDogQVNUID0gbWt2YXIoXCJ0eXBlXCIpXG5leHBvcnQgbGV0IFRZUEVPRiA6IEFTVCA9IG1rdmFyKFwidHlwZW9mXCIpXG5cbk5VTUJFUi50eXBlID0gVFlQRVxuU1RSSU5HLnR5cGUgPSBUWVBFXG5UWVBFLnR5cGUgPSBUWVBFXG5UWVBFT0YudHlwZSA9IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0IVxuXG5leHBvcnQgbGV0IEFOWSA6IEFTVCA9IG1rdmFyKFwiYW55XCIpXG5cbmxldCBwcmltaXRpdmVUeXBlID0gKG5hbWU6IHN0cmluZykgPT4gKHtcbiAgdHlwZTogVFlQRSxcbiAgaW1wbDogKHg6IEFTVCkgPT4ge1xuICAgIGlmICh4LnR5cGUpIHtcbiAgICAgIGlmICh4LnR5cGUuJCA9PSBcInZhclwiICYmIHgudHlwZS5jb250ZW50Lm5hbWUgPT0gbmFtZSkgcmV0dXJuIHhcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtuYW1lfSwgZ290ICR7KHgudHlwZSl9YClcbiAgICB9XG4gICAgeC50eXBlID0gbWt2YXIobmFtZSlcbiAgICByZXR1cm4geFxuICB9XG59KVxuXG5sZXQgYnVpbHRpbnM6IFJlY29yZDxzdHJpbmcsIHsgdHlwZTogQVNULCBpbXBsOiAoLi4uYXJnczpBU1RbXSkgPT4gQVNUIH0+ID0ge1xuICBudW1iZXI6IHByaW1pdGl2ZVR5cGUoXCJudW1iZXJcIiksXG4gIHN0cmluZzogcHJpbWl0aXZlVHlwZShcInN0cmluZ1wiKSxcbiAgZXE6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCB5ID0+IChudW1iZXIgKGYgeCB5KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiBta251bShcbiAgICAgICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fFxuICAgICAgKHguJCA9PSBcInN0cmluZ1wiICYmIHkuJCA9PSBcInN0cmluZ1wiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8ICh4ID09IHkpXG4gICAgICA/IDEgOiAwKVxuICB9LFxuICBhZGQ6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGY9PiBmbiB4IHkgPT4gKG51bWJlciAoZiAobnVtYmVyIHgpIChudW1iZXIgeSkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IHtcbiAgICAgIGlmICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIikgcmV0dXJuIG1rbnVtKHguY29udGVudCArIHkuY29udGVudClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBhZGQ6IGV4cGVjdGVkIG51bWJlcnMsIGdvdCAke3ByZXR0eUFTVCh4KX0gYW5kICR7cHJldHR5QVNUKHkpfWApXG4gICAgfVxuICB9LFxuICBpZmVsc2UgOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIFQgY29uZCB0aGVuIGVsc2UgPT4gKFQgKGYgKG51bWJlciBjb25kKSAoVCB0aGVuKSAoVCBlbHNlKSkpXCIpLmFzdCEsXG4gICAgaW1wbDogKGNvbmQsIHRoZW4sIGVscykgPT4ge1xuICAgICAgbGV0IHZhbCA9IGNvbmQuJCA9PSBcIm51bWJlclwiID8gY29uZC5jb250ZW50IDogY29uZC4kID09IFwic3RyaW5nXCIgPyBjb25kLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgcmV0dXJuIHZhbCA/IHRoZW4gOiBlbHNcbiAgICB9XG4gIH0sXG4gIHR5cGVvZjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0ISxcbiAgICBpbXBsOiAoeCkgPT4ge1xuICAgICAgaWYgKCF4LnR5cGUpIHJldHVybiBta2FwcChUWVBFT0YsIFt4XSlcbiAgICAgIHJldHVybiB4LnR5cGVcbiAgICB9XG4gIH1cbn1cblxubGV0IERFQlVHID0gMFxubGV0IGxvZ2dlclByZSA9IHByZSgpXG5ib2R5LnJlcGxhY2VDaGlscmVuKGxvZ2dlclByZSlcblxuXG50eXBlIFZpcyA9IE5PREUgfCBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsIHwgQVNUIHwgVmlzW10gfCBudW1iZXJcblxubGV0IGRlYnVnID0gKC4uLmFyZ3M6IFZpc1tdKSA9PiB7XG4gIGlmICghREVCVUcpIHJldHVyblxuICBsZXQgcHIgPSBsb2dnZXJQcmVcbiAgZm9yIChsZXQgYXJnIG9mIGFyZ3Mpe1xuICAgIGlmICh0eXBlb2YgYXJnID09IFwic3RyaW5nXCIgfHwgdHlwZW9mIGFyZyA9PSBcIm51bWJlclwiKSBwci5hcHBlbmQoU3RyaW5nKGFyZykpXG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSBbXCJbXCIsIC4uLmFyZywgXCJdXCJdLmZvckVhY2goYT0+IGRlYnVnKGEpKVxuICAgIGVsc2UgaWYgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IGFyZyA9PT0gbnVsbCkgcHIuYXBwZW5kKHNwYW4oU3RyaW5nKGFyZykpLnN0eWxlKHtjb2xvcjogY29sb3IuZ3JheX0pKVxuICAgIGVsc2UgaWYgKFwiJFwiIGluIGFyZyl7XG4gICAgICBpZiAoYXJnLiQgPT0gXCJOT0RFXCIpIHByLmFwcGVuZChhcmcpXG4gICAgICBlbHNlIHByLmFwcGVuZChhc3RWaWV3KGFyZykpXG4gICAgfVxuICB9XG59XG5cbmxldCBkZWJ1Z0NhbGwgPSA8QVJHUyBleHRlbmRzIGFueVtdLCBUPiAoZm46ICguLi5hcmdzOiBBUkdTKSA9PiBUKSA9PiAoLi4uYXJnczogQVJHUykgOiBUID0+IHtcbiAgZGVidWcoXCJAIFwiLCBmbi5uYW1lLCAuLi5hcmdzKVxuICBsZXQgb2xkcHJlID0gbG9nZ2VyUHJlXG4gIGxldCBjYWxscHJlID0gcHJlKCkuc3R5bGUoe2JvcmRlckxlZnQ6IFwiNHB4IHNvbGlkIFwiK2NvbG9yLmdyYXksIG1hcmdpbkxlZnQ6IFwiOHB4XCIsIHBhZGRpbmdMZWZ0OiBcIjhweFwifSlcbiAgbG9nZ2VyUHJlLmFwcGVuZChjYWxscHJlKVxuICBsb2dnZXJQcmUgPSBjYWxscHJlXG4gIGxldCByZXMgPSBmbiguLi5hcmdzKVxuICBsb2dnZXJQcmUgPSBvbGRwcmVcbiAgZGVidWcocmVzIGFzIGFueSlcbiAgcmV0dXJuIHJlc1xufVxuXG5cbmxldCBhc3RWaWV3ID0gKGFzdDogQVNUIHwgVmFsdWUpOiBOT0RFID0+IHtcbiAgbGV0IF92aWV3ID0gKGFzdDogQVNUIHwgVmFsdWUpOiBOT0RFID0+IHtcbiAgICBsZXQgZWwgPSBzcGFuKClcbiAgICBzd2l0Y2goYXN0LiQpe1xuICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gZWwuYXBwZW5kKFN0cmluZyhhc3QuY29udGVudCkpLnN0eWxlKHtjb2xvcjogY29sb3IuYmx1ZX0pICBcbiAgICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIGVsLmFwcGVuZChhc3QuY29udGVudC5uYW1lKVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBlbC5hcHBlbmQoIFwiZm4gKFwiLC4uLmFzdC5jb250ZW50LnZhcnMubWFwKGdvKSxcIikgPT4gXCIpLmFwcGVuZChnbyhhc3QuY29udGVudC5ib2R5KSlcbiAgICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGVsLmFwcGVuZChcIihcIiwgZ28oYXN0LmNvbnRlbnQuZm4pLCBcIiBcIiwgLi4uYXN0LmNvbnRlbnQuYXJncy5tYXAoYXJnPT5nbyhhcmcpKSwgXCIpXCIpXG4gICAgICBjYXNlIFwibGV0XCI6IHJldHVybiBlbC5hcHBlbmQoXCJsZXQgXCIsIGFzdC5jb250ZW50LnZhci5jb250ZW50Lm5hbWUsIFwiID0gXCIsIGdvKGFzdC5jb250ZW50LnZhbHVlKSwgXCIgaW4gXCIsIGdvKGFzdC5jb250ZW50LmJvZHkpKVxuICAgICAgZGVmYXVsdDogcmV0dXJuIGVsLmFwcGVuZChgWyR7YXN0LiR9XWApXG4gICAgfSAgXG4gIH1cbiAgbGV0IGdvID0gKGFzdDpBU1R8VmFsdWUpOiBOT0RFID0+IHtcbiAgICBsZXQgZWwgPSBzcGFuKF92aWV3KGFzdCkpLnN0eWxlKHtjb2xvcjogY29sb3JPZihhc3QpLCBjdXJzb3I6IFwicG9pbnRlclwifSlcbiAgICAub25jbGljayhlPT57XG4gICAgICBlbC5yZXBsYWNlQ2hpbHJlbihcbiAgICAgICAgc3BhbihcIlRZUEU6XCIpLnN0eWxlKHtjb2xvcjogY29sb3IuZ3JheX0pXG4gICAgICAgIC5vbmNsaWNrKGU9PntcbiAgICAgICAgICBlbC5yZXBsYWNlQ2hpbHJlbihfdmlldyhhc3QpKVxuICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgICAgfSksXG4gICAgICAgIGFzdC50eXBlID8gYXN0Vmlldyhhc3QudHlwZSkgOiBcIipcIixcbiAgICAgICAgZ28oYXN0KVxuICAgICAgKVxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIH0pXG4gICAgcmV0dXJuIGVsXG4gIH1cbiAgcmV0dXJuIGRpdihnbyhhc3QpKS5zdHlsZSh7cGFkZGluZzpcIi40ZW1cIiwgYm9yZGVyOiBcIjFweCBzb2xpZCBcIitjb2xvci5ncmF5LCBib3JkZXJSYWRpdXM6IFwiLjRlbVwiLCBtYXJnaW46XCIuNGVtIDBcIn0pXG59XG5cbmFzdFZpZXcgPSBkZWJ1Z0NhbGwoYXN0VmlldylcblxudHlwZSBOZXV0cmFsID0gVmFyIHwgUHJpbSB8IFRhZzxcIk5hcHBcIiwge2ZuOiBOZXV0cmFsLCBhcmdzOiBWYWx1ZVtdfT5cbnR5cGUgVmFsdWUgPSBUYWc8XCJmdW5jdGlvblwiLCB7ZW52OiBFbnYsIHZhcnM6IFZhcltdLCBib2R5OiBBU1R9PiB8IE5ldXRyYWxcbnR5cGUgRW52ID0gUmVjb3JkPHN0cmluZywgVmFsdWU+XG5cbmNvbnN0IGV2YWx1YXRlID0gKHRlcm06QVNULCBlbnY6IEVudik6IFZhbHVlID0+IHtcbiAgc3dpdGNoICh0ZXJtLiQpIHtcbiAgICBjYXNlIFwidmFyXCI6IHtcbiAgICAgIGlmIChlbnZbdGVybS5jb250ZW50Lm5hbWVdKSByZXR1cm4gZW52W3Rlcm0uY29udGVudC5uYW1lXVxuICAgICAgcmV0dXJuIHRlcm1cbiAgICB9XG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHsuLi50ZXJtLmNvbnRlbnQsIGVudn0pIFxuICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGFwcGx5KFxuICAgICAgZXZhbHVhdGUodGVybS5jb250ZW50LmZuLCBlbnYpLFxuICAgICAgdGVybS5jb250ZW50LmFyZ3MubWFwKGFyZyA9PiBldmFsdWF0ZShhcmcsIGVudikpXG4gICAgKVxuICAgIGNhc2UgXCJsZXRcIjpcbiAgICAgIHJldHVybiBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQuYm9keSwgey4uLmVudiwgW3Rlcm0uY29udGVudC52YXIuY29udGVudC5uYW1lXTogZXZhbHVhdGUodGVybS5jb250ZW50LnZhbHVlLCBlbnYpfSlcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gdGVybVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGV2YWx1YXRlIHRlcm0gb2YgdHlwZSAke3Rlcm0uJH1gKVxufVxuXG5jb25zdCBhcHBseSA9IChmbjogVmFsdWUsIGFyZ3M6IFZhbHVlW10pOiBWYWx1ZSA9PiB7XG4gIGlmIChmbi4kID09IFwiZnVuY3Rpb25cIil7XG5cbiAgICBpZiAoZm4uY29udGVudC52YXJzLmxlbmd0aCAhPSBhcmdzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2ZuLmNvbnRlbnQudmFycy5sZW5ndGh9IGFyZ3VtZW50cywgZ290ICR7YXJncy5sZW5ndGh9YClcbiAgICBsZXQgZW52ID0gey4uLmZuLmNvbnRlbnQuZW52fVxuICAgIGZuLmNvbnRlbnQudmFycy5mb3JFYWNoKCh2LGkpPT4gZW52W3YuY29udGVudC5uYW1lXSA9IGFyZ3NbaV0pXG4gICAgcmV0dXJuIGV2YWx1YXRlKGZuLmNvbnRlbnQuYm9keSwgZW52KVxuICB9XG4gIHJldHVybiBta0FzdChcIk5hcHBcIiwge2ZuLCBhcmdzfSlcbn1cblxubGV0IGNvdW50ZXIgPSAwO1xuXG5jb25zdCByZWFkYmFjayA9ICh2YWw6IFZhbHVlKTogQVNUID0+IHtcbiAgaWYgKHZhbC4kID09IFwiZnVuY3Rpb25cIilcbiAgICByZXR1cm4gbWtmdW4odmFsLmNvbnRlbnQudmFycywgcmVhZGJhY2soYXBwbHkodmFsLCB2YWwuY29udGVudC52YXJzKSkpXG4gIGlmICh2YWwuJCA9PSBcIk5hcHBcIikgcmV0dXJuIG1rYXBwKHJlYWRiYWNrKHZhbC5jb250ZW50LmZuKSwgdmFsLmNvbnRlbnQuYXJncy5tYXAocmVhZGJhY2spKVxuICByZXR1cm4gdmFsXG59XG5cblxuZXhwb3J0IGNvbnN0IHJ1biA9IChhc3Q6IEFTVCkgPT4gcmVhZGJhY2soZXZhbHVhdGUoYXN0LCB7fSkpXG5cbkRFQlVHID0gMVxuXG5sZXQgYXN0ID0gcGFyc2UoJyhmbiB4ID0+IGZuIHkgPT4geCAzKScpLmFzdFxuXG5sZXQgcmVzID0gcnVuKGFzdClcblxuXG5ERUJVRyA9IDBcbiIsCiAgICAiXG5cblxuXG5pbXBvcnQgeyBib2R5LCBodG1sLCBzcGFuICwgZnJvbUhUTUwsIGgyLCBkaXZ9IGZyb20gXCIuL2h0bWxcIjtcbmltcG9ydCB7IGVkaXRvciB9IGZyb20gXCIuL2VkaXRvclwiO1xuaW1wb3J0IHsgcGFyc2UsIHByZXR0eUFTVCwgdHlwZSBBU1QsIHR5cGUgU3BhbiwgdHlwZSBTeW50YXhOb2RlIH0gZnJvbSBcIi4vcGFyc2VyXCI7XG5pbXBvcnQgeyBnZXRkZWYgfSBmcm9tIFwiLi9sc3BcIlxuaW1wb3J0IHsgQU5ZLCBydW4gfSBmcm9tIFwiLi9ydW50aW1lXCJcbmltcG9ydCB7IGNvbG9yIH0gZnJvbSBcIi4vaHRtbFwiO1xuXG5cblxuY29uc3QgYWJvdXRfdGV4dCA9IGBcblxuLy8gVGhpcyBpcyBhIHRveSBjb2RlIGVkaXRvciBzdGlsbCBpbiBkZXZlbG9wbWVudC5cblxuLy8gdGhlIGdvYWwgaXMgdG8gYnVpbGQgYSBsYW5ndWFnZSB3aXRoOlxuXG4vLyBleHRyZW1lbHkgbWluaW1hbCBzeW50YXhcbi8vIGZpcnN0IGNsYXNzIHN1cHBvcnQgZm9yIHR5cGVzIGFzIHZhbHVlc1xuLy8gZmlyc3QgY2FzcyBMU1AgcHJvZ3JhbW5nIGluIGEgc3RyYWlnaHRmb3J3YXJkIHdheS5cblxuLy8gaG92ZXIgb3ZlciB4IHRvIHNlZSBpdHMgaW5mZXJyZWQgdHlwZVxubGV0IG4gPSAyMiBpblxuXG4vLyB0aGlzIGlzIGhvdyB0eXBlcyBhcmUgYW5ub3RhdGVkLiB0eXBlcyBhcmUgZXNzZW50aWFsbHkganVzdCBmdW5jdGlvbnMgb3ZlciB2YWx1ZXMuXG5sZXQgayA9IChudW1iZXIgMzMpIGluXG5sZXQgdSA9IChzdHJpbmcgXCJobGxvXCIpIGluXG5cbi8vIHVudHlwZWQgaWRcbmxldCBpZCA9IGZuIHggPT4geCBpblxuXG4vLyBudW1iZXIgdHlwZWQgaWRcbmxldCBpZG4gPSBmbiB4ID0+IChudW1iZXIgeCkgaW5cblxuLy8gdHlwZSBvZiBudW1iZXIgLT4gbnVtYmVyXG5sZXQgVCA9IGZuIGYgPT4gZm4gKG51bWJlciB4KSA9PiAobnVtYmVyIChmIHgpKSBpblxuXG5sZXQgX2lkID0gKFQgaWQpIGluXG5cbi8vbGV0IGJhZCA9IChfaWQgXCJlXCIpIGluXG5cbmxldCByID0gKGlkIFwiMlwiKSBpblxuXG4vLyB0aGlzIGlzIHdpbGwgcmVzdWx0IGluIHR5cGUgZXJyb3IuXG4vLyBsZXQgQkFEID0gKGlkbl8gXCIyXCIpIGluXG5cbihudW1iZXIgc3QpXG5gXG5cblxuXG5cbmxldCBvdXR2aWV3ID0gaHRtbCgncHJlJykoKS5zdHlsZSh7XG4gIGJvcmRlclRvcDogXCIxcHggc29saWQgXCIrY29sb3IuY29sb3IsXG4gIHBhZGRpbmdUb3A6IFwiMTZweFwiLFxufSlcblxubGV0IGFzdDogQVNUIHwgdW5kZWZpbmVkXG5sZXQgY3VycmVudEFzdE1hcDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBbXVxuXG5cbmxldCBjb2RlOnN0cmluZyA9ICcnXG5cbmxldCBFZGl0ID0gZWRpdG9yKFxuICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImxpbmVzXCIpID8/IGFib3V0X3RleHQsXG4gIHM9PiB7XG4gICAgdHJ5e1xuICAgICAgbGV0IHBhcnNlZCA9IHBhcnNlKHMpXG4gICAgICBhc3QgPSBwYXJzZWQuYXN0XG4gICAgICBjdXJyZW50QXN0TWFwID0gcGFyc2VkLmFzdG1hcFxuICAgICAgY29kZSA9IHNcbiAgICAgIGxldCByZXMgPSBydW4oYXN0KVxuICAgICAgb3V0dmlldy5lbC50ZXh0Q29udGVudCA9IHByZXR0eUFTVChyZXMpXG5cbiAgICB9Y2F0Y2goZSl7XG4gICAgICBhc3QgPSB1bmRlZmluZWRcbiAgICAgIGN1cnJlbnRBc3RNYXAgPSBbXVxuICAgICAgb3V0dmlldy5lbC50ZXh0Q29udGVudCA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKVxuICAgIH1cbiAgfSxcbiAgKCk9PiBjdXJyZW50QXN0TWFwLFxuICAocmVxKSA9PiB7XG4gICAgbGV0IGRlZiA9IHJlcS4kID09IFwidmFyXCIgPyBnZXRkZWYoYXN0ISwgcmVxKSA6IHVuZGVmaW5lZFxuICAgIGlmIChkZWYpIEVkaXQuc2V0Q3Vyc29yKHtyb3c6IGRlZi5zcGFuLnN0YXJ0LmxpbmUtMSwgY29sOiBkZWYuc3Bhbi5zdGFydC5jb2wtMX0pXG4gIH0sXG4gIChub2RlKSA9PiB7XG4gICAgaWYgKG5vZGUuJCA9PT0gXCJjb21tZW50XCIpIHJldHVybiBbJycsIFtdXVxuXG4gICAgbGV0IHN0ciA9IChub2RlLiQgKyBcIjogXCIpXG4gICAgbGV0IG1hcCA6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gc3RyLnNwbGl0KCcnKS5tYXAoYz0+IHVuZGVmaW5lZClcblxuICAgIGxldCBhc3Q6QVNUID0gbm9kZS50eXBlID8gbm9kZS50eXBlIDogQU5ZXG5cbiAgICBsZXQgY28gPSBwcmV0dHlBU1QoYXN0KVxuICAgIG1hcC5wdXNoKC4uLnBhcnNlKGNvKS5hc3RtYXApXG4gICAgc3RyICs9IGNvXG5cbiAgICByZXR1cm4gW3N0ciwgbWFwXVxuICB9XG4pXG5cblxuXG5cbmJvZHkuc3R5bGUoe3BhZGRpbmc6IFwiNDRweFwiLGZvbnRGYW1pbHk6IFwic2Fucy1zZXJpZlwiLH0pXG5cblxubGV0IGJ1dHRuID0gKHQ6c3RyaW5nLCBvbkNsaWNrOigpID0+IHZvaWQpID0+IHNwYW4odCwgb25DbGljaykuc3R5bGUoe2NvbG9yOiBcImdyYXlcIiwgYm9yZGVyOiBcIjFweCBzb2xpZCBncmF5XCIsIGJvcmRlclJhZGl1czogXCI0cHhcIiwgcGFkZGluZzogXCIycHggNHB4XCIsIG1hcmdpblJpZ2h0OiBcIjhweFwifSlcblxuYm9keS5hcHBlbmQoXG4gIGRpdihcbiAgICBzcGFuKCfinIjvuI4nKS5zdHlsZSh7Zm9udFNpemU6IFwiM2VtXCIsIG1hcmdpblJpZ2h0OiBcIjhweFwifSksXG4gICAgc3BhbihcIk1pR1wiKS5zdHlsZSh7Zm9udFNpemU6IFwiMS41ZW1cIiwgZm9udFdlaWdodDogXCJib2xkXCIsIGZvbnRGYW1pbHk6IFwibW9ub3NwYWNlXCJ9KVxuICApLnN0eWxlKHtkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgbWFyZ2luQm90dG9tOiBcIjE2cHhcIiwgY29sb3I6IFwiZ3JheVwifSksXG5cbiAgRWRpdC5lbCxcbiAgb3V0dmlldyxcbiAgYnV0dG4oXCJhYm91dFwiLCAoKSA9PiBFZGl0LnNldFRleHQoYWJvdXRfdGV4dCkpLFxuICBidXR0bihcImdpdGh1YlwiLCAoKSA9PiB3aW5kb3cub3BlbihcImh0dHBzOi8vZ2l0aHViLmNvbS9ka29ybWFubi9teWVkaXRv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TSxPQUFPO0FBQUEsSUFDYixnQkFBZ0IsT0FBTztBQUFBLElBQ3ZCLE9BQU87QUFBQSxJQUNQLElBQUksT0FBTSxJQUFJLElBQUc7QUFBQSxJQUNqQixRQUFRLEdBQUcsY0FBYyxVQUFVLElBQUc7QUFBQSxJQUV2QyxPQUFNLEdBQUU7QUFBQSxJQUNQLE9BQU07QUFBQSxJQUNOLGdCQUFnQixDQUFDO0FBQUEsSUFDakIsUUFBUSxHQUFHLGNBQWMsYUFBYSxRQUFRLEVBQUUsVUFBVSxPQUFPLENBQUM7QUFBQTtBQUFBLEdBR3RFLE1BQUssZUFDTCxDQUFDLFFBQVE7QUFBQSxFQUNQLElBQUksTUFBTSxJQUFJLEtBQUssUUFBUSxPQUFPLE1BQU0sR0FBRyxJQUFJO0FBQUEsRUFDL0MsSUFBSTtBQUFBLElBQUssS0FBSyxVQUFVLEVBQUMsS0FBSyxJQUFJLEtBQUssTUFBTSxPQUFLLEdBQUcsS0FBSyxJQUFJLEtBQUssTUFBTSxNQUFJLEVBQUMsQ0FBQztBQUFBLEdBRWpGLENBQUMsU0FBUztBQUFBLEVBQ1IsSUFBSSxLQUFLLE1BQU07QUFBQSxJQUFXLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUFBLEVBRXhDLElBQUksTUFBTyxLQUFLLElBQUk7QUFBQSxFQUNwQixJQUFJLE1BQW1DLElBQUksTUFBTSxFQUFFLEVBQUUsSUFBSSxPQUFDO0FBQUEsSUFBRztBQUFBLEdBQVM7QUFBQSxFQUV0RSxJQUFJLE9BQVUsS0FBSyxPQUFPLEtBQUssT0FBTztBQUFBLEVBRXRDLElBQUksS0FBSyxVQUFVLElBQUc7QUFBQSxFQUN0QixJQUFJLEtBQUssR0FBRyxNQUFNLEVBQUUsRUFBRSxNQUFNO0FBQUEsRUFDNUIsT0FBTztBQUFBLEVBRVAsT0FBTyxDQUFDLEtBQUssR0FBRztBQUFBLENBRXBCO0FBS0EsS0FBSyxNQUFNLEVBQUMsU0FBUyxRQUFPLFlBQVksYUFBYSxDQUFDO0FBR3RELElBQUksUUFBUSxDQUFDLEdBQVUsWUFBdUIsS0FBSyxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUMsT0FBTyxRQUFRLFFBQVEsa0JBQWtCLGNBQWMsT0FBTyxTQUFTLFdBQVcsYUFBYSxNQUFLLENBQUM7QUFFM0ssS0FBSyxPQUNILElBQ0UsS0FBSyxJQUFHLEVBQUUsTUFBTSxFQUFDLFVBQVUsT0FBTyxhQUFhLE1BQUssQ0FBQyxHQUNyRCxLQUFLLEtBQUssRUFBRSxNQUFNLEVBQUMsVUFBVSxTQUFTLFlBQVksUUFBUSxZQUFZLFlBQVcsQ0FBQyxDQUNwRixFQUFFLE1BQU0sRUFBQyxTQUFTLFFBQVEsWUFBWSxVQUFVLGNBQWMsUUFBUSxPQUFPLE9BQU0sQ0FBQyxHQUVwRixLQUFLLElBQ0wsU0FDQSxNQUFNLFNBQVMsTUFBTSxLQUFLLFFBQVEsVUFBVSxDQUFDLEdBQzdDLE1BQU0sVUFBVSxNQUFNLE9BQU8sS0FBSyxzQ0FBc0MsQ0FBQyxDQUMzRTsiLAogICJkZWJ1Z0lkIjogIjlDRDgwNjNGQUM1RDc5MDE2NDc1NkUyMTY0NzU2RTIxIiwKICAibmFtZXMiOiBbXQp9
