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
  --cyan: #56b6c2;

  --gray: #abb2bf88;
  --color: #e7eaf0;
  --background: #2a272a;
  }
  @media (prefers-color-scheme: light) {
    body{
      --red: #e06c75;
      --green: #98c379;
      --blue: #419fec;
      --yellow: #ddb15f;
      --purple: #c678dd;
      --cyan: #56b6c2;

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
var colorOf = (node) => node == undefined ? color.gray : node.$ === "comment" ? color.gray : node.$ === "number" || node.$ === "string" ? color.yellow : node.$ === "var" ? color.purple : node.$ === "let" || node.$ == "function" ? color.blue : node.$ === "app" ? color.green : node.$ === "error" ? color.red : color.color;
var editor = (oninput, getAstMap, goToDef, hoverInfo) => {
  let lines = localStorage.getItem("lines")?.split(`
`) ?? [""];
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
    let code = lines.join(`
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
    if (hist[hist.length - 1] != code) {
      localStorage.setItem("lines", code);
      oninput(code);
      hist.push(code);
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
        let info = hoverInfo(ast);
        if (info) {
          let tooltip = div(info).style({
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
var annot = (ast, type) => {
  if (ast.type && prettyAST(ast.type) != prettyAST(type))
    throw new Error(`Type error: expected ${prettyAST(type)}, got ${prettyAST(ast.type)}`);
  ast.type = type;
  return ast;
};
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
    if (x.$ == "var") {
      if (x.type) {
        if (x.type.$ == "var" && x.type.content.name == name)
          return x;
        throw new Error(`Type error: expected ${name}, got ${prettyAST(x.type)}`);
      }
      return annot(x, mkvar(name));
    } else if (x.$ == name)
      return annot(x, mkvar(name));
    throw new Error(`Type error: expected ${name}, got ${prettyAST(x)}`);
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
    type: parse("fn f => fn x => (type (f x))").ast,
    impl: (x) => {
      if (!x.type)
        return mkapp(TYPEOF, [x]);
      return x.type;
    }
  }
};
var run = (ast) => {
  let lookup = (name, env) => {
    if (!env)
      return null;
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
  const go = (ast2, env) => {
    switch (ast2.$) {
      case "number": {
        ast2.type = NUMBER;
        return ast2;
      }
      case "string": {
        ast2.type = STRING;
        return ast2;
      }
      case "var": {
        if (builtins[ast2.content.name]) {
          let def = builtins[ast2.content.name];
          return annot(ast2, def.type);
        }
        let hit = lookup(ast2.content.name, env);
        if (hit) {
          if (hit.binder.type)
            annot(ast2, hit.binder.type);
          return hit.value;
        }
        return ast2;
      }
      case "let": {
        let value = go(ast2.content.value, env);
        if (ast2.content.var.type == undefined)
          annot(ast2.content.var, value.type);
        env = bindValue(env, ast2.content.var, value, true);
        let res = go(ast2.content.body, env);
        if (res.type)
          annot(ast2, res.type);
        return res;
      }
      case "function": {
        if (ast2.content.env == undefined)
          ast2.content.env = env;
        let body2 = go(ast2.content.body, ast2.content.vars.reduce((env2, v) => bind(env2, v, v), ast2.content.env));
        let fvar = mkvar(freename(env));
        let ftype = mkfun([fvar], mkfun(ast2.content.vars, ast2.content.body.type ?? mkapp(TYPEOF, [body2])));
        annot(ast2, ftype);
        let res = mkfun(ast2.content.vars, body2);
        res.content.env = ast2.content.env;
        return annot(res, ftype);
      }
      case "app": {
        let fn = go(ast2.content.fn, env);
        let args = ast2.content.args.map((arg) => go(arg, env));
        if (fn.$ == "var" && builtins[fn.content.name]) {
          let res = builtins[fn.content.name].impl(...args);
          if (res.type)
            annot(ast2, res.type);
          return res;
        }
        if (fn.$ == "function") {
          if (fn.content.vars.length !== args.length)
            throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`);
          let callenv = fn.content.env;
          callenv = fn.content.vars.reduce((env2, v, i) => bindValue(env2, v, args[i], true), callenv);
          let res = go(fn.content.body, callenv);
          if (res.type)
            annot(ast2, res.type);
          return res;
        }
        throw new Error(`Cannot apply non-function ${prettyAST(fn)}`);
      }
      default:
        return ast2;
    }
  };
  return go(ast, null);
};
var samples = [
  "22 | number | 22",
  "let x = 22 in x | number | 22",
  "let (number x) = 22 in x | number | 22",
  "fn x => x | fn x0 => fn x => (typeof x)",
  "(number 22) | number | 22",
  "fn (number x) => x | fn x0 => fn (number x) => number | fn (number x) => x",
  "fn x => (number x) | fn x0 => fn (number x) => number",
  "(fn x => x 22) | number",
  "(fn (number x) => x 22) | number",
  "(fn (string x) => x 22) | error",
  "let id = fn x => x in fn y => (id y) | fn x0 => fn y => (typeof y) | fn y => y",
  "fn (number x) => (string x) | error"
].map((code) => code.split("|").map((s) => s.trim()));
var results = table().style({
  width: "100%",
  whiteSpace: "pre"
});
for (let [code, expectedType, expectedResult] of samples) {
  let ast = parse(code);
  let res = undefined;
  try {
    res = run(ast.ast);
  } catch (e) {
    if (expectedType != "error")
      console.error(`Error running code: ${code}
`, e);
  }
  let typeStr = res ? res.type ? prettyAST(res.type) : "no type" : "error";
  let resStr = res ? prettyAST(res) : "error";
  let check = typeStr == (expectedType ?? typeStr) && resStr == (expectedResult ?? resStr);
  if (!check) {
    results.append(tr(td(code), td(typeStr).style({ color: typeStr == (expectedType ?? typeStr) ? "green" : "red", padding: "0 8px" }), td(resStr).style({ color: resStr == (expectedResult ?? resStr) ? "green" : "red" })).style({
      borderBottom: "1px solid " + color.color
    }));
    body.append(div(results).style({
      position: "absolute",
      border: "1px solid " + color.color,
      padding: "16px",
      backgroundColor: color.background
    }));
  }
}

// src/main.ts
if (window.location.origin.includes("localhost"))
  (async () => {
    let version = await fetch("/version").then((res) => res.text()).catch((e) => "0");
    while (true) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        if (await fetch("/version").then((res) => res.text()).catch((e) => "0") != version)
          window.location.reload();
      } catch (e) {
        break;
      }
    }
  })();
var outview = html("pre")().style({
  borderTop: "1px solid " + color.color,
  paddingTop: "16px"
});
var ast;
var currentAstMap = [];
var code = "";
var Edit = editor((s) => {
  try {
    let parsed = parse(s);
    ast = parsed.ast;
    currentAstMap = parsed.astmap;
    code = s;
    let res = run(ast);
    outview.el.textContent = prettyAST(res);
  } catch (e) {
    ast = undefined;
    currentAstMap = [];
    outview.el.textContent = e instanceof Error ? e.message : String(e);
  }
}, () => currentAstMap, (req) => {
  let def = req.$ == "var" ? getdef(ast, req) : undefined;
  if (def)
    Edit.setCursor({ row: def.span.start.line - 1, col: def.span.start.col - 1 });
}, (node) => {
  if (node.$ === "comment")
    return;
  return node.$ + ": " + (node.type ? prettyAST(node.type) : node.$ == "var" ? prettyAST(getdef(ast, node)?.type ?? ANY) : "XX");
});
body.style({ padding: "44px", fontFamily: "sans-serif" });
var buttn = (t, onClick) => span(t, onClick).style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginRight: "8px" });
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
let T = fn f=> fn x => (number (f (number x))) in

// annoted id

let idn_ = (T id) in

let r= (id "2") in

// this is will result in type error.
// let BAD = (idn_ "2") in

(id 2)
`;
body.append(div(span("✈︎").style({ fontSize: "3em", marginRight: "8px" }), span("MiG").style({ fontSize: "1.5em", fontWeight: "bold", fontFamily: "monospace" })).style({ display: "flex", alignItems: "center", marginBottom: "16px", color: "gray" }), Edit.el, outview, buttn("about", () => Edit.setText(about_text)), buttn("github", () => window.open("https://github.com/dkormann/myeditor")));

//# debugId=7B1B2E183EF5F77164756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjogKE5PREUgfCBzdHJpbmcpW10pID0+IE5PREUsXG4gIHN0eWxlOiAoc3R5bGVzOiBQYXJ0aWFsPENTU1N0eWxlRGVjbGFyYXRpb24+KSA9PiBOT0RFLFxuICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiBOT0RFXG59XG5cbmV4cG9ydCB0eXBlIEFSRyA9IE5PREUgfCBzdHJpbmcgfCAoKGU6TW91c2VFdmVudCk9PnZvaWQpXG5cbmV4cG9ydCBjb25zdCBodG1sID0gPEsgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+ICh0YWc6SykgPT4gKC4uLmNoaWxkcmVuOkFSR1tdKTogTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPiA9PiB7XG4gIGxldCBvbmNsaWNrID0gY2hpbGRyZW4uZmluZChjID0+IHR5cGVvZiBjID09PSBcImZ1bmN0aW9uXCIpIGFzIEZ1bmN0aW9uXG4gIGxldCBlbCA9IGZyb21IVE1MIChkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZykpLmFwcGVuZCguLi4gY2hpbGRyZW4uZmlsdGVyKGMgPT4gdHlwZW9mIGMgIT09IFwiZnVuY3Rpb25cIikgYXMgKE5PREUgfCBzdHJpbmcpW10pIGFzIE5PREUgPEhUTUxFbGVtZW50VGFnTmFtZU1hcFtLXT47XG4gIGlmIChvbmNsaWNrKSBlbC5lbC4gb25jbGljayA9IChvbmNsaWNrIGFzIChlOk1vdXNlRXZlbnQpPT52b2lkKVxuICBcbiAgcmV0dXJuIGVsXG59XG5cblxuZXhwb3J0IGNvbnN0IGZyb21IVE1MICA9IDxIIGV4dGVuZHMgSFRNTEVsZW1lbnQ+ICAoZWw6SCk6IE5PREUgPEg+ID0+IHtcbiAgbGV0IG5vZGUgOiBOT0RFPEg+ID0ge1xuICAgICQ6IFwiTk9ERVwiLFxuICAgIGVsLFxuICAgIGFwcGVuZDogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNoaWxkID09PSBcInN0cmluZ1wiKSBlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGlsZCkpO1xuICAgICAgICBlbHNlIGVsLmFwcGVuZENoaWxkKGNoaWxkLmVsKTtcblxuICAgICAgfSk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBlbC5yZXBsYWNlQ2hpbGRyZW4oKVxuICAgICAgcmV0dXJuIG5vZGUuYXBwZW5kKC4uLmNoaWxkcmVuKVxuICAgIH0sXG4gICAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IHtcbiAgICAgIE9iamVjdC5hc3NpZ24oZWwuc3R5bGUsIHN0eWxlcyk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgYXNzaWduOiAoaHRtbFByb3BzOiBQYXJ0aWFsPEhUTUxFbGVtZW50PikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbCwgaHRtbFByb3BzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfVxuICB9O1xuICByZXR1cm4gbm9kZVxufVxuXG5cbmV4cG9ydCBjb25zdCBkaXYgPSBodG1sKFwiZGl2XCIpO1xuZXhwb3J0IGNvbnN0IHNwYW4gPSBodG1sKFwic3BhblwiKTtcbmV4cG9ydCBjb25zdCBwID0gaHRtbChcInBcIik7XG5leHBvcnQgY29uc3QgYm9keSA9IGZyb21IVE1MKGRvY3VtZW50LmJvZHkpO1xuZXhwb3J0IGNvbnN0IGgxID0gaHRtbChcImgxXCIpO1xuZXhwb3J0IGNvbnN0IGgyID0gaHRtbChcImgyXCIpO1xuZXhwb3J0IGNvbnN0IGgzID0gaHRtbChcImgzXCIpO1xuZXhwb3J0IGNvbnN0IGg0ID0gaHRtbChcImg0XCIpO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gaHRtbChcInRhYmxlXCIpO1xuZXhwb3J0IGNvbnN0IHRyID0gaHRtbChcInRyXCIpO1xuZXhwb3J0IGNvbnN0IHRkID0gaHRtbChcInRkXCIpO1xuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNTZiNmMyO1xuXG4gIC0tZ3JheTogI2FiYjJiZjg4O1xuICAtLWNvbG9yOiAjZTdlYWYwO1xuICAtLWJhY2tncm91bmQ6ICMyYTI3MmE7XG4gIH1cbiAgQG1lZGlhIChwcmVmZXJzLWNvbG9yLXNjaGVtZTogbGlnaHQpIHtcbiAgICBib2R5e1xuICAgICAgLS1yZWQ6ICNlMDZjNzU7XG4gICAgICAtLWdyZWVuOiAjOThjMzc5O1xuICAgICAgLS1ibHVlOiAjNDE5ZmVjO1xuICAgICAgLS15ZWxsb3c6ICNkZGIxNWY7XG4gICAgICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgICAgIC0tY3lhbjogIzU2YjZjMjtcblxuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuY29uc3QgY29sb3JPZiA9IChub2RlOiBTeW50YXhOb2RlIHwgdW5kZWZpbmVkKTogc3RyaW5nID0+IFxuICAobm9kZSA9PSB1bmRlZmluZWQpID8gY29sb3IuZ3JheSA6XG4gIChub2RlLiQgPT09IFwiY29tbWVudFwiKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcIm51bWJlclwiIHx8IG5vZGUuJCA9PT0gXCJzdHJpbmdcIiApID8gY29sb3IueWVsbG93IDpcbiAgKG5vZGUuJCA9PT0gXCJ2YXJcIikgPyBjb2xvci5wdXJwbGUgOlxuICAobm9kZS4kID09PSBcImxldFwiIHx8IG5vZGUuJCA9PSBcImZ1bmN0aW9uXCIgKSA/IGNvbG9yLmJsdWUgOlxuICAobm9kZS4kID09PSBcImFwcFwiKSA/IGNvbG9yLmdyZWVuIDpcbiAgKG5vZGUuJCA9PT0gXCJlcnJvclwiKSA/IGNvbG9yLnJlZCA6XG4gIGNvbG9yLmNvbG9yXG5cblxubGV0IGUgPSAyIGFzIG51bWJlclxuXG5leHBvcnQgY29uc3QgZWRpdG9yID0gKG9uaW5wdXQ6IChzOnN0cmluZyk9PnZvaWQsXG4gIGdldEFzdE1hcCA6ICgpPT4gKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdLFxuICBnb1RvRGVmIDogKGFzdDogU3ludGF4Tm9kZSkgPT4gdm9pZCxcbiAgaG92ZXJJbmZvOiAoYXN0OiBTeW50YXhOb2RlKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibGluZXNcIik/LnNwbGl0KFwiXFxuXCIpID8/IFtcIlwiXVxuICBsZXQgY3Vyc29yIDogUG9zICYge3NlbGVjdGlvbj8gOiBQb3N9ID0ge2NvbDowLCByb3c6MH07XG5cbiAgbGV0IGVsID0gaHRtbChcInByZVwiKSgpXG4gIC5zdHlsZSh7XG4gICAgdXNlclNlbGVjdDogXCJub25lXCIsXG4gICAgY3Vyc29yOiBcInRleHRcIixcbiAgfSlcblxuXG4gIGxldCBoaXN0IDogc3RyaW5nW10gPSBbXVxuICBsZXQgZWxlbWVudHMgPSBuZXcgV2Vha01hcDxIVE1MRWxlbWVudCwge3BvczpQb3MsIGFzdD86IFN5bnRheE5vZGV9PigpXG4gIGxldCBhc3RtYXA6IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSA9IFtdXG5cbiAgbGV0IHBsZXNzID0gKGE6IFBvcywgYjogUG9zKSA9PiBhLnJvdyA8IGIucm93IHx8IChhLnJvdyA9PSBiLnJvdyAmJiBhLmNvbCA8IGIuY29sKVxuICBsZXQgcGxlc3NlcSA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPD0gYi5jb2wpXG5cbiAgbGV0IHNlbHJhbmdlID0gKCkgOiB1bmRlZmluZWQgfCBbUG9zLCBQb3NdID0+IHtcbiAgICBpZiAoIWN1cnNvci5zZWxlY3Rpb24pIHJldHVybiB1bmRlZmluZWRcbiAgICBpZiAoY3Vyc29yLnJvdyA9PSBjdXJzb3Iuc2VsZWN0aW9uLnJvdyAmJiBjdXJzb3IuY29sID09IGN1cnNvci5zZWxlY3Rpb24uY29sKSB7XG4gICAgICBjdXJzb3Iuc2VsZWN0aW9uID0gdW5kZWZpbmVkXG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIGlmIChwbGVzc2VxKGN1cnNvciwgY3Vyc29yLnNlbGVjdGlvbikpIHJldHVybiBbY3Vyc29yLCBjdXJzb3Iuc2VsZWN0aW9uXVxuICAgIGVsc2UgcmV0dXJuIFtjdXJzb3Iuc2VsZWN0aW9uLCBjdXJzb3JdXG4gIH1cblxuICBjb25zdCByZW5kZXIgPSAoKSA9PiB7XG4gICAgbGV0IGNvZGUgPSBsaW5lcy5qb2luKFwiXFxuXCIpXG4gICAgbGV0IHNjb2wgPSBNYXRoLm1pbihjdXJzb3IuY29sLCBsaW5lc1tjdXJzb3Iucm93XT8ubGVuZ3RoID8/IDApXG5cbiAgICBsZXQgY2hhcnM6IEhUTUxFbGVtZW50W10gPSBbXVxuXG5cbiAgICBsZXQgbWtjb2xvciA9ICgpID0+IHtcbiAgICAgIGNoYXJzLmZvckVhY2goKGMsIGkpPT57XG4gICAgICAgIGxldCBhc3QgPSBhc3RtYXBbaV1cbiAgICAgICAgbGV0IGNvbG9yID0gY29sb3JPZihhc3QpXG4gICAgICAgIGlmIChjb2xvcikgYy5zdHlsZS5jb2xvciA9IGNvbG9yXG4gICAgICAgIGVsc2UgYy5zdHlsZS5jb2xvciA9IFwiXCJcbiAgICAgICAgZWxlbWVudHMuZ2V0KGMpIS5hc3QgPSBhc3RcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuXG5cbiAgICBlbC5yZXBsYWNlQ2hpbHJlbiguLi5saW5lcy5tYXAoKGxpbmUscm93KT0+e1xuICAgICAgbGV0IHBhciA9IHAoXG4gICAgICAgIC4uLmxpbmUuc3BsaXQoXCJcIikuY29uY2F0KCcgJykubWFwKFxuICAgICAgICAgIChjaGFyLGNvbCk9PntcblxuICAgICAgICAgICAgbGV0IGNociA9IHNwYW4oY2hhcilcbiAgICAgICAgICAgIC5zdHlsZSggcmFuZ2UgJiYgcGxlc3Moe3JvdywgY29sfSwgcmFuZ2VbMV0pICYmIHBsZXNzZXEocmFuZ2VbMF0sIHtyb3csIGNvbH0pID8ge2JhY2tncm91bmRDb2xvcjogXCIjOGQ5NmZmODVcIiwgY29sb3I6IGNvbG9yLmJhY2tncm91bmR9IDoge30pXG4gICAgICAgICAgICAuc3R5bGUoY3Vyc29yLnJvdyA9PT0gcm93ICYmIHNjb2wgPT09IGNvbCA/IHtib3hTaGFkb3c6IGAycHggMCAwIDAgJHtjb2xvci5jb2xvcn0gaW5zZXRgLH0gOiB7fSlcbiAgICAgICAgICAgIGNoYXJzLnB1c2goY2hyLmVsKVxuICAgICAgICAgICAgZWxlbWVudHMuc2V0KGNoci5lbCwge3Bvczoge3JvdywgY29sfX0pXG4gICAgICAgICAgICByZXR1cm4gY2hyXG4gICAgICAgICAgfVxuICAgICAgICApLFxuICAgICAgKS5zdHlsZSh7bWFyZ2luOiBcIjBcIn0pXG4gICAgICBlbGVtZW50cy5zZXQocGFyLmVsLCB7cG9zOntyb3csIGNvbDogbGluZS5sZW5ndGh9fSlcbiAgICAgIHJldHVybiBwYXJcbiAgICB9KSlcblxuICAgIG1rY29sb3IoKVxuXG4gICAgaWYgKGhpc3RbaGlzdC5sZW5ndGggLSAxXSAhPSBjb2RlKSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImxpbmVzXCIsIGNvZGUpXG4gICAgICBvbmlucHV0KGNvZGUpXG4gICAgICBoaXN0LnB1c2goY29kZSlcbiAgICAgIGFzdG1hcCA9IGdldEFzdE1hcCgpXG4gICAgICBta2NvbG9yKClcbiAgICB9XG5cbiAgfVxuXG5cblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZT0+e1xuICAgIGxldCBzZXRDdXJzb3IgPSAocG9zOlBvcyk9PntcbiAgICAgIGlmICghZS5zaGlmdEtleSkgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgZWxzZSBjdXJzb3Iuc2VsZWN0aW9uID0gY3Vyc29yLnNlbGVjdGlvbiB8fCB7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2x9XG4gICAgICBjdXJzb3IuY29sID0gcG9zLmNvbFxuICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICB9XG5cbiAgICBsZXQgY2xlYXJfcmFuZ2UgPSAoKSA9PiB7XG4gICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICBpZiAoIXJhbmdlKSByZXR1cm5cbiAgICAgIGxpbmVzID0gWy4uLmxpbmVzLnNsaWNlKDAsIHJhbmdlWzBdLnJvdyksIGxpbmVzW3JhbmdlWzBdLnJvd10uc3Vic3RyaW5nKDAsIHJhbmdlWzBdLmNvbCkgKyBsaW5lc1tyYW5nZVsxXS5yb3ddLnN1YnN0cmluZyhyYW5nZVsxXS5jb2wpLCAuLi5saW5lcy5zbGljZShyYW5nZVsxXS5yb3cgKyAxKV1cbiAgICAgIHNldEN1cnNvcih7cm93OiByYW5nZVswXS5yb3csIGNvbDogcmFuZ2VbMF0uY29sfSlcbiAgICB9XG5cbiAgICBpZiAoZS5rZXkubGVuZ3RoID09PSAxKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoZS5rZXkgPT0gXCJ6XCIpe1xuICAgICAgICAgIGlmIChoaXN0Lmxlbmd0aCA+IDEpe1xuICAgICAgICAgICAgaGlzdC5wb3AoKVxuICAgICAgICAgICAgbGV0IGxhc3QgPSBoaXN0W2hpc3QubGVuZ3RoIC0gMV1cbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxpbmVzID0gbGFzdC5zcGxpdChcIlxcblwiKVxuICAgICAgICAgICAgc2V0Q3Vyc29yKHtyb3c6MCwgY29sOjB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICByZW5kZXIoKVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcImNcIil7XG4gICAgICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgICAgICBsZXQgdGV4dCA9IGxpbmVzLnNsaWNlKHJhbmdlWzBdLnJvdywgcmFuZ2VbMV0ucm93ICsgMSkubWFwKChsaW5lLCBpKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChpID09IDAgJiYgaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZyhyYW5nZVswXS5jb2wsIHJhbmdlWzFdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSAwKSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sKVxuICAgICAgICAgICAgICBlbHNlIGlmIChpID09IHJhbmdlWzFdLnJvdyAtIHJhbmdlWzBdLnJvdykgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKDAsIHJhbmdlWzFdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSByZXR1cm4gbGluZVxuICAgICAgICAgICAgfSkuam9pbihcIlxcblwiKVxuICAgICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09IFwidlwiKXtcbiAgICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLnJlYWRUZXh0KCkudGhlbih0ZXh0ID0+IHtcbiAgICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICAgIGNsZWFyX3JhbmdlKClcbiAgICAgICAgICAgIGxldCBpbnNlcnRMaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIGxpbmVzID0gWy4uLmxpbmVzLnNsaWNlKDAsIGN1cnNvci5yb3cpLCBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCkgKyBpbnNlcnRMaW5lc1swXSwgLi4uaW5zZXJ0TGluZXMuc2xpY2UoMSwgLTEpLCBpbnNlcnRMaW5lcy5sZW5ndGggPiAxID8gaW5zZXJ0TGluZXNbaW5zZXJ0TGluZXMubGVuZ3RoIC0gMV0gKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCkgOiBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93ICsgaW5zZXJ0TGluZXMubGVuZ3RoIC0gMSwgY29sOiAoaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCA6IGN1cnNvci5jb2wgKyBpbnNlcnRMaW5lc1swXS5sZW5ndGgpfSlcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgbGluZXNbY3Vyc29yLnJvd10gPSBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCkgKyBlLmtleSArIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sKVxuICAgICAgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbCArIDF9KVxuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQmFja3NwYWNlXCIpe1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKHJhbmdlKXtcbiAgICAgICAgY2xlYXJfcmFuZ2UoKVxuXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChlLm1ldGFLZXkgJiYgY3Vyc29yLmNvbCA+IDApe1xuICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKCBjdXJzb3IuY29sKSwgLi4ubGluZXMuc2xpY2UoY3Vyc29yLnJvdyArIDEpXVxuICAgICAgICBjdXJzb3IuY29sID0gMFxuICAgICAgXG4gICAgICB9ZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApe1xuICAgICAgICBjdXJzb3IuY29sLS1cbiAgICAgICAgbGluZXNbY3Vyc29yLnJvd10gPSBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCArIDEpXG4gICAgICB9ZWxzZSBpZiAoY3Vyc29yLnJvdyA+IDApe1xuICAgICAgICBjdXJzb3Iucm93LS1cbiAgICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aFxuICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10gKyBsaW5lc1tjdXJzb3Iucm93ICsgMV0sIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAyKV1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dMZWZ0XCIpe1xuICAgICAgaWYgKGUubWV0YUtleSl7XG4gICAgICAgIGlmIChjdXJzb3IuY29sID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogMH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbCAtIDF9KVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93IC0gMSwgY29sOiBsaW5lc1tjdXJzb3Iucm93IC0gMV0ubGVuZ3RofSlcblxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dSaWdodFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA8IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RofSlcbiAgICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA8IGxpbmVzLmxlbmd0aCAtIDEpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93ICsgMSwgY29sOiAwfSlcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93VXBcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KSBzZXRDdXJzb3Ioe3JvdzogMCwgY29sOiBjdXJzb3IuY29sfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd0Rvd25cIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KSBzZXRDdXJzb3Ioe3JvdzogbGluZXMubGVuZ3RoIC0gMSwgY29sOiBjdXJzb3IuY29sfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKXtcbiAgICAgIGxpbmVzID0gW1xuICAgICAgICAuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSxcbiAgICAgICAgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpLFxuICAgICAgICAobGluZXNbY3Vyc29yLnJvd10ubWF0Y2goL15cXHMqLyk/LlswXSB8fCBcIlwiKSArIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sKSxcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoY3Vyc29yLnJvdyArIDEpXVxuICAgICAgY3Vyc29yLnJvdysrXG4gICAgICBjdXJzb3IuY29sID0gbGluZXNbY3Vyc29yLnJvd10ubWF0Y2goL15cXHMqLyk/LlswXS5sZW5ndGggfHwgMFxuICAgIH1cblxuXG4gICAgaWYgKGUua2V5LnN0YXJ0c1dpdGgoXCJBcnJvd1wiKSl7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICB9XG5cbiAgICByZW5kZXIoKVxuXG4gIH0pXG5cblxuICBsZXQgbW91c2Vkb3duPSBmYWxzZSAgXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgZT0+e1xuICAgIGlmIChlLm1ldGFLZXkpIHtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIGdvVG9EZWYoYXN0KVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIG1vdXNlZG93biA9IHRydWVcbiAgICBpZiAoZWxlbWVudHMuaGFzKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSl7XG4gICAgICBjdXJzb3IgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpIS5wb3NcbiAgICAgIHJlbmRlcigpXG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIGU9PntcbiAgICBpZiAobW91c2Vkb3duKSB7XG4gICAgICBpZiAoZWxlbWVudHMuaGFzKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSl7XG4gICAgICAgIGxldCBwb3MgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpIS5wb3NcbiAgICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgICBjdXJzb3Iucm93ID0gcG9zLnJvd1xuICAgICAgICBjdXJzb3IuY29sID0gcG9zLmNvbFxuICAgICAgICByZW5kZXIoKVxuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgbGV0IGFzdCA9IGVsZW1lbnRzLmdldChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCk/LmFzdFxuICAgICAgaWYgKGFzdCkge1xuICAgICAgICBsZXQgaW5mbyA9IGhvdmVySW5mbyhhc3QpXG4gICAgICAgIGlmIChpbmZvKSB7XG4gICAgICAgICAgbGV0IHRvb2x0aXAgPSBkaXYoaW5mbykuc3R5bGUoe1xuICAgICAgICAgICAgcG9zaXRpb246IFwiZml4ZWRcIixcbiAgICAgICAgICAgIGxlZnQ6IGUuY2xpZW50WCArIFwicHhcIixcbiAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogY29sb3IuYmFja2dyb3VuZCxcbiAgICAgICAgICAgIGNvbG9yOiBjb2xvci5jb2xvcixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgXCIgKyBjb2xvci5jb2xvcixcbiAgICAgICAgICAgIHBhZGRpbmc6IFwiOHB4IDEycHhcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgIHBvaW50ZXJFdmVudHM6IFwibm9uZVwiLFxuICAgICAgICAgICAgekluZGV4OiBcIjEwMDBcIixcbiAgICAgICAgICAgIHdoaXRlU3BhY2U6IFwicHJlXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvb2x0aXAuZWwpXG4gICAgICAgICAgbGV0IHJlbW92ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRvb2x0aXAuZWwucmVtb3ZlKClcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIG1vdmUpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsIG91dClcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IG1vdmUgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgIGlmIChlLm1ldGFLZXkpIHJldHVybiByZW1vdmUoKVxuICAgICAgICAgICAgdG9vbHRpcC5zdHlsZSh7XG4gICAgICAgICAgICAgIGxlZnQ6IGUuY2xpZW50WCArIFwicHhcIixcbiAgICAgICAgICAgICAgYm90dG9tOiAod2luZG93LmlubmVySGVpZ2h0IC0gZS5jbGllbnRZICsgMTApICsgXCJweFwiLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IG91dCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5yZWxhdGVkVGFyZ2V0ID09PSB0b29sdGlwLmVsKSByZXR1cm5cbiAgICAgICAgICAgIHJlbW92ZSgpXG4gICAgICAgICAgfVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIG1vdmUpXG4gICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIGU9PiB7XG4gICAgbW91c2Vkb3duID0gZmFsc2VcbiAgfSlcblxuXG4gIHJlbmRlcigpXG4gIHJldHVybiB7ZWwsXG4gICAgc2V0VGV4dDogKHRleHQ6c3RyaW5nKSA9PiB7XG4gICAgICBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIilcbiAgICAgIHJlbmRlcigpXG4gICAgfSxcbiAgICBzZXRDdXJzb3I6IChwb3M6IFBvcykgPT4ge1xuICAgICAgY29uc29sZS5sb2coXCJzZXR0aW5nIGN1cnNvciB0b1wiLCBwb3MpXG4gICAgICBjdXJzb3IgPSBwb3NcbiAgICAgIHJlbmRlcigpXG4gICAgfVxuICB9XG5cbiAgXG59XG4iLAogICAgImltcG9ydCB7dHlwZSBFbnZ9IGZyb20gXCIuL3J1bnRpbWVcIlxuZXhwb3J0IHR5cGUgUG9zID0ge29mZnNldDogbnVtYmVyLCBsaW5lOiBudW1iZXIsIGNvbDogbnVtYmVyfVxuZXhwb3J0IHR5cGUgU3BhbiA9IHtzdGFydDogUG9zLCBlbmQ6IFBvc31cblxuZXhwb3J0IHR5cGUgVGFnIDxUIGV4dGVuZHMgc3RyaW5nLCBDPiA9IHskOiBULCBjb250ZW50OiBDLCBzcGFuOiBTcGFuLCB0eXBlPzogQVNUfVxuXG5leHBvcnQgdHlwZSBWYXIgPSBUYWc8XCJ2YXJcIiwge25hbWU6IHN0cmluZ30+XG5leHBvcnQgdHlwZSBDb21tZW50ID0gVGFnPFwiY29tbWVudFwiLCBzdHJpbmc+XG5leHBvcnQgdHlwZSBGdW5jID0gVGFnPFwiZnVuY3Rpb25cIiwge3ZhcnM6IFZhcltdLCBib2R5OiBBU1QsIGVudj8gOkVudn0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFRhZzxcIm51bWJlclwiLCBudW1iZXI+XG4gIHwgVGFnPFwic3RyaW5nXCIsIHN0cmluZz5cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSwgYXN0bWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXX1cblxuY29uc3QgaGFzU2hvd25UeXBlID0gKHY6IFZhcikgPT4gdi50eXBlICYmICEodi50eXBlLiQgPT09IFwidmFyXCIgJiYgdi50eXBlLmNvbnRlbnQubmFtZSA9PT0gXCJhbnlcIilcbmNvbnN0IHByZXR0eUJpbmRlciA9ICh2OiBWYXIpOiBzdHJpbmcgPT4gaGFzU2hvd25UeXBlKHYpID8gYCgke3ByZXR0eUFTVCh2LnR5cGUhKX0gJHt2LmNvbnRlbnQubmFtZX0pYCA6IHYuY29udGVudC5uYW1lXG5cbmV4cG9ydCBjb25zdCBwcmV0dHlBU1QgPSAobm9kZTogQVNUKTogc3RyaW5nID0+e1xuICBzd2l0Y2gobm9kZS4kKXtcbiAgICBjYXNlIFwibnVtYmVyXCIgOiByZXR1cm4gbm9kZS5jb250ZW50LnRvU3RyaW5nKClcbiAgICBjYXNlIFwic3RyaW5nXCIgOiByZXR1cm4gSlNPTi5zdHJpbmdpZnkobm9kZS5jb250ZW50KVxuICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIG5vZGUuY29udGVudC5uYW1lXG4gICAgY2FzZSBcImxldFwiOiByZXR1cm4gYGxldCAke3ByZXR0eUJpbmRlcihub2RlLmNvbnRlbnQudmFyKX0gPSAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQudmFsdWUpfSBpblxcbiR7cHJldHR5QVNUKG5vZGUuY29udGVudC5ib2R5KX1gXG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBgZm4gJHtub2RlLmNvbnRlbnQudmFycy5tYXAocHJldHR5QmluZGVyKS5qb2luKFwiIFwiKX0gPT4gJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBgKCR7cHJldHR5QVNUKG5vZGUuY29udGVudC5mbil9ICR7bm9kZS5jb250ZW50LmFyZ3MubWFwKHByZXR0eUFTVCkuam9pbihcIiBcIil9KWBcbiAgICBjYXNlIFwicmVjb3JkXCI6IHJldHVybiBgeyR7bm9kZS5jb250ZW50Lm1hcCgoW2ssIHZdKSA9PiBgJHtrLmNvbnRlbnQubmFtZX06ICR7cHJldHR5QVNUKHYpfWApLmpvaW4oXCIsIFwiKX19YFxuICAgIGNhc2UgXCJlcnJvclwiOiByZXR1cm4gYFtFUlJPUjogJHtub2RlLmNvbnRlbnQubWVzc2FnZX1dYFxuICB9XG59XG5cblxuY29uc3QgemVyb1BvcyA9ICgpOiBQb3MgPT4gKHtvZmZzZXQ6IDAsIGxpbmU6IDEsIGNvbDogMX0pXG5jb25zdCB6ZXJvU3BhbiA9ICgpOiBTcGFuID0+ICh7c3RhcnQ6IHplcm9Qb3MoKSwgZW5kOiB6ZXJvUG9zKCl9KVxuXG5leHBvcnQgY29uc3QgbWtBc3QgPSA8VCBleHRlbmRzIHN0cmluZywgQz4odGFnOiBULCBjb250ZW50OiBDLCBzcGFuOiBTcGFuID0gemVyb1NwYW4oKSk6IFRhZzxULCBDPiA9PiAoeyQ6IHRhZywgY29udGVudCwgc3Bhbn0pXG5cbnR5cGUgVG9rZW5CYXNlID0ge3NwYW46IFNwYW59XG5cbnR5cGUgVG9rZW4gPVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJpZGVudFwiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBudW1iZXJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcInN5bWJvbFwiLCB2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJhcnJvd1wifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiY29tbWVudFwiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwia2V5d29yZFwiLCB2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfSlcblxudHlwZSBUb2tlbk5vU3BhbiA9IFRva2VuIGV4dGVuZHMgaW5mZXIgVCA/IFQgZXh0ZW5kcyB7c3BhbjogU3Bhbn0gPyBPbWl0PFQsIFwic3BhblwiPiA6IG5ldmVyIDogbmV2ZXJcblxuY29uc3QgdG9rZW5pemUgPSAoY29kZTogc3RyaW5nKToge3Rva2VuczogVG9rZW5bXSwgY29tbWVudHM6IENvbW1lbnRbXSwgZW9mOiBQb3N9ID0+IHtcbiAgbGV0IHRva2VuczogVG9rZW5bXSA9IFtdXG4gIGxldCBjb21tZW50czogQ29tbWVudFtdID0gW11cbiAgbGV0IGkgPSAwXG4gIGxldCBsaW5lID0gMVxuICBsZXQgY29sID0gMVxuXG4gIGxldCBpc0FscGhhID0gKGNoYXI6IHN0cmluZykgPT4gL1tBLVphLXpfXS8udGVzdChjaGFyKVxuICBsZXQgaXNEaWdpdCA9IChjaGFyOiBzdHJpbmcpID0+IC9bMC05XS8udGVzdChjaGFyKVxuICBsZXQgaXNJZGVudCA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16MC05X10vLnRlc3QoY2hhcilcbiAgbGV0IHBvcyA9ICgpOiBQb3MgPT4gKHtvZmZzZXQ6IGksIGxpbmUsIGNvbH0pXG4gIGxldCBhZHZhbmNlID0gKCkgPT4ge1xuICAgIGlmIChjb2RlW2ldID09PSBcIlxcblwiKSB7XG4gICAgICBpKytcbiAgICAgIGxpbmUrK1xuICAgICAgY29sID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICBpKytcbiAgICAgIGNvbCsrXG4gICAgfVxuICB9XG4gIGxldCBwdXNoID0gKHRva2VuOiBUb2tlbk5vU3Bhbiwgc3RhcnQ6IFBvcykgPT4ge1xuICAgIHRva2Vucy5wdXNoKHsuLi50b2tlbiwgc3Bhbjoge3N0YXJ0LCBlbmQ6IHBvcygpfX0gYXMgVG9rZW4pXG4gIH1cblxuICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgbGV0IGNoYXIgPSBjb2RlW2ldXG5cbiAgICBpZiAoL1xccy8udGVzdChjaGFyKSkge1xuICAgICAgYWR2YW5jZSgpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIi9cIiAmJiBjb2RlW2kgKyAxXSA9PT0gXCIvXCIpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBjb2RlW2ldICE9PSBcIlxcblwiKSBhZHZhbmNlKClcbiAgICAgIGNvbW1lbnRzLnB1c2gobWtBc3QoXCJjb21tZW50XCIsIGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKSwge3N0YXJ0LCBlbmQ6IHBvcygpfSkpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIj1cIiAmJiBjb2RlW2kgKyAxXSA9PT0gXCI+XCIpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJhcnJvd1wifSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChcIigpe309LDpcIi5pbmNsdWRlcyhjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZSA9IGNoYXIgYXMgXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCJcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGxldCB2YWx1ZSA9IFwiXCJcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBjb2RlW2ldXG4gICAgICAgIGlmIChjdXJyZW50ID09PSBcIlxcXFxcIikge1xuICAgICAgICAgIGxldCBuZXh0ID0gY29kZVtpICsgMV1cbiAgICAgICAgICBpZiAobmV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGVzY2FwZVwiLCBjb250ZW50OiBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSl9LCBzdGFydClcbiAgICAgICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGVzY2FwZWQgPSAoe246IFwiXFxuXCIsIHI6IFwiXFxyXCIsIHQ6IFwiXFx0XCIsICdcIic6ICdcIicsIFwiXFxcXFwiOiBcIlxcXFxcIn0gYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPilbbmV4dF1cbiAgICAgICAgICB2YWx1ZSArPSBlc2NhcGVkID8/IG5leHRcbiAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJyZW50ID09PSAnXCInKSBicmVha1xuICAgICAgICB2YWx1ZSArPSBjdXJyZW50XG4gICAgICAgIGFkdmFuY2UoKVxuICAgICAgfVxuICAgICAgaWYgKGNvZGVbaV0gIT09ICdcIicpIHtcbiAgICAgICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVudGVybWluYXRlZCBzdHJpbmcgbGl0ZXJhbFwiLCBjb250ZW50OiBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSl9LCBzdGFydClcbiAgICAgICAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxuICAgICAgfVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcInN0cmluZ1wiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoaXNEaWdpdChjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZVN0YXJ0ID0gaVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBpc0RpZ2l0KGNvZGVbaV0pKSBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBOdW1iZXIoY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKSl9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzQWxwaGEoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNJZGVudChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBjb2RlLnNsaWNlKHZhbHVlU3RhcnQsIGkpXG4gICAgICBpZiAodmFsdWUgPT09IFwibGV0XCIgfHwgdmFsdWUgPT09IFwiaW5cIiB8fCB2YWx1ZSA9PT0gXCJmblwiKSBwdXNoKHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGVsc2UgcHVzaCh7dHlwZTogXCJpZGVudFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgIGFkdmFuY2UoKVxuICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogYFVuZXhwZWN0ZWQgY2hhcmFjdGVyOiAke2NoYXJ9YCwgY29udGVudDogY2hhcn0sIHN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxufVxuXG5jbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGkgPSAwXG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSB0b2tlbnM6IFRva2VuW10sIHByaXZhdGUgc291cmNlOiBzdHJpbmcsIHByaXZhdGUgZW9mOiBQb3MpIHt9XG5cbiAgcGFyc2UoKTogQVNUIHtcbiAgICBsZXQgYXN0ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIGlmICh0aGlzLnBlZWsoKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5wZWVrKCkhLnNwYW4uc3RhcnRcbiAgICAgIGxldCBlbmQgPSB0aGlzLnRva2Vuc1t0aGlzLnRva2Vucy5sZW5ndGggLSAxXT8uc3Bhbi5lbmQgPz8gc3RhcnRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVuZXhwZWN0ZWQgZXh0cmEgaW5wdXQgYWZ0ZXIgZXhwcmVzc2lvblwiLCB7c3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgfVxuICAgIHJldHVybiBhc3RcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VFeHByKCk6IEFTVCB7XG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwibGV0XCIpKSByZXR1cm4gdGhpcy5wYXJzZUxldCgpXG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwiZm5cIikpIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb24oKVxuICAgIHJldHVybiB0aGlzLnBhcnNlQXRvbSgpXG4gIH1cblxuICBwcml2YXRlIHBhcnNlTGV0KCk6IEFTVCB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5leHBlY3RLZXl3b3JkKFwibGV0XCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyaWFibGUgPSB0aGlzLnBhcnNlTGV0QmluZGVyKClcbiAgICBpZiAodmFyaWFibGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gdmFyaWFibGVcblxuICAgIGxldCB2YWx1ZTogQVNUXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI9XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIj1cIilcbiAgICAgIHZhbHVlID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIilcbiAgICB9XG5cbiAgICBsZXQgYm9keTogQVNUXG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwiaW5cIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0S2V5d29yZChcImluXCIpXG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkIGtleXdvcmQgaW4gYWZ0ZXIgbGV0IGJpbmRpbmdcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGtleXdvcmQgaW4gYWZ0ZXIgbGV0IGJpbmRpbmdcIilcbiAgICB9XG5cbiAgICByZXR1cm4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdmFyaWFibGUsIHZhbHVlLCBib2R5fSwge3N0YXJ0LCBlbmQ6IGJvZHkuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUZ1bmN0aW9uKCk6IEFTVCB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5leHBlY3RLZXl3b3JkKFwiZm5cIikuc3Bhbi5zdGFydFxuICAgIGxldCB2YXJzOiBWYXJbXSA9IFtdXG4gICAgd2hpbGUgKHRoaXMucGVlaygpPy50eXBlID09PSBcImlkZW50XCIgfHwgdGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIGxldCBiaW5kZXIgPSB0aGlzLnBhcnNlQmluZGVyKClcbiAgICAgIGlmIChiaW5kZXIuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keTogYmluZGVyfSwge3N0YXJ0LCBlbmQ6IGJpbmRlci5zcGFuLmVuZH0pXG4gICAgICB2YXJzLnB1c2goYmluZGVyKVxuICAgIH1cbiAgICBsZXQgYm9keTogQVNUXG4gICAgaWYgKHZhcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBpZiAodGhpcy5tYXRjaFRva2VuKFwiYXJyb3dcIikpIGJvZHkgPSB0aGlzLndyYXBFcnJvcihcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgdGhpcy5wYXJzZUV4cHIoKSlcbiAgICAgIGVsc2UgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHN0YXJ0KVxuICAgIH0gZWxzZSBpZiAoIXRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSB7XG4gICAgICBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJz0+JyBhZnRlciBmdW5jdGlvbiBwYXJhbWV0ZXJzXCIpXG4gICAgfSBlbHNlIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfVxuICAgIHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzLCBib2R5fSwge3N0YXJ0LCBlbmQ6IGJvZHkuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0b20oKTogQVNUIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4pIHJldHVybiB0aGlzLmVycm9ySGVyZShcIlVuZXhwZWN0ZWQgZW5kIG9mIGlucHV0XCIpXG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJpZGVudFwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwidmFyXCIsIHtuYW1lOiB0b2tlbi52YWx1ZX0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcIm51bWJlclwiLCB0b2tlbi52YWx1ZSwgdG9rZW4uc3BhbilcbiAgICB9XG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInN0cmluZ1wiLCB0b2tlbi52YWx1ZSwgdG9rZW4uc3BhbilcbiAgICB9XG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiZXJyb3JcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiB0b2tlbi5tZXNzYWdlLCBjb250ZW50OiB0b2tlbi5jb250ZW50fSwgdG9rZW4uc3BhbilcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHJldHVybiB0aGlzLnBhcnNlUGFyZW5zKClcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIntcIikpIHJldHVybiB0aGlzLnBhcnNlUmVjb3JkKClcblxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBVbmV4cGVjdGVkIHRva2VuOiAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWAsIHRva2VuLnNwYW4pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUGFyZW5zKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIihcIilcbiAgICBsZXQgaXRlbXM6IEFTVFtdID0gW11cbiAgICB3aGlsZSAoIXRoaXMuaXNTeW1ib2woXCIpXCIpKSB7XG4gICAgICBpZiAoIXRoaXMucGVlaygpKSB7XG4gICAgICAgIGxldCBlbmQgPSBpdGVtcy5sZW5ndGggPiAwID8gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgaXRlbXMucHVzaCh0aGlzLnBhcnNlRXhwcigpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJFbXB0eSBwYXJlbnRoZXNlcyBhcmUgbm90IGFsbG93ZWRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBjbG9zZS5zcGFuLmVuZC5vZmZzZXQpKVxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDEpIHJldHVybiBpdGVtc1swXVxuICAgIHJldHVybiBta0FzdChcImFwcFwiLCB7Zm46IGl0ZW1zWzBdLCBhcmdzOiBpdGVtcy5zbGljZSgxKX0sIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VSZWNvcmQoKTogQVNUIHtcbiAgICBsZXQgb3BlbiA9IHRoaXMuZXhwZWN0U3ltYm9sKFwie1wiKVxuICAgIGxldCBmaWVsZHM6IFtWYXIsIEFTVF1bXSA9IFtdXG5cbiAgICB3aGlsZSAoIXRoaXMuaXNTeW1ib2woXCJ9XCIpKSB7XG4gICAgICBpZiAoIXRoaXMucGVlaygpKSB7XG4gICAgICAgIGxldCBlbmQgPSBmaWVsZHMubGVuZ3RoID4gMCA/IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV1bMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpIVxuICAgICAgICB0aGlzLmkrK1xuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoYEV4cGVjdGVkIHJlY29yZCBmaWVsZCBuYW1lLCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiB0b2tlbi5zcGFuLmVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIHRva2VuLnNwYW4uZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBsZXQga2V5ID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgICBsZXQgdmFsdWUgPSB0aGlzLmlzU3ltYm9sKFwiOlwiKVxuICAgICAgICA/ICh0aGlzLmV4cGVjdFN5bWJvbChcIjpcIiksIHRoaXMuaXNTeW1ib2woXCJ9XCIpID8gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCByZWNvcmQgZmllbGQgdmFsdWUgYWZ0ZXIgJzonXCIpIDogdGhpcy5wYXJzZUV4cHIoKSlcbiAgICAgICAgOiBrZXlcbiAgICAgIGZpZWxkcy5wdXNoKFtrZXksIHZhbHVlXSlcbiAgICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiLFwiKSkgdGhpcy5pKytcbiAgICAgIGVsc2UgYnJlYWtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNTeW1ib2woXCJ9XCIpKSB7XG4gICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHJlY29yZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgfVxuICAgIGxldCBjbG9zZSA9IHRoaXMuZXhwZWN0U3ltYm9sKFwifVwiKVxuICAgIHJldHVybiBta0FzdChcInJlY29yZFwiLCBmaWVsZHMsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiKFwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgICBsZXQgZGVjbGFyZWRUeXBlID0gdGhpcy5wYXJzZUF0b20oKVxuICAgICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyIGluIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICBpZiAoIXRoaXMuaXNTeW1ib2woXCIpXCIpKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnKScgYWZ0ZXIgYmluZGVyIHBhdHRlcm5cIilcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKVwiKVxuICAgICAgaWYgKGRlY2xhcmVkVHlwZS4kID09PSBcImVycm9yXCIpIHJldHVybiBkZWNsYXJlZFR5cGVcbiAgICAgIGxldCB2YXJpYWJsZSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgICAgcmV0dXJuIHZhcmlhYmxlXG4gICAgfVxuICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICBpZiAoIW5hbWUpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGlkZW50aWZpZXJcIilcbiAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIjpcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiOlwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICB2YXJpYWJsZS50eXBlID0gZGVjbGFyZWRUeXBlXG4gICAgfVxuICAgIHJldHVybiB2YXJpYWJsZVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRlcigpOiBWYXIgfCBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PiB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VCaW5kZXIoKVxuICB9XG5cbiAgcHJpdmF0ZSBwZWVrKCk6IFRva2VuIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbnNbdGhpcy5pXVxuICB9XG5cbiAgcHJpdmF0ZSBpc0tleXdvcmQodmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJrZXl3b3JkXCIgJiYgdG9rZW4udmFsdWUgPT09IHZhbHVlXG4gIH1cblxuICBwcml2YXRlIGlzU3ltYm9sKHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIik6IGJvb2xlYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgcmV0dXJuIHRva2VuPy50eXBlID09PSBcInN5bWJvbFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RUb2tlbjxLIGV4dGVuZHMgVG9rZW5bXCJ0eXBlXCJdPih0eXBlOiBLKTogRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuIHx8IHRva2VuLnR5cGUgIT09IHR5cGUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHt0eXBlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlbiBhcyBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+XG4gIH1cblxuICBwcml2YXRlIG1hdGNoVG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4gfCB1bmRlZmluZWQge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwia2V5d29yZFwiIHx8IHRva2VuLnZhbHVlICE9PSB2YWx1ZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBrZXl3b3JkICR7dmFsdWV9LCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuXG4gIH1cblxuICBwcml2YXRlIGV4cGVjdFN5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbj8udHlwZSAhPT0gXCJzeW1ib2xcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7dmFsdWV9JywgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBkZXNjcmliZSh0b2tlbjogVG9rZW4gfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICAgIGlmICghdG9rZW4pIHJldHVybiBcImVuZCBvZiBpbnB1dFwiXG4gICAgaWYgKFwidmFsdWVcIiBpbiB0b2tlbikgcmV0dXJuIGAke3Rva2VuLnR5cGV9KCR7U3RyaW5nKHRva2VuLnZhbHVlKX0pYFxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHJldHVybiBgZXJyb3IoJHt0b2tlbi5tZXNzYWdlfSlgXG4gICAgcmV0dXJuIHRva2VuLnR5cGVcbiAgfVxuXG4gIHByaXZhdGUgZXJyb3JOb2RlKG1lc3NhZ2U6IHN0cmluZywgc3Bhbj86IFNwYW4sIGNvbnRlbnQ/OiBzdHJpbmcpOiBFcnJvck5vZGUge1xuICAgIGxldCBmaW5hbFNwYW4gPSBzcGFuID8/IHRoaXMucG9pbnRTcGFuKClcbiAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZSwgY29udGVudDogY29udGVudCA/PyB0aGlzLnNvdXJjZS5zbGljZShmaW5hbFNwYW4uc3RhcnQub2Zmc2V0LCBmaW5hbFNwYW4uZW5kLm9mZnNldCl9LCBmaW5hbFNwYW4pXG4gIH1cblxuICBwcml2YXRlIGVycm9ySGVyZShtZXNzYWdlOiBzdHJpbmcsIHN0YXJ0PzogUG9zKTpFcnJvck5vZGUge1xuICAgIGxldCBzcGFuID0gdGhpcy5wZWVrKCk/LnNwYW4gPz8ge3N0YXJ0OiB0aGlzLmVvZiwgZW5kOiB0aGlzLmVvZn1cbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUobWVzc2FnZSwge3N0YXJ0OiBzdGFydCA/PyBzcGFuLnN0YXJ0LCBlbmQ6IHNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgd3JhcEVycm9yKG1lc3NhZ2U6IHN0cmluZywgbm9kZTogQVNUKTogQVNUIHtcbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUobWVzc2FnZSwgbm9kZS5zcGFuLCB0aGlzLnNvdXJjZS5zbGljZShub2RlLnNwYW4uc3RhcnQub2Zmc2V0LCBub2RlLnNwYW4uZW5kLm9mZnNldCkpXG4gIH1cblxuICBwcml2YXRlIHBvaW50U3BhbigpOiBTcGFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbikgcmV0dXJuIHRva2VuLnNwYW5cbiAgICByZXR1cm4ge3N0YXJ0OiB0aGlzLmVvZiwgZW5kOiB0aGlzLmVvZn1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgYnVpbGRBc3RNYXAgPSAoYXN0OiBBU1QsIGNvbW1lbnRzOiBDb21tZW50W10gPSBbXSk6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0+IHtcbiAgbGV0IG1heEVuZCA9IGNvbW1lbnRzLnJlZHVjZSgobSwgYykgPT4gYy5zcGFuLmVuZC5vZmZzZXQgPiBtID8gYy5zcGFuLmVuZC5vZmZzZXQgOiBtLCBhc3Quc3Bhbi5lbmQub2Zmc2V0KVxuICBsZXQgcmVzOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IEFycmF5LmZyb20oe2xlbmd0aDogbWF4RW5kfSwgKCk9PnVuZGVmaW5lZClcbiAgY29uc3Qgd2FsayA9IChub2RlOiBBU1QpID0+IHtcbiAgICBmb3IgKGxldCBpID0gbm9kZS5zcGFuLnN0YXJ0Lm9mZnNldDsgaSA8IG5vZGUuc3Bhbi5lbmQub2Zmc2V0OyBpKyspIHJlc1tpXSA9IG5vZGVcbiAgICBjaGlsZHJlbihub2RlKS5mb3JFYWNoKHdhbGspXG4gIH1cbiAgd2Fsayhhc3QpXG4gIGNvbW1lbnRzLmZvckVhY2goY29tbWVudCA9PiB7XG4gICAgZm9yIChsZXQgaSA9IGNvbW1lbnQuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBjb21tZW50LnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBjb21tZW50XG4gIH0pXG4gIHJldHVybiByZXNcbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGNvZGU6c3RyaW5nKTogUGFyc2VSZXN1bHQgPT4ge1xuICBsZXQge3Rva2VucywgY29tbWVudHMsIGVvZn0gPSB0b2tlbml6ZShjb2RlKVxuICBsZXQgYXN0ID0gbmV3IFBhcnNlcih0b2tlbnMsIGNvZGUsIGVvZikucGFyc2UoKVxuICByZXR1cm4ge2FzdCwgY29tbWVudHMsIGFzdG1hcDogYnVpbGRBc3RNYXAoYXN0LCBjb21tZW50cyl9XG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZUFTVCA9IChjb2RlOnN0cmluZyk6IEFTVCA9PiBwYXJzZShjb2RlKS5hc3RcblxuZXhwb3J0IGNvbnN0IGNoaWxkcmVuID0gKG5vZGU6IEFTVCk6IEFTVFtdID0+IHtcbiAgaWYgKG5vZGUuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gWy4uLm5vZGUuY29udGVudC52YXJzLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJhcHBcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQuZm4sIC4uLm5vZGUuY29udGVudC5hcmdzXVxuICBpZiAobm9kZS4kID09PSBcImxldFwiKSByZXR1cm4gW25vZGUuY29udGVudC52YXIsIG5vZGUuY29udGVudC52YWx1ZSwgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwicmVjb3JkXCIpIHJldHVybiBub2RlLmNvbnRlbnQuZmxhdE1hcCgoW2tleSwgdmFsdWVdKSA9PiBba2V5LCB2YWx1ZV0pXG4gIHJldHVybiBbXVxufVxuXG5jb25zdCBzdHJpcFNwYW5zID0gKGFzdDogQVNUKTogdW5rbm93biA9PiB7XG4gIGlmIChhc3QuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyczogYXN0LmNvbnRlbnQudmFycy5tYXAoc3RyaXBTcGFucyksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwiYXBwXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHtmbjogc3RyaXBTcGFucyhhc3QuY29udGVudC5mbiksIGFyZ3M6IGFzdC5jb250ZW50LmFyZ3MubWFwKHN0cmlwU3BhbnMpfX1cbiAgaWYgKGFzdC4kID09PSBcImxldFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhciksIHZhbHVlOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhbHVlKSwgYm9keTogc3RyaXBTcGFucyhhc3QuY29udGVudC5ib2R5KX19XG4gIGlmIChhc3QuJCA9PT0gXCJyZWNvcmRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnQubWFwKChbbmFtZSwgdmFsdWVdKSA9PiBbc3RyaXBTcGFucyhuYW1lKSwgc3RyaXBTcGFucyh2YWx1ZSldKX1cbiAgaWYgKGFzdC4kID09PSBcImVycm9yXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50fVxuICByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbn1cblxuXG5sZXQgc3RyaW5naWZ5ID0gKHg6IHVua25vd24pID0+IEpTT04uc3RyaW5naWZ5KHgsIG51bGwsIDIpXG5cbmNvbnN0IHRlc3RfcGFyc2UgPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogQVNUKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuXG4gIGlmIChKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpICE9PSBKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGV4cGVjdGVkKSkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIHN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpKVxuICAgIHRocm93IG5ldyBFcnJvcihgVGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmNvbnN0IHRlc3Rfc3BhbiA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBTcGFuKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuICBpZiAoSlNPTi5zdHJpbmdpZnkoYXN0LnNwYW4pICE9PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZCkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTpcIiwgY29kZSlcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIGV4cGVjdGVkKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIGFzdC5zcGFuKVxuICAgIHRocm93IG5ldyBFcnJvcihgU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTogJHtjb2RlfWApXG4gIH1cbn1cblxuZXhwb3J0IGxldCBta251bSA9IChuOiBudW1iZXIpID0+IG1rQXN0KFwibnVtYmVyXCIsIG4pXG5leHBvcnQgbGV0IG1rc3RyID0gKHM6IHN0cmluZykgPT4gbWtBc3QoXCJzdHJpbmdcIiwgcylcbmV4cG9ydCBsZXQgbWt2YXIgPSAobmFtZTogc3RyaW5nKSA9PiBta0FzdChcInZhclwiLCB7bmFtZX0pXG5leHBvcnQgbGV0IG1rYXBwID0gKGZuOiBBU1QsIGFyZ3M6IEFTVFtdKSA9PiBta0FzdChcImFwcFwiLCB7Zm4sIGFyZ3N9KVxuZXhwb3J0IGxldCBta2xldCA9ICh2OiBzdHJpbmcgfCBWYXIsIHZhbHVlOiBBU1QsIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYsIHZhbHVlLCBib2R5fSlcbmV4cG9ydCBsZXQgbWtmdW4gPSAodmFyczogKHN0cmluZyB8IFZhcilbXSwgYm9keTogQVNUKSA9PiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzOiB2YXJzLm1hcCh2ID0+IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2KSwgYm9keX0pIGFzIEZ1bmNcbmV4cG9ydCBsZXQgYW5ub3QgPSAodHlwZTogQVNULCB2YWx1ZTogQVNUKSA9PiBta0FzdChcImFubm90XCIsIHt0eXBlLCB2YWx1ZX0pXG5leHBvcnQgbGV0IG1rcmVjb3JkID0gKGZpZWxkczoge1trZXkgOiBzdHJpbmddIDogQVNUfSkgPT4gbWtBc3QoXCJyZWNvcmRcIiwgT2JqZWN0LmVudHJpZXMoZmllbGRzKS5tYXAoKFtrLHZdKT0+IFtta3ZhcihrKSwgdl0pKVxuXG5PYmplY3QuZW50cmllcyh7XG4gIFwieFwiOiBta3ZhcihcInhcIiksXG4gIFwiMjJcIjogbWtudW0oMjIpLFxuICAnXCJoZWxsb1wiJzogbWtzdHIoXCJoZWxsb1wiKSxcbiAgXCIoZiB4KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIildKSxcbiAgXCIoZiB4IHkpXCI6IG1rYXBwKG1rdmFyKFwiZlwiKSwgW21rdmFyKFwieFwiKSwgbWt2YXIoXCJ5XCIpXSksXG4gIFwibGV0IHggPSAyMiBpbiB4XCI6IG1rbGV0KFwieFwiLCBta251bSgyMiksIG1rdmFyKFwieFwiKSksXG4gIFwie2E6IDIyLCBiOiB4fVwiOiBta3JlY29yZCh7YTogbWtudW0oMjIpLCBiOiBta3ZhcihcInhcIil9KSxcbiAgXCJmbiB4ID0+IHhcIjogbWtmdW4oW1wieFwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiB4IHkgPT4geFwiOiBta2Z1bihbXCJ4XCIsIFwieVwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJsZXQgKG51bWJlciB4KSA9IDIyIGluIHhcIjogbWtsZXQoT2JqZWN0LmFzc2lnbihta3ZhcihcInhcIiksIHt0eXBlOiBta3ZhcihcIm51bWJlclwiKX0pLCBta251bSgyMiksIG1rdmFyKFwieFwiKSksXG4gIFwiZm4gKG51bWJlciB4KSAoc3RyaW5nIHkpID0+IHhcIjogbWtmdW4oW1xuICAgIE9iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KSxcbiAgICBPYmplY3QuYXNzaWduKG1rdmFyKFwieVwiKSwge3R5cGU6IG1rdmFyKFwic3RyaW5nXCIpfSksXG4gIF0sIG1rdmFyKFwieFwiKSksXG4gIFwie2U6MjJ9XCIgOiBta3JlY29yZCh7ZTogbWtudW0oMjIpfSksXG4gIFwie2V9XCI6IG1rcmVjb3JkKHtlOiBta3ZhcihcImVcIil9KSxcbiAgXCIvL2NvbW1lbnRcXG4yMlwiOiBwYXJzZUFTVChcIjIyXCIpLFxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG5PYmplY3QuZW50cmllcyh7XG4gIFwiKFwiOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIlVudGVybWluYXRlZCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIiwgY29udGVudDogXCIoXCJ9KSxcbiAgXCJsZXQgeCAyMiBpbiB4XCI6IG1rQXN0KFwibGV0XCIsIHtcbiAgICB2YXI6IG1rdmFyKFwieFwiKSxcbiAgICB2YWx1ZTogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiLCBjb250ZW50OiBcIjIyXCJ9KSxcbiAgICBib2R5OiBta3ZhcihcInhcIiksXG4gIH0pLFxuICBcIntlOn1cIjogbWtyZWNvcmQoe2U6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiLCBjb250ZW50OiBcIn1cIn0pfSksXG5cbn0pLmZvckVhY2goKFtjb2RlLCBleHBlY3RlZF0pID0+IHRlc3RfcGFyc2UoY29kZSwgZXhwZWN0ZWQgYXMgQVNUKSlcblxudGVzdF9zcGFuKFwibGV0IHggPSAyMlxcbmluIHhcIiwge1xuICBzdGFydDoge29mZnNldDogMCwgbGluZTogMSwgY29sOiAxfSxcbiAgZW5kOiB7b2Zmc2V0OiAxNSwgbGluZTogMiwgY29sOiA1fSxcbn0pXG4iLAogICAgImltcG9ydCB7IEFTVCwgVmFyIH0gZnJvbSBcIi4vcGFyc2VyXCJcbmltcG9ydCB7Y2hpbGRyZW59IGZyb20gXCIuL3BhcnNlclwiXG5cblxuZXhwb3J0IGNvbnN0IGdldGRlZiA9IChyb290OiBBU1QsIHZhcmk6IFZhcik6IEFTVCB8IHVuZGVmaW5lZCA9PiB7XG4gIGlmIChyb290LnNwYW4uc3RhcnQub2Zmc2V0ID4gdmFyaS5zcGFuLnN0YXJ0Lm9mZnNldCB8fCByb290LnNwYW4uZW5kLm9mZnNldCA8IHZhcmkuc3Bhbi5lbmQub2Zmc2V0KSByZXR1cm4gdW5kZWZpbmVkXG4gIGZvciAobGV0IGNoaWxkIG9mIGNoaWxkcmVuKHJvb3QpKXtcbiAgICBsZXQgcmVzID0gZ2V0ZGVmKGNoaWxkLCB2YXJpKVxuICAgIGlmIChyZXMpIHJldHVybiByZXNcbiAgfVxuXG4gIGlmIChyb290LiQgPT09IFwibGV0XCIgJiYgcm9vdC5jb250ZW50LnZhci5jb250ZW50Lm5hbWUgPT09IHZhcmkuY29udGVudC5uYW1lKVxuICAgIHJldHVybiByb290LmNvbnRlbnQudmFyXG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJmdW5jdGlvblwiKVxuICAgIGZvciAobGV0IHYgb2Ygcm9vdC5jb250ZW50LnZhcnMpXG4gICAgICBpZiAodi5jb250ZW50Lm5hbWUgPT09IHZhcmkuY29udGVudC5uYW1lKVxuICAgICAgICByZXR1cm4gdlxufVxuIiwKICAgICJcbmltcG9ydCB7IGJvZHksIGNvbG9yLCBkaXYsIHRhYmxlLCB0ZCwgdHIgfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7bWtudW0sIFRhZywgdHlwZSBBU1R9IGZyb20gXCIuL3BhcnNlclwiXG5pbXBvcnQge3BhcnNlLCBwcmV0dHlBU1QsIG1rQXN0LCBta3ZhciwgbWthcHAsIG1rZnVuLCBta2xldCwgVmFyfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5sZXQgYW5ub3QgPSAoYXN0OiBBU1QsIHR5cGU6IEFTVCk6IEFTVCAmIHt0eXBlOiBBU1R9ID0+IHtcbiAgaWYgKGFzdC50eXBlICYmIHByZXR0eUFTVChhc3QudHlwZSkgIT0gcHJldHR5QVNUKHR5cGUpKSB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkICR7cHJldHR5QVNUKHR5cGUpfSwgZ290ICR7cHJldHR5QVNUKGFzdC50eXBlKX1gKVxuICBhc3QudHlwZSA9IHR5cGVcbiAgcmV0dXJuIGFzdCBhcyBBU1QgJiB7dHlwZTogQVNUfVxuXG59XG5cbmV4cG9ydCBsZXQgTlVNQkVSIDogQVNUID0gbWt2YXIoXCJudW1iZXJcIilcbmV4cG9ydCBsZXQgU1RSSU5HIDogQVNUID0gbWt2YXIoXCJzdHJpbmdcIilcbmV4cG9ydCBsZXQgVFlQRSA6IEFTVCA9IG1rdmFyKFwidHlwZVwiKVxuZXhwb3J0IGxldCBUWVBFT0Y6IEFTVCA9IG1rdmFyKFwidHlwZW9mXCIpXG5cbk5VTUJFUi50eXBlID0gVFlQRVxuU1RSSU5HLnR5cGUgPSBUWVBFXG5UWVBFLnR5cGUgPSBUWVBFXG5UWVBFT0YudHlwZSA9IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0IVxuXG5cbmV4cG9ydCBsZXQgQU5ZIDogQVNUID0gbWt2YXIoXCJhbnlcIilcblxuXG5sZXQgcHJpbWl0aXZlVHlwZSA9IChuYW1lOiBzdHJpbmcpID0+ICh7XG4gIHR5cGU6IFRZUEUsXG4gIGltcGw6ICh4OiBBU1QpID0+IHtcbiAgICBpZiAoeC4kID09IFwidmFyXCIpe1xuICAgICAgaWYgKHgudHlwZSl7XG4gICAgICAgIGlmICh4LnR5cGUuJCA9PSBcInZhclwiICYmIHgudHlwZS5jb250ZW50Lm5hbWUgPT0gbmFtZSkgcmV0dXJuIHhcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yOiBleHBlY3RlZCAke25hbWV9LCBnb3QgJHtwcmV0dHlBU1QoeC50eXBlKX1gKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGFubm90KHgsIG1rdmFyKG5hbWUpKVxuICAgIH1cbiAgICBlbHNlIGlmICh4LiQgPT0gbmFtZSkgcmV0dXJuIGFubm90KHgsIG1rdmFyKG5hbWUpKVxuICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtuYW1lfSwgZ290ICR7cHJldHR5QVNUKHgpfWApXG4gIH1cbn0pXG5cbmxldCBidWlsdGluczogUmVjb3JkPHN0cmluZywgeyB0eXBlOiBBU1QsIGltcGw6ICguLi5hcmdzOkFTVFtdKSA9PiBBU1QgfT4gPSB7XG4gIG51bWJlcjogcHJpbWl0aXZlVHlwZShcIm51bWJlclwiKSxcbiAgc3RyaW5nOiBwcmltaXRpdmVUeXBlKFwic3RyaW5nXCIpLFxuICBcImVxXCI6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCB5ID0+IChudW1iZXIgKGYgeCB5KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiBta251bShcbiAgICAgICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fFxuICAgICAgKHguJCA9PSBcInN0cmluZ1wiICYmIHkuJCA9PSBcInN0cmluZ1wiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8ICh4ID09IHkpXG4gICAgICA/IDEgOiAwKVxuICB9LFxuICBcImFkZFwiOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmPT4gZm4geCB5ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSAobnVtYmVyIHkpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiB7XG4gICAgICBpZiAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIpIHJldHVybiBta251bSh4LmNvbnRlbnQgKyB5LmNvbnRlbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gYWRkOiBleHBlY3RlZCBudW1iZXJzLCBnb3QgJHtwcmV0dHlBU1QoeCl9IGFuZCAke3ByZXR0eUFTVCh5KX1gKVxuICAgIH1cbiAgfSxcbiAgXCJpZmVsc2VcIiA6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4gVCBjb25kIHRoZW4gZWxzZSA9PiAoVCAoZiAobnVtYmVyIGNvbmQpIChUIHRoZW4pIChUIGVsc2UpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoY29uZCwgdGhlbiwgZWxzKSA9PiB7XG4gICAgICBsZXQgdmFsID0gY29uZC4kID09IFwibnVtYmVyXCIgPyBjb25kLmNvbnRlbnQgOiBjb25kLiQgPT0gXCJzdHJpbmdcIiA/IGNvbmQuY29udGVudC5sZW5ndGggOiAxXG4gICAgICByZXR1cm4gdmFsID8gdGhlbiA6IGVsc1xuICAgIH1cbiAgfSxcbiAgXCJ0eXBlb2ZcIjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+ICh0eXBlIChmIHgpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4KSA9PiB7XG4gICAgICBpZiAoIXgudHlwZSkgcmV0dXJuIG1rYXBwKFRZUEVPRiwgW3hdKVxuICAgICAgcmV0dXJuIHgudHlwZVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IHR5cGUgRW52ID0ge2JpbmRlcjogVmFyLCB2YWx1ZTogQVNULCBuZXh0OiBFbnZ9IHwgbnVsbFxuXG5sZXQgcHJldHR5RW52ID0gKGVudjogRW52KTogc3RyaW5nID0+IHtcbiAgaWYgKCFlbnYpIHJldHVybiBcInt9XCJcbiAgcmV0dXJuIGB7JHtlbnYuYmluZGVyLmNvbnRlbnQubmFtZX0gOiAke3ByZXR0eUFTVChlbnYudmFsdWUudHlwZSA/PyBBTlkpfSA9ICR7cHJldHR5QVNUKGVudi52YWx1ZSl9fSAtPiBgICsgcHJldHR5RW52KGVudi5uZXh0KVxufVxuXG5leHBvcnQgY29uc3QgcnVuID0gKGFzdDogQVNUKTogQVNUID0+IHtcblxuICBsZXQgbG9va3VwID0gKG5hbWU6IHN0cmluZywgZW52OiBFbnYpOiBFbnYgPT4ge1xuICAgIGlmICghZW52KSByZXR1cm4gbnVsbFxuICAgIGlmIChlbnYuYmluZGVyLmNvbnRlbnQubmFtZSA9PT0gbmFtZSkgcmV0dXJuIGVudlxuICAgIHJldHVybiBsb29rdXAobmFtZSwgZW52Lm5leHQpXG4gIH1cblxuICBsZXQgZnJlZW5hbWUgPSAoZW52OkVudik6c3RyaW5nPT57XG4gICAgbGV0IG4gPSAwXG4gICAgd2hpbGUobG9va3VwKGB4JHtufWAsIGVudikpIG4rK1xuICAgIHJldHVybiBgeCR7bn1gXG4gIH1cbiAgbGV0IGJpbmQgPSAoZW52OiBFbnYsIGJpbmRlcjogVmFyLCB2YWx1ZTogQVNUKTogRW52ID0+ICh7YmluZGVyLCB2YWx1ZSwgbmV4dDogZW52fSlcbiAgbGV0IGJpbmRWYWx1ZSA9IChlbnY6IEVudiwgYmluZGVyOiBWYXIsIHZhbHVlOiBBU1QsIGluZmVyID0gZmFsc2UpOiBFbnYgPT4ge1xuXG4gICAgaWYgKGJpbmRlci50eXBlKVxuICAgICAgaWYgKHZhbHVlLnR5cGUgJiYgcHJldHR5QVNUKGJpbmRlci50eXBlKSAhPSBwcmV0dHlBU1QodmFsdWUudHlwZSEpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gbGV0OiBleHBlY3RlZCAke3ByZXR0eUFTVChiaW5kZXIudHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QodmFsdWUudHlwZSEpfWApXG4gICAgZWxzZSBiaW5kZXIudHlwZSA9IHZhbHVlLnR5cGVcbiAgICByZXR1cm4gYmluZChlbnYsIGJpbmRlciwgdmFsdWUpXG5cbiAgfVxuXG4gIGNvbnN0IGdvID0gKGFzdDogQVNULCBlbnY6IEVudik6IEFTVCA9PiB7XG4gICAgc3dpdGNoKGFzdC4kKXtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjoge1xuICAgICAgICBhc3QudHlwZSA9IE5VTUJFUlxuICAgICAgICByZXR1cm4gYXN0IGFzIEFTVCAmIHt0eXBlOiBBU1R9XG4gICAgICB9XG4gICAgICBjYXNlIFwic3RyaW5nXCI6e1xuICAgICAgICBhc3QudHlwZSA9IFNUUklOR1xuICAgICAgICByZXR1cm4gYXN0IGFzIEFTVCAmIHt0eXBlOiBBU1R9XG4gICAgICB9XG5cbiAgICAgIGNhc2UgXCJ2YXJcIjoge1xuICAgICAgICBpZiAoYnVpbHRpbnNbYXN0LmNvbnRlbnQubmFtZV0pIHtcbiAgICAgICAgICBsZXQgZGVmID0gYnVpbHRpbnNbYXN0LmNvbnRlbnQubmFtZV1cbiAgICAgICAgICByZXR1cm4gYW5ub3QoYXN0LCBkZWYudHlwZSlcbiAgICAgICAgfVxuICAgICAgICBsZXQgaGl0ID0gbG9va3VwKGFzdC5jb250ZW50Lm5hbWUsIGVudilcbiAgICAgICAgaWYgKGhpdCkge1xuICAgICAgICAgIGlmIChoaXQuYmluZGVyLnR5cGUpIGFubm90KGFzdCwgaGl0LmJpbmRlci50eXBlKVxuICAgICAgICAgIHJldHVybiBoaXQudmFsdWVcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXN0XG4gICAgICB9XG4gICAgICBjYXNlIFwibGV0XCI6IHtcblxuICAgICAgICBsZXQgdmFsdWUgPSBnbyhhc3QuY29udGVudC52YWx1ZSwgZW52KVxuXG4gICAgICAgIGlmIChhc3QuY29udGVudC52YXIudHlwZSA9PSB1bmRlZmluZWQpIGFubm90KGFzdC5jb250ZW50LnZhciwgdmFsdWUudHlwZSEpXG4gICAgICAgIGVudiA9IGJpbmRWYWx1ZShlbnYsIGFzdC5jb250ZW50LnZhciwgdmFsdWUsIHRydWUpXG4gICAgICAgIGxldCByZXMgPSBnbyhhc3QuY29udGVudC5ib2R5LCBlbnYpXG4gICAgICAgIGlmIChyZXMudHlwZSkgYW5ub3QoYXN0LCByZXMudHlwZSlcbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6e1xuICAgICAgICBpZiAoYXN0LmNvbnRlbnQuZW52ID09IHVuZGVmaW5lZCkgYXN0LmNvbnRlbnQuZW52ID0gZW52XG5cbiAgICAgICAgbGV0IGJvZHkgPSBnbyhcbiAgICAgICAgICBhc3QuY29udGVudC5ib2R5LFxuICAgICAgICAgIGFzdC5jb250ZW50LnZhcnMucmVkdWNlKChlbnYsIHYpID0+IGJpbmQoZW52LCB2LCB2KSwgYXN0LmNvbnRlbnQuZW52IGFzIEVudilcbiAgICAgICAgKVxuXG4gICAgICAgIGxldCBmdmFyID0gbWt2YXIoZnJlZW5hbWUoZW52KSlcbiAgICAgICAgbGV0IGZ0eXBlOiBBU1QgPSBta2Z1biggW2Z2YXJdLCBta2Z1bihhc3QuY29udGVudC52YXJzLCBhc3QuY29udGVudC5ib2R5LnR5cGUgPz8gbWthcHAoVFlQRU9GLCBbYm9keV0pKSlcbiAgICAgICAgYW5ub3QoYXN0LCBmdHlwZSlcbiAgICAgICAgbGV0IHJlcyA9IG1rZnVuKGFzdC5jb250ZW50LnZhcnMsIGJvZHkpXG4gICAgICAgIHJlcy5jb250ZW50LmVudiA9IGFzdC5jb250ZW50LmVudlxuICAgICAgICByZXR1cm4gYW5ub3QocmVzLCBmdHlwZSlcbiAgICAgIH1cblxuICAgICAgY2FzZSBcImFwcFwiOiB7XG4gICAgICAgIGxldCBmbiA9IGdvKGFzdC5jb250ZW50LmZuLCBlbnYpXG4gICAgICAgIGxldCBhcmdzID0gYXN0LmNvbnRlbnQuYXJncy5tYXAoYXJnID0+IGdvKGFyZywgZW52KSlcblxuICAgICAgICBpZiAoZm4uJCA9PSBcInZhclwiICYmIGJ1aWx0aW5zW2ZuLmNvbnRlbnQubmFtZV0pIHtcbiAgICAgICAgICBsZXQgcmVzID0gYnVpbHRpbnNbZm4uY29udGVudC5uYW1lXS5pbXBsKC4uLmFyZ3MpXG4gICAgICAgICAgaWYgKHJlcy50eXBlKSBhbm5vdChhc3QsIHJlcy50eXBlKVxuICAgICAgICAgIHJldHVybiByZXNcbiAgICAgICAgfVxuICAgICAgICBpZiAoZm4uJCA9PSBcImZ1bmN0aW9uXCIpe1xuXG4gICAgICAgICAgaWYgKGZuLmNvbnRlbnQudmFycy5sZW5ndGggIT09IGFyZ3MubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7Zm4uY29udGVudC52YXJzLmxlbmd0aH0gYXJndW1lbnRzLCBnb3QgJHthcmdzLmxlbmd0aH1gKVxuICAgICAgICAgIGxldCBjYWxsZW52ID0gZm4uY29udGVudC5lbnYgYXMgRW52O1xuICAgICAgICAgIGNhbGxlbnYgPSBmbi5jb250ZW50LnZhcnMucmVkdWNlKChlbnYsIHYsIGkpID0+IGJpbmRWYWx1ZShlbnYsIHYsIGFyZ3NbaV0sIHRydWUpLCBjYWxsZW52KVxuICAgICAgICAgIGxldCByZXMgPSBnbyhmbi5jb250ZW50LmJvZHksIGNhbGxlbnYpXG4gICAgICAgICAgaWYgKHJlcy50eXBlKSBhbm5vdChhc3QsIHJlcy50eXBlKVxuXG4gICAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGFwcGx5IG5vbi1mdW5jdGlvbiAke3ByZXR0eUFTVChmbil9YClcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHJldHVybiBhc3RcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGdvKGFzdCwgbnVsbClcbn1cblxuXG5sZXQgc2FtcGxlcyA9IFtcbiAgXCIyMiB8IG51bWJlciB8IDIyXCIsXG4gICdsZXQgeCA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4gICdsZXQgKG51bWJlciB4KSA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4gICdmbiB4ID0+IHggfCBmbiB4MCA9PiBmbiB4ID0+ICh0eXBlb2YgeCknLFxuICAnKG51bWJlciAyMikgfCBudW1iZXIgfCAyMicsXG4gICdmbiAobnVtYmVyIHgpID0+IHggfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlciB8IGZuIChudW1iZXIgeCkgPT4geCcsXG4gICdmbiB4ID0+IChudW1iZXIgeCkgfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlcicsXG4gICcoZm4geCA9PiB4IDIyKSB8IG51bWJlcicsXG4gICcoZm4gKG51bWJlciB4KSA9PiB4IDIyKSB8IG51bWJlcicsXG4gICcoZm4gKHN0cmluZyB4KSA9PiB4IDIyKSB8IGVycm9yJyxcbiAgJ2xldCBpZCA9IGZuIHggPT4geCBpbiBmbiB5ID0+IChpZCB5KSB8IGZuIHgwID0+IGZuIHkgPT4gKHR5cGVvZiB5KSB8IGZuIHkgPT4geScsXG4gICdmbiAobnVtYmVyIHgpID0+IChzdHJpbmcgeCkgfCBlcnJvcicsXG5dLm1hcChjb2RlID0+IGNvZGUuc3BsaXQoXCJ8XCIpLm1hcChzID0+IHMudHJpbSgpKSlcblxuXG5sZXQgcmVzdWx0cyA9IHRhYmxlKCkuc3R5bGUoe1xuICB3aWR0aDogXCIxMDAlXCIsXG4gIHdoaXRlU3BhY2U6IFwicHJlXCIsXG59KVxuXG5cblxuXG5mb3IgKGxldCBbY29kZSwgZXhwZWN0ZWRUeXBlLCBleHBlY3RlZFJlc3VsdF0gb2Ygc2FtcGxlcyl7XG5cbiAgbGV0IGFzdCA9IHBhcnNlKGNvZGUpXG4gIGxldCByZXMgOiBBU1QgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcblxuICB0cnl7XG4gICAgcmVzID0gcnVuKGFzdC5hc3QpXG4gIH1jYXRjaChlKXtcbiAgICBpZiAoZXhwZWN0ZWRUeXBlICE9IFwiZXJyb3JcIikgY29uc29sZS5lcnJvcihgRXJyb3IgcnVubmluZyBjb2RlOiAke2NvZGV9XFxuYCwgZSlcbiAgfVxuXG4gIGxldCB0eXBlU3RyID0gcmVzID8gcmVzLnR5cGUgPyBwcmV0dHlBU1QocmVzLnR5cGUpIDogXCJubyB0eXBlXCIgOiBcImVycm9yXCJcbiAgbGV0IHJlc1N0ciA9IHJlcyA/IHByZXR0eUFTVChyZXMpIDogXCJlcnJvclwiXG5cbiAgbGV0IGNoZWNrID0gKHR5cGVTdHIgPT0gKGV4cGVjdGVkVHlwZSA/PyB0eXBlU3RyKSAmJiByZXNTdHIgPT0gKGV4cGVjdGVkUmVzdWx0ID8/IHJlc1N0cikpXG5cblxuXG5cbiAgaWYgKCFjaGVjaykge1xuICAgIHJlc3VsdHMuYXBwZW5kKFxuICAgICAgdHIoXG4gICAgICAgIHRkKGNvZGUpLFxuICAgICAgICB0ZCh0eXBlU3RyKS5zdHlsZSh7Y29sb3I6IHR5cGVTdHIgPT0gKGV4cGVjdGVkVHlwZSA/PyB0eXBlU3RyKSA/IFwiZ3JlZW5cIiA6IFwicmVkXCIsIHBhZGRpbmc6IFwiMCA4cHhcIn0pLFxuICAgICAgICB0ZChyZXNTdHIpLnN0eWxlKHtjb2xvcjogcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpID8gXCJncmVlblwiIDogXCJyZWRcIn0pXG4gICAgICApXG4gICAgICAuc3R5bGUoe1xuICAgICAgICBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICAgICAgfSlcbiAgICApXG4gICAgYm9keS5hcHBlbmQoZGl2KHJlc3VsdHMpXG4gICAgLnN0eWxlKHtcbiAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsXG4gICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICAgICAgcGFkZGluZzogXCIxNnB4XCIsXG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgfSkpXG4gIH1cbn0gICAgXG5cblxuXG4iLAogICAgImltcG9ydCB7IGJvZHksIGh0bWwsIHNwYW4gLCBmcm9tSFRNTCwgaDIsIGRpdn0gZnJvbSBcIi4vaHRtbFwiO1xuaW1wb3J0IHsgZWRpdG9yIH0gZnJvbSBcIi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBwYXJzZSwgcHJldHR5QVNULCB0eXBlIEFTVCwgdHlwZSBTcGFuLCB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIjtcbmltcG9ydCB7IGdldGRlZiB9IGZyb20gXCIuL2xzcFwiXG5pbXBvcnQgeyBydW4sIEFOWSB9IGZyb20gXCIuL3J1bnRpbWVcIlxuaW1wb3J0IHsgY29sb3IgfSBmcm9tIFwiLi9odG1sXCI7XG5cblxuaWYgKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4uaW5jbHVkZXMoXCJsb2NhbGhvc3RcIikpKGFzeW5jICgpPT57XG4gIGxldCB2ZXJzaW9uID0gYXdhaXQgZmV0Y2goXCIvdmVyc2lvblwiKS50aGVuKHJlcyA9PiByZXMudGV4dCgpKVxuICAuY2F0Y2goZT0+XCIwXCIpXG4gIHdoaWxlICh0cnVlKXtcbiAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSlcbiAgICB0cnl7XG4gICAgICBpZiAoYXdhaXQgZmV0Y2goXCIvdmVyc2lvblwiKS50aGVuKHJlcyA9PiByZXMudGV4dCgpKS5jYXRjaChlPT5cIjBcIikhPSB2ZXJzaW9uKSB3aW5kb3cubG9jYXRpb24ucmVsb2FkKClcbiAgICB9Y2F0Y2goZSl7YnJlYWs7fVxuICB9XG59KSgpO1xuXG5cblxubGV0IG91dHZpZXcgPSBodG1sKCdwcmUnKSgpLnN0eWxlKHtcbiAgYm9yZGVyVG9wOiBcIjFweCBzb2xpZCBcIitjb2xvci5jb2xvcixcbiAgcGFkZGluZ1RvcDogXCIxNnB4XCIsXG59KVxuXG5sZXQgYXN0OiBBU1QgfCB1bmRlZmluZWRcbmxldCBjdXJyZW50QXN0TWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IFtdXG5cblxubGV0IGNvZGU6c3RyaW5nID0gJydcblxubGV0IEVkaXQgPSBlZGl0b3Iocz0+IHtcbiAgICB0cnl7XG4gICAgICBsZXQgcGFyc2VkID0gcGFyc2UocylcbiAgICAgIGFzdCA9IHBhcnNlZC5hc3RcbiAgICAgIGN1cnJlbnRBc3RNYXAgPSBwYXJzZWQuYXN0bWFwXG4gICAgICBjb2RlID0gc1xuICAgICAgbGV0IHJlcyA9IHJ1bihhc3QpXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gcHJldHR5QVNUKHJlcylcblxuICAgIH1jYXRjaChlKXtcbiAgICAgIGFzdCA9IHVuZGVmaW5lZFxuICAgICAgY3VycmVudEFzdE1hcCA9IFtdXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgfVxuICB9LFxuICAoKT0+IGN1cnJlbnRBc3RNYXAsXG4gIChyZXEpID0+IHtcbiAgICBsZXQgZGVmID0gcmVxLiQgPT0gXCJ2YXJcIiA/IGdldGRlZihhc3QhLCByZXEpIDogdW5kZWZpbmVkXG4gICAgaWYgKGRlZikgRWRpdC5zZXRDdXJzb3Ioe3JvdzogZGVmLnNwYW4uc3RhcnQubGluZS0xLCBjb2w6IGRlZi5zcGFuLnN0YXJ0LmNvbC0xfSlcbiAgfSxcbiAgKG5vZGUpID0+IHtcbiAgICBpZiAobm9kZS4kID09PSBcImNvbW1lbnRcIikgcmV0dXJuIHVuZGVmaW5lZFxuXG4gICAgcmV0dXJuIG5vZGUuJCArIFwiOiBcIiArIChub2RlLnR5cGUgPyBwcmV0dHlBU1Qobm9kZS50eXBlKSA6IChub2RlLiQgPT0gXCJ2YXJcIiA/IHByZXR0eUFTVChnZXRkZWYoYXN0ISwgbm9kZSk/LnR5cGUgPz8gQU5ZKSA6IFwiWFhcIikpXG4gIH1cbilcblxuYm9keS5zdHlsZSh7cGFkZGluZzogXCI0NHB4XCIsZm9udEZhbWlseTogXCJzYW5zLXNlcmlmXCIsfSlcblxuXG5sZXQgYnV0dG4gPSAodDpzdHJpbmcsIG9uQ2xpY2s6KCkgPT4gdm9pZCkgPT4gc3Bhbih0LCBvbkNsaWNrKS5zdHlsZSh7Y29sb3I6IFwiZ3JheVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkIGdyYXlcIiwgYm9yZGVyUmFkaXVzOiBcIjRweFwiLCBwYWRkaW5nOiBcIjJweCA0cHhcIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KVxuXG5sZXQgYWJvdXRfdGV4dCA9IGBcblxuLy8gVGhpcyBpcyBhIHRveSBjb2RlIGVkaXRvciBzdGlsbCBpbiBkZXZlbG9wbWVudC5cblxuLy8gdGhlIGdvYWwgaXMgdG8gYnVpbGQgYSBsYW5ndWFnZSB3aXRoOlxuXG4vLyBleHRyZW1lbHkgbWluaW1hbCBzeW50YXhcbi8vIGZpcnN0IGNsYXNzIHN1cHBvcnQgZm9yIHR5cGVzIGFzIHZhbHVlc1xuLy8gZmlyc3QgY2FzcyBMU1AgcHJvZ3JhbW5nIGluIGEgc3RyYWlnaHRmb3J3YXJkIHdheS5cblxuXG4vLyBob3ZlciBvdmVyIHggdG8gc2VlIGl0cyBpbmZlcnJlZCB0eXBlXG5sZXQgbiA9IDIyIGluXG5cbi8vIHRoaXMgaXMgaG93IHR5cGVzIGFyZSBhbm5vdGF0ZWQuIHR5cGVzIGFyZSBlc3NlbnRpYWxseSBqdXN0IGZ1bmN0aW9ucyBvdmVyIHZhbHVlcy5cbmxldCBrID0gKG51bWJlciAzMykgaW5cbmxldCB1ID0gKHN0cmluZyBcImhsbG9cIikgaW5cblxuXG4vLyB1bnR5cGVkIGlkXG5sZXQgaWQgPSBmbiB4ID0+IHggaW5cblxuXG4vLyBudW1iZXIgdHlwZWQgaWRcbmxldCBpZG4gPSBmbiB4ID0+IChudW1iZXIgeCkgaW5cblxuLy8gdHlwZSBvZiBudW1iZXIgLT4gbnVtYmVyXG5sZXQgVCA9IGZuIGY9PiBmbiB4ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSkpIGluXG5cbi8vIGFubm90ZWQgaWRcblxubGV0IGlkbl8gPSAoVCBpZCkgaW5cblxubGV0IHI9IChpZCBcIjJcIikgaW5cblxuLy8gdGhpcyBpcyB3aWxsIHJlc3VsdCBpbiB0eXBlIGVycm9yLlxuLy8gbGV0IEJBRCA9IChpZG5fIFwiMlwiKSBpblxuXG4oaWQgMilcbmBcblxuYm9keS5hcHBlbmQoXG4gIGRpdihcbiAgICBzcGFuKCfinIjvuI4nKS5zdHlsZSh7Zm9udFNpemU6IFwiM2VtXCIsIG1hcmdpblJpZ2h0OiBcIjhweFwifSksXG4gICAgc3BhbihcIk1pR1wiKS5zdHlsZSh7Zm9udFNpemU6IFwiMS41ZW1cIiwgZm9udFdlaWdodDogXCJib2xkXCIsIGZvbnRGYW1pbHk6IFwibW9ub3NwYWNlXCJ9KVxuICApLnN0eWxlKHtkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgbWFyZ2luQm90dG9tOiBcIjE2cHhcIiwgY29sb3I6IFwiZ3JheVwifSksXG5cbiAgRWRpdC5lbCxcbiAgb3V0dmlldyxcbiAgYnV0dG4oXCJhYm91dFwiLCAoKSA9PiBFZGl0LnNldFRleHQoYWJvdXRfdGV4dCkpLFxuICBidXR0bihcImdpdGh1YlwiLCAoKSA9PiB3aW5kb3cub3BlbihcImh0dHBzOi8vZ2l0aHViLmNvbS9ka29ybWFubi9teWVkaXRvclwiKSlcbilcblxuXG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBYU8sSUFBTSxPQUFPLENBQXlDLFFBQVUsSUFBSSxhQUFvRDtBQUFBLEVBQzdILElBQUksVUFBVSxTQUFTLEtBQUssT0FBSyxPQUFPLE1BQU0sVUFBVTtBQUFBLEVBQ3hELElBQUksS0FBSyxTQUFVLFNBQVMsY0FBYyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUksU0FBUyxPQUFP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SUFBSSxNQUFNLElBQUksS0FBSyxRQUFRLE9BQU8sS0FBTSxHQUFHLElBQUk7QUFBQSxFQUMvQyxJQUFJO0FBQUEsSUFBSyxLQUFLLFVBQVUsRUFBQyxLQUFLLElBQUksS0FBSyxNQUFNLE9BQUssR0FBRyxLQUFLLElBQUksS0FBSyxNQUFNLE1BQUksRUFBQyxDQUFDO0FBQUEsR0FFakYsQ0FBQyxTQUFTO0FBQUEsRUFDUixJQUFJLEtBQUssTUFBTTtBQUFBLElBQVc7QUFBQSxFQUUxQixPQUFPLEtBQUssSUFBSSxRQUFRLEtBQUssT0FBTyxVQUFVLEtBQUssSUFBSSxJQUFLLEtBQUssS0FBSyxRQUFRLFVBQVUsT0FBTyxLQUFNLElBQUksR0FBRyxRQUFRLEdBQUcsSUFBSTtBQUFBLENBRS9IO0FBRUEsS0FBSyxNQUFNLEVBQUMsU0FBUyxRQUFPLFlBQVksYUFBYSxDQUFDO0FBR3RELElBQUksUUFBUSxDQUFDLEdBQVUsWUFBdUIsS0FBSyxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUMsT0FBTyxRQUFRLFFBQVEsa0JBQWtCLGNBQWMsT0FBTyxTQUFTLFdBQVcsYUFBYSxNQUFLLENBQUM7QUFFM0ssSUFBSSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBeUNqQixLQUFLLE9BQ0gsSUFDRSxLQUFLLElBQUcsRUFBRSxNQUFNLEVBQUMsVUFBVSxPQUFPLGFBQWEsTUFBSyxDQUFDLEdBQ3JELEtBQUssS0FBSyxFQUFFLE1BQU0sRUFBQyxVQUFVLFNBQVMsWUFBWSxRQUFRLFlBQVksWUFBVyxDQUFDLENBQ3BGLEVBQUUsTUFBTSxFQUFDLFNBQVMsUUFBUSxZQUFZLFVBQVUsY0FBYyxRQUFRLE9BQU8sT0FBTSxDQUFDLEdBRXBGLEtBQUssSUFDTCxTQUNBLE1BQU0sU0FBUyxNQUFNLEtBQUssUUFBUSxVQUFVLENBQUMsR0FDN0MsTUFBTSxVQUFVLE1BQU0sT0FBTyxLQUFLLHNDQUFzQyxDQUFDLENBQzNFOyIsCiAgImRlYnVnSWQiOiAiN0IxQjJFMTgzRUY1Rjc3MTY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
