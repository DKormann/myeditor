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
    if (x.type) {
      if (x.type.$ == "var" && x.type.content.name == name)
        return x;
      throw new Error(`Type error: expected ${name}, got ${prettyAST(x.type)}`);
    }
    return annot(x, mkvar(name));
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
        return mkapp(fn, args);
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

let r = (id "2") in

// this is will result in type error.
// let BAD = (idn_ "2") in

(id 2)
`;
body.append(div(span("✈︎").style({ fontSize: "3em", marginRight: "8px" }), span("MiG").style({ fontSize: "1.5em", fontWeight: "bold", fontFamily: "monospace" })).style({ display: "flex", alignItems: "center", marginBottom: "16px", color: "gray" }), Edit.el, outview, buttn("about", () => Edit.setText(about_text)), buttn("github", () => window.open("https://github.com/dkormann/myeditor")));

//# debugId=394CA5ADCE3AA12D64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjogKE5PREUgfCBzdHJpbmcpW10pID0+IE5PREUsXG4gIHN0eWxlOiAoc3R5bGVzOiBQYXJ0aWFsPENTU1N0eWxlRGVjbGFyYXRpb24+KSA9PiBOT0RFLFxuICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiBOT0RFXG59XG5cbmV4cG9ydCB0eXBlIEFSRyA9IE5PREUgfCBzdHJpbmcgfCAoKGU6TW91c2VFdmVudCk9PnZvaWQpXG5cbmV4cG9ydCBjb25zdCBodG1sID0gPEsgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+ICh0YWc6SykgPT4gKC4uLmNoaWxkcmVuOkFSR1tdKTogTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPiA9PiB7XG4gIGxldCBvbmNsaWNrID0gY2hpbGRyZW4uZmluZChjID0+IHR5cGVvZiBjID09PSBcImZ1bmN0aW9uXCIpIGFzIEZ1bmN0aW9uXG4gIGxldCBlbCA9IGZyb21IVE1MIChkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZykpLmFwcGVuZCguLi4gY2hpbGRyZW4uZmlsdGVyKGMgPT4gdHlwZW9mIGMgIT09IFwiZnVuY3Rpb25cIikgYXMgKE5PREUgfCBzdHJpbmcpW10pIGFzIE5PREUgPEhUTUxFbGVtZW50VGFnTmFtZU1hcFtLXT47XG4gIGlmIChvbmNsaWNrKSBlbC5lbC4gb25jbGljayA9IChvbmNsaWNrIGFzIChlOk1vdXNlRXZlbnQpPT52b2lkKVxuICBcbiAgcmV0dXJuIGVsXG59XG5cblxuZXhwb3J0IGNvbnN0IGZyb21IVE1MICA9IDxIIGV4dGVuZHMgSFRNTEVsZW1lbnQ+ICAoZWw6SCk6IE5PREUgPEg+ID0+IHtcbiAgbGV0IG5vZGUgOiBOT0RFPEg+ID0ge1xuICAgICQ6IFwiTk9ERVwiLFxuICAgIGVsLFxuICAgIGFwcGVuZDogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNoaWxkID09PSBcInN0cmluZ1wiKSBlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGlsZCkpO1xuICAgICAgICBlbHNlIGVsLmFwcGVuZENoaWxkKGNoaWxkLmVsKTtcblxuICAgICAgfSk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBlbC5yZXBsYWNlQ2hpbGRyZW4oKVxuICAgICAgcmV0dXJuIG5vZGUuYXBwZW5kKC4uLmNoaWxkcmVuKVxuICAgIH0sXG4gICAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IHtcbiAgICAgIE9iamVjdC5hc3NpZ24oZWwuc3R5bGUsIHN0eWxlcyk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgYXNzaWduOiAoaHRtbFByb3BzOiBQYXJ0aWFsPEhUTUxFbGVtZW50PikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbCwgaHRtbFByb3BzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfVxuICB9O1xuICByZXR1cm4gbm9kZVxufVxuXG5cbmV4cG9ydCBjb25zdCBkaXYgPSBodG1sKFwiZGl2XCIpO1xuZXhwb3J0IGNvbnN0IHNwYW4gPSBodG1sKFwic3BhblwiKTtcbmV4cG9ydCBjb25zdCBwID0gaHRtbChcInBcIik7XG5leHBvcnQgY29uc3QgYm9keSA9IGZyb21IVE1MKGRvY3VtZW50LmJvZHkpO1xuZXhwb3J0IGNvbnN0IGgxID0gaHRtbChcImgxXCIpO1xuZXhwb3J0IGNvbnN0IGgyID0gaHRtbChcImgyXCIpO1xuZXhwb3J0IGNvbnN0IGgzID0gaHRtbChcImgzXCIpO1xuZXhwb3J0IGNvbnN0IGg0ID0gaHRtbChcImg0XCIpO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gaHRtbChcInRhYmxlXCIpO1xuZXhwb3J0IGNvbnN0IHRyID0gaHRtbChcInRyXCIpO1xuZXhwb3J0IGNvbnN0IHRkID0gaHRtbChcInRkXCIpO1xuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNTZiNmMyO1xuXG4gIC0tZ3JheTogI2FiYjJiZjg4O1xuICAtLWNvbG9yOiAjZTdlYWYwO1xuICAtLWJhY2tncm91bmQ6ICMyYTI3MmE7XG4gIH1cbiAgQG1lZGlhIChwcmVmZXJzLWNvbG9yLXNjaGVtZTogbGlnaHQpIHtcbiAgICBib2R5e1xuICAgICAgLS1yZWQ6ICNlMDZjNzU7XG4gICAgICAtLWdyZWVuOiAjOThjMzc5O1xuICAgICAgLS1ibHVlOiAjNDE5ZmVjO1xuICAgICAgLS15ZWxsb3c6ICNkZGIxNWY7XG4gICAgICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgICAgIC0tY3lhbjogIzU2YjZjMjtcblxuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuY29uc3QgY29sb3JPZiA9IChub2RlOiBTeW50YXhOb2RlIHwgdW5kZWZpbmVkKTogc3RyaW5nID0+IFxuICAobm9kZSA9PSB1bmRlZmluZWQpID8gY29sb3IuZ3JheSA6XG4gIChub2RlLiQgPT09IFwiY29tbWVudFwiKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcIm51bWJlclwiIHx8IG5vZGUuJCA9PT0gXCJzdHJpbmdcIiApID8gY29sb3IueWVsbG93IDpcbiAgKG5vZGUuJCA9PT0gXCJ2YXJcIikgPyBjb2xvci5wdXJwbGUgOlxuICAobm9kZS4kID09PSBcImxldFwiIHx8IG5vZGUuJCA9PSBcImZ1bmN0aW9uXCIgKSA/IGNvbG9yLmJsdWUgOlxuICAobm9kZS4kID09PSBcImFwcFwiKSA/IGNvbG9yLmdyZWVuIDpcbiAgKG5vZGUuJCA9PT0gXCJlcnJvclwiKSA/IGNvbG9yLnJlZCA6XG4gIGNvbG9yLmNvbG9yXG5cblxubGV0IGUgPSAyIGFzIG51bWJlclxuXG5leHBvcnQgY29uc3QgZWRpdG9yID0gKG9uaW5wdXQ6IChzOnN0cmluZyk9PnZvaWQsXG4gIGdldEFzdE1hcCA6ICgpPT4gKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdLFxuICBnb1RvRGVmIDogKGFzdDogU3ludGF4Tm9kZSkgPT4gdm9pZCxcbiAgaG92ZXJJbmZvOiAoYXN0OiBTeW50YXhOb2RlKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibGluZXNcIik/LnNwbGl0KFwiXFxuXCIpID8/IFtcIlwiXVxuICBsZXQgY3Vyc29yIDogUG9zICYge3NlbGVjdGlvbj8gOiBQb3N9ID0ge2NvbDowLCByb3c6MH07XG5cbiAgbGV0IGVsID0gaHRtbChcInByZVwiKSgpXG4gIC5zdHlsZSh7XG4gICAgdXNlclNlbGVjdDogXCJub25lXCIsXG4gICAgY3Vyc29yOiBcInRleHRcIixcbiAgfSlcblxuXG4gIGxldCBoaXN0IDogc3RyaW5nW10gPSBbXVxuICBsZXQgZWxlbWVudHMgPSBuZXcgV2Vha01hcDxIVE1MRWxlbWVudCwge3BvczpQb3MsIGFzdD86IFN5bnRheE5vZGV9PigpXG4gIGxldCBhc3RtYXA6IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSA9IFtdXG5cbiAgbGV0IHBsZXNzID0gKGE6IFBvcywgYjogUG9zKSA9PiBhLnJvdyA8IGIucm93IHx8IChhLnJvdyA9PSBiLnJvdyAmJiBhLmNvbCA8IGIuY29sKVxuICBsZXQgcGxlc3NlcSA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPD0gYi5jb2wpXG5cbiAgbGV0IHNlbHJhbmdlID0gKCkgOiB1bmRlZmluZWQgfCBbUG9zLCBQb3NdID0+IHtcbiAgICBpZiAoIWN1cnNvci5zZWxlY3Rpb24pIHJldHVybiB1bmRlZmluZWRcbiAgICBpZiAoY3Vyc29yLnJvdyA9PSBjdXJzb3Iuc2VsZWN0aW9uLnJvdyAmJiBjdXJzb3IuY29sID09IGN1cnNvci5zZWxlY3Rpb24uY29sKSB7XG4gICAgICBjdXJzb3Iuc2VsZWN0aW9uID0gdW5kZWZpbmVkXG4gICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgfVxuICAgIGlmIChwbGVzc2VxKGN1cnNvciwgY3Vyc29yLnNlbGVjdGlvbikpIHJldHVybiBbY3Vyc29yLCBjdXJzb3Iuc2VsZWN0aW9uXVxuICAgIGVsc2UgcmV0dXJuIFtjdXJzb3Iuc2VsZWN0aW9uLCBjdXJzb3JdXG4gIH1cblxuICBjb25zdCByZW5kZXIgPSAoKSA9PiB7XG4gICAgbGV0IGNvZGUgPSBsaW5lcy5qb2luKFwiXFxuXCIpXG4gICAgbGV0IHNjb2wgPSBNYXRoLm1pbihjdXJzb3IuY29sLCBsaW5lc1tjdXJzb3Iucm93XT8ubGVuZ3RoID8/IDApXG5cbiAgICBsZXQgY2hhcnM6IEhUTUxFbGVtZW50W10gPSBbXVxuXG5cbiAgICBsZXQgbWtjb2xvciA9ICgpID0+IHtcbiAgICAgIGNoYXJzLmZvckVhY2goKGMsIGkpPT57XG4gICAgICAgIGxldCBhc3QgPSBhc3RtYXBbaV1cbiAgICAgICAgbGV0IGNvbG9yID0gY29sb3JPZihhc3QpXG4gICAgICAgIGlmIChjb2xvcikgYy5zdHlsZS5jb2xvciA9IGNvbG9yXG4gICAgICAgIGVsc2UgYy5zdHlsZS5jb2xvciA9IFwiXCJcbiAgICAgICAgZWxlbWVudHMuZ2V0KGMpIS5hc3QgPSBhc3RcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuXG5cbiAgICBlbC5yZXBsYWNlQ2hpbHJlbiguLi5saW5lcy5tYXAoKGxpbmUscm93KT0+e1xuICAgICAgbGV0IHBhciA9IHAoXG4gICAgICAgIC4uLmxpbmUuc3BsaXQoXCJcIikuY29uY2F0KCcgJykubWFwKFxuICAgICAgICAgIChjaGFyLGNvbCk9PntcblxuICAgICAgICAgICAgbGV0IGNociA9IHNwYW4oY2hhcilcbiAgICAgICAgICAgIC5zdHlsZSggcmFuZ2UgJiYgcGxlc3Moe3JvdywgY29sfSwgcmFuZ2VbMV0pICYmIHBsZXNzZXEocmFuZ2VbMF0sIHtyb3csIGNvbH0pID8ge2JhY2tncm91bmRDb2xvcjogXCIjOGQ5NmZmODVcIiwgY29sb3I6IGNvbG9yLmJhY2tncm91bmR9IDoge30pXG4gICAgICAgICAgICAuc3R5bGUoY3Vyc29yLnJvdyA9PT0gcm93ICYmIHNjb2wgPT09IGNvbCA/IHtib3hTaGFkb3c6IGAycHggMCAwIDAgJHtjb2xvci5jb2xvcn0gaW5zZXRgLH0gOiB7fSlcbiAgICAgICAgICAgIGNoYXJzLnB1c2goY2hyLmVsKVxuICAgICAgICAgICAgZWxlbWVudHMuc2V0KGNoci5lbCwge3Bvczoge3JvdywgY29sfX0pXG4gICAgICAgICAgICByZXR1cm4gY2hyXG4gICAgICAgICAgfVxuICAgICAgICApLFxuICAgICAgKS5zdHlsZSh7bWFyZ2luOiBcIjBcIn0pXG4gICAgICBlbGVtZW50cy5zZXQocGFyLmVsLCB7cG9zOntyb3csIGNvbDogbGluZS5sZW5ndGh9fSlcbiAgICAgIHJldHVybiBwYXJcbiAgICB9KSlcblxuICAgIG1rY29sb3IoKVxuXG4gICAgaWYgKGhpc3RbaGlzdC5sZW5ndGggLSAxXSAhPSBjb2RlKSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImxpbmVzXCIsIGNvZGUpXG4gICAgICBvbmlucHV0KGNvZGUpXG4gICAgICBoaXN0LnB1c2goY29kZSlcbiAgICAgIGFzdG1hcCA9IGdldEFzdE1hcCgpXG4gICAgICBta2NvbG9yKClcbiAgICB9XG5cbiAgfVxuXG5cblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZT0+e1xuICAgIGxldCBzZXRDdXJzb3IgPSAocG9zOlBvcyk9PntcbiAgICAgIGlmICghZS5zaGlmdEtleSkgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgZWxzZSBjdXJzb3Iuc2VsZWN0aW9uID0gY3Vyc29yLnNlbGVjdGlvbiB8fCB7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2x9XG4gICAgICBjdXJzb3IuY29sID0gcG9zLmNvbFxuICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICB9XG5cbiAgICBsZXQgY2xlYXJfcmFuZ2UgPSAoKSA9PiB7XG4gICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICBpZiAoIXJhbmdlKSByZXR1cm5cbiAgICAgIGxpbmVzID0gWy4uLmxpbmVzLnNsaWNlKDAsIHJhbmdlWzBdLnJvdyksIGxpbmVzW3JhbmdlWzBdLnJvd10uc3Vic3RyaW5nKDAsIHJhbmdlWzBdLmNvbCkgKyBsaW5lc1tyYW5nZVsxXS5yb3ddLnN1YnN0cmluZyhyYW5nZVsxXS5jb2wpLCAuLi5saW5lcy5zbGljZShyYW5nZVsxXS5yb3cgKyAxKV1cbiAgICAgIHNldEN1cnNvcih7cm93OiByYW5nZVswXS5yb3csIGNvbDogcmFuZ2VbMF0uY29sfSlcbiAgICB9XG5cbiAgICBpZiAoZS5rZXkubGVuZ3RoID09PSAxKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoZS5rZXkgPT0gXCJ6XCIpe1xuICAgICAgICAgIGlmIChoaXN0Lmxlbmd0aCA+IDEpe1xuICAgICAgICAgICAgaGlzdC5wb3AoKVxuICAgICAgICAgICAgbGV0IGxhc3QgPSBoaXN0W2hpc3QubGVuZ3RoIC0gMV1cbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxpbmVzID0gbGFzdC5zcGxpdChcIlxcblwiKVxuICAgICAgICAgICAgc2V0Q3Vyc29yKHtyb3c6MCwgY29sOjB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICByZW5kZXIoKVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcImNcIil7XG4gICAgICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgICAgICBsZXQgdGV4dCA9IGxpbmVzLnNsaWNlKHJhbmdlWzBdLnJvdywgcmFuZ2VbMV0ucm93ICsgMSkubWFwKChsaW5lLCBpKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChpID09IDAgJiYgaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZyhyYW5nZVswXS5jb2wsIHJhbmdlWzFdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSAwKSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sKVxuICAgICAgICAgICAgICBlbHNlIGlmIChpID09IHJhbmdlWzFdLnJvdyAtIHJhbmdlWzBdLnJvdykgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKDAsIHJhbmdlWzFdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSByZXR1cm4gbGluZVxuICAgICAgICAgICAgfSkuam9pbihcIlxcblwiKVxuICAgICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09IFwidlwiKXtcbiAgICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLnJlYWRUZXh0KCkudGhlbih0ZXh0ID0+IHtcbiAgICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICAgIGNsZWFyX3JhbmdlKClcbiAgICAgICAgICAgIGxldCBpbnNlcnRMaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIGxpbmVzID0gWy4uLmxpbmVzLnNsaWNlKDAsIGN1cnNvci5yb3cpLCBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCkgKyBpbnNlcnRMaW5lc1swXSwgLi4uaW5zZXJ0TGluZXMuc2xpY2UoMSwgLTEpLCBpbnNlcnRMaW5lcy5sZW5ndGggPiAxID8gaW5zZXJ0TGluZXNbaW5zZXJ0TGluZXMubGVuZ3RoIC0gMV0gKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCkgOiBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93ICsgaW5zZXJ0TGluZXMubGVuZ3RoIC0gMSwgY29sOiAoaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCA6IGN1cnNvci5jb2wgKyBpbnNlcnRMaW5lc1swXS5sZW5ndGgpfSlcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgbGluZXNbY3Vyc29yLnJvd10gPSBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCkgKyBlLmtleSArIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sKVxuICAgICAgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbCArIDF9KVxuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQmFja3NwYWNlXCIpe1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKHJhbmdlKXtcbiAgICAgICAgY2xlYXJfcmFuZ2UoKVxuXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChlLm1ldGFLZXkgJiYgY3Vyc29yLmNvbCA+IDApe1xuICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKCBjdXJzb3IuY29sKSwgLi4ubGluZXMuc2xpY2UoY3Vyc29yLnJvdyArIDEpXVxuICAgICAgICBjdXJzb3IuY29sID0gMFxuICAgICAgXG4gICAgICB9ZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApe1xuICAgICAgICBjdXJzb3IuY29sLS1cbiAgICAgICAgbGluZXNbY3Vyc29yLnJvd10gPSBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCArIDEpXG4gICAgICB9ZWxzZSBpZiAoY3Vyc29yLnJvdyA+IDApe1xuICAgICAgICBjdXJzb3Iucm93LS1cbiAgICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aFxuICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10gKyBsaW5lc1tjdXJzb3Iucm93ICsgMV0sIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAyKV1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dMZWZ0XCIpe1xuICAgICAgaWYgKGUubWV0YUtleSl7XG4gICAgICAgIGlmIChjdXJzb3IuY29sID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogMH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbCAtIDF9KVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93IC0gMSwgY29sOiBsaW5lc1tjdXJzb3Iucm93IC0gMV0ubGVuZ3RofSlcblxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dSaWdodFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA8IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RofSlcbiAgICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA8IGxpbmVzLmxlbmd0aCAtIDEpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93ICsgMSwgY29sOiAwfSlcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93VXBcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KSBzZXRDdXJzb3Ioe3JvdzogMCwgY29sOiBjdXJzb3IuY29sfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd0Rvd25cIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KSBzZXRDdXJzb3Ioe3JvdzogbGluZXMubGVuZ3RoIC0gMSwgY29sOiBjdXJzb3IuY29sfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKXtcbiAgICAgIGxpbmVzID0gW1xuICAgICAgICAuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSxcbiAgICAgICAgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpLFxuICAgICAgICAobGluZXNbY3Vyc29yLnJvd10ubWF0Y2goL15cXHMqLyk/LlswXSB8fCBcIlwiKSArIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sKSxcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoY3Vyc29yLnJvdyArIDEpXVxuICAgICAgY3Vyc29yLnJvdysrXG4gICAgICBjdXJzb3IuY29sID0gbGluZXNbY3Vyc29yLnJvd10ubWF0Y2goL15cXHMqLyk/LlswXS5sZW5ndGggfHwgMFxuICAgIH1cblxuXG4gICAgaWYgKGUua2V5LnN0YXJ0c1dpdGgoXCJBcnJvd1wiKSl7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICB9XG5cbiAgICByZW5kZXIoKVxuXG4gIH0pXG5cblxuICBsZXQgbW91c2Vkb3duPSBmYWxzZSAgXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgZT0+e1xuICAgIGlmIChlLm1ldGFLZXkpIHtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIGdvVG9EZWYoYXN0KVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIG1vdXNlZG93biA9IHRydWVcbiAgICBpZiAoZWxlbWVudHMuaGFzKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSl7XG4gICAgICBjdXJzb3IgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpIS5wb3NcbiAgICAgIHJlbmRlcigpXG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIGU9PntcbiAgICBpZiAobW91c2Vkb3duKSB7XG4gICAgICBpZiAoZWxlbWVudHMuaGFzKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSl7XG4gICAgICAgIGxldCBwb3MgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpIS5wb3NcbiAgICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgICBjdXJzb3Iucm93ID0gcG9zLnJvd1xuICAgICAgICBjdXJzb3IuY29sID0gcG9zLmNvbFxuICAgICAgICByZW5kZXIoKVxuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgbGV0IGFzdCA9IGVsZW1lbnRzLmdldChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCk/LmFzdFxuICAgICAgaWYgKGFzdCkge1xuICAgICAgICBsZXQgaW5mbyA9IGhvdmVySW5mbyhhc3QpXG4gICAgICAgIGlmIChpbmZvKSB7XG4gICAgICAgICAgbGV0IHRvb2x0aXAgPSBkaXYoaW5mbykuc3R5bGUoe1xuICAgICAgICAgICAgcG9zaXRpb246IFwiZml4ZWRcIixcbiAgICAgICAgICAgIGxlZnQ6IGUuY2xpZW50WCArIFwicHhcIixcbiAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogY29sb3IuYmFja2dyb3VuZCxcbiAgICAgICAgICAgIGNvbG9yOiBjb2xvci5jb2xvcixcbiAgICAgICAgICAgIGJvcmRlcjogXCIxcHggc29saWQgXCIgKyBjb2xvci5jb2xvcixcbiAgICAgICAgICAgIHBhZGRpbmc6IFwiOHB4IDEycHhcIixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogXCI0cHhcIixcbiAgICAgICAgICAgIHBvaW50ZXJFdmVudHM6IFwibm9uZVwiLFxuICAgICAgICAgICAgekluZGV4OiBcIjEwMDBcIixcbiAgICAgICAgICAgIHdoaXRlU3BhY2U6IFwicHJlXCIsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvb2x0aXAuZWwpXG4gICAgICAgICAgbGV0IHJlbW92ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRvb2x0aXAuZWwucmVtb3ZlKClcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIG1vdmUpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsIG91dClcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IG1vdmUgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgIGlmIChlLm1ldGFLZXkpIHJldHVybiByZW1vdmUoKVxuICAgICAgICAgICAgdG9vbHRpcC5zdHlsZSh7XG4gICAgICAgICAgICAgIGxlZnQ6IGUuY2xpZW50WCArIFwicHhcIixcbiAgICAgICAgICAgICAgYm90dG9tOiAod2luZG93LmlubmVySGVpZ2h0IC0gZS5jbGllbnRZICsgMTApICsgXCJweFwiLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IG91dCA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5yZWxhdGVkVGFyZ2V0ID09PSB0b29sdGlwLmVsKSByZXR1cm5cbiAgICAgICAgICAgIHJlbW92ZSgpXG4gICAgICAgICAgfVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIG1vdmUpXG4gICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsIGU9PiB7XG4gICAgbW91c2Vkb3duID0gZmFsc2VcbiAgfSlcblxuXG4gIHJlbmRlcigpXG4gIHJldHVybiB7ZWwsXG4gICAgc2V0VGV4dDogKHRleHQ6c3RyaW5nKSA9PiB7XG4gICAgICBsaW5lcyA9IHRleHQuc3BsaXQoXCJcXG5cIilcbiAgICAgIHJlbmRlcigpXG4gICAgfSxcbiAgICBzZXRDdXJzb3I6IChwb3M6IFBvcykgPT4ge1xuICAgICAgY29uc29sZS5sb2coXCJzZXR0aW5nIGN1cnNvciB0b1wiLCBwb3MpXG4gICAgICBjdXJzb3IgPSBwb3NcbiAgICAgIHJlbmRlcigpXG4gICAgfVxuICB9XG5cbiAgXG59XG4iLAogICAgImltcG9ydCB7dHlwZSBFbnZ9IGZyb20gXCIuL3J1bnRpbWVcIlxuZXhwb3J0IHR5cGUgUG9zID0ge29mZnNldDogbnVtYmVyLCBsaW5lOiBudW1iZXIsIGNvbDogbnVtYmVyfVxuZXhwb3J0IHR5cGUgU3BhbiA9IHtzdGFydDogUG9zLCBlbmQ6IFBvc31cblxuZXhwb3J0IHR5cGUgVGFnIDxUIGV4dGVuZHMgc3RyaW5nLCBDPiA9IHskOiBULCBjb250ZW50OiBDLCBzcGFuOiBTcGFuLCB0eXBlPzogQVNUfVxuXG5leHBvcnQgdHlwZSBWYXIgPSBUYWc8XCJ2YXJcIiwge25hbWU6IHN0cmluZ30+XG5leHBvcnQgdHlwZSBDb21tZW50ID0gVGFnPFwiY29tbWVudFwiLCBzdHJpbmc+XG5leHBvcnQgdHlwZSBGdW5jID0gVGFnPFwiZnVuY3Rpb25cIiwge3ZhcnM6IFZhcltdLCBib2R5OiBBU1QsIGVudj8gOkVudn0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFRhZzxcIm51bWJlclwiLCBudW1iZXI+XG4gIHwgVGFnPFwic3RyaW5nXCIsIHN0cmluZz5cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSwgYXN0bWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXX1cblxuY29uc3QgaGFzU2hvd25UeXBlID0gKHY6IFZhcikgPT4gdi50eXBlICYmICEodi50eXBlLiQgPT09IFwidmFyXCIgJiYgdi50eXBlLmNvbnRlbnQubmFtZSA9PT0gXCJhbnlcIilcbmNvbnN0IHByZXR0eUJpbmRlciA9ICh2OiBWYXIpOiBzdHJpbmcgPT4gaGFzU2hvd25UeXBlKHYpID8gYCgke3ByZXR0eUFTVCh2LnR5cGUhKX0gJHt2LmNvbnRlbnQubmFtZX0pYCA6IHYuY29udGVudC5uYW1lXG5cbmV4cG9ydCBjb25zdCBwcmV0dHlBU1QgPSAobm9kZTogQVNUKTogc3RyaW5nID0+e1xuICBzd2l0Y2gobm9kZS4kKXtcbiAgICBjYXNlIFwibnVtYmVyXCIgOiByZXR1cm4gbm9kZS5jb250ZW50LnRvU3RyaW5nKClcbiAgICBjYXNlIFwic3RyaW5nXCIgOiByZXR1cm4gSlNPTi5zdHJpbmdpZnkobm9kZS5jb250ZW50KVxuICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIG5vZGUuY29udGVudC5uYW1lXG4gICAgY2FzZSBcImxldFwiOiByZXR1cm4gYGxldCAke3ByZXR0eUJpbmRlcihub2RlLmNvbnRlbnQudmFyKX0gPSAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQudmFsdWUpfSBpblxcbiR7cHJldHR5QVNUKG5vZGUuY29udGVudC5ib2R5KX1gXG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBgZm4gJHtub2RlLmNvbnRlbnQudmFycy5tYXAocHJldHR5QmluZGVyKS5qb2luKFwiIFwiKX0gPT4gJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBgKCR7cHJldHR5QVNUKG5vZGUuY29udGVudC5mbil9ICR7bm9kZS5jb250ZW50LmFyZ3MubWFwKHByZXR0eUFTVCkuam9pbihcIiBcIil9KWBcbiAgICBjYXNlIFwicmVjb3JkXCI6IHJldHVybiBgeyR7bm9kZS5jb250ZW50Lm1hcCgoW2ssIHZdKSA9PiBgJHtrLmNvbnRlbnQubmFtZX06ICR7cHJldHR5QVNUKHYpfWApLmpvaW4oXCIsIFwiKX19YFxuICAgIGNhc2UgXCJlcnJvclwiOiByZXR1cm4gYFtFUlJPUjogJHtub2RlLmNvbnRlbnQubWVzc2FnZX1dYFxuICB9XG59XG5cblxuY29uc3QgemVyb1BvcyA9ICgpOiBQb3MgPT4gKHtvZmZzZXQ6IDAsIGxpbmU6IDEsIGNvbDogMX0pXG5jb25zdCB6ZXJvU3BhbiA9ICgpOiBTcGFuID0+ICh7c3RhcnQ6IHplcm9Qb3MoKSwgZW5kOiB6ZXJvUG9zKCl9KVxuXG5leHBvcnQgY29uc3QgbWtBc3QgPSA8VCBleHRlbmRzIHN0cmluZywgQz4odGFnOiBULCBjb250ZW50OiBDLCBzcGFuOiBTcGFuID0gemVyb1NwYW4oKSk6IFRhZzxULCBDPiA9PiAoeyQ6IHRhZywgY29udGVudCwgc3Bhbn0pXG5cbnR5cGUgVG9rZW5CYXNlID0ge3NwYW46IFNwYW59XG5cbnR5cGUgVG9rZW4gPVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJpZGVudFwiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBudW1iZXJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcInN5bWJvbFwiLCB2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJhcnJvd1wifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiY29tbWVudFwiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwia2V5d29yZFwiLCB2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfSlcblxudHlwZSBUb2tlbk5vU3BhbiA9IFRva2VuIGV4dGVuZHMgaW5mZXIgVCA/IFQgZXh0ZW5kcyB7c3BhbjogU3Bhbn0gPyBPbWl0PFQsIFwic3BhblwiPiA6IG5ldmVyIDogbmV2ZXJcblxuY29uc3QgdG9rZW5pemUgPSAoY29kZTogc3RyaW5nKToge3Rva2VuczogVG9rZW5bXSwgY29tbWVudHM6IENvbW1lbnRbXSwgZW9mOiBQb3N9ID0+IHtcbiAgbGV0IHRva2VuczogVG9rZW5bXSA9IFtdXG4gIGxldCBjb21tZW50czogQ29tbWVudFtdID0gW11cbiAgbGV0IGkgPSAwXG4gIGxldCBsaW5lID0gMVxuICBsZXQgY29sID0gMVxuXG4gIGxldCBpc0FscGhhID0gKGNoYXI6IHN0cmluZykgPT4gL1tBLVphLXpfXS8udGVzdChjaGFyKVxuICBsZXQgaXNEaWdpdCA9IChjaGFyOiBzdHJpbmcpID0+IC9bMC05XS8udGVzdChjaGFyKVxuICBsZXQgaXNJZGVudCA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16MC05X10vLnRlc3QoY2hhcilcbiAgbGV0IHBvcyA9ICgpOiBQb3MgPT4gKHtvZmZzZXQ6IGksIGxpbmUsIGNvbH0pXG4gIGxldCBhZHZhbmNlID0gKCkgPT4ge1xuICAgIGlmIChjb2RlW2ldID09PSBcIlxcblwiKSB7XG4gICAgICBpKytcbiAgICAgIGxpbmUrK1xuICAgICAgY29sID0gMVxuICAgIH0gZWxzZSB7XG4gICAgICBpKytcbiAgICAgIGNvbCsrXG4gICAgfVxuICB9XG4gIGxldCBwdXNoID0gKHRva2VuOiBUb2tlbk5vU3Bhbiwgc3RhcnQ6IFBvcykgPT4ge1xuICAgIHRva2Vucy5wdXNoKHsuLi50b2tlbiwgc3Bhbjoge3N0YXJ0LCBlbmQ6IHBvcygpfX0gYXMgVG9rZW4pXG4gIH1cblxuICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgbGV0IGNoYXIgPSBjb2RlW2ldXG5cbiAgICBpZiAoL1xccy8udGVzdChjaGFyKSkge1xuICAgICAgYWR2YW5jZSgpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIi9cIiAmJiBjb2RlW2kgKyAxXSA9PT0gXCIvXCIpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBjb2RlW2ldICE9PSBcIlxcblwiKSBhZHZhbmNlKClcbiAgICAgIGNvbW1lbnRzLnB1c2gobWtBc3QoXCJjb21tZW50XCIsIGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKSwge3N0YXJ0LCBlbmQ6IHBvcygpfSkpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIj1cIiAmJiBjb2RlW2kgKyAxXSA9PT0gXCI+XCIpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJhcnJvd1wifSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChcIigpe309LDpcIi5pbmNsdWRlcyhjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZSA9IGNoYXIgYXMgXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCJcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09ICdcIicpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIGxldCB2YWx1ZSA9IFwiXCJcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGgpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBjb2RlW2ldXG4gICAgICAgIGlmIChjdXJyZW50ID09PSBcIlxcXFxcIikge1xuICAgICAgICAgIGxldCBuZXh0ID0gY29kZVtpICsgMV1cbiAgICAgICAgICBpZiAobmV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGVzY2FwZVwiLCBjb250ZW50OiBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSl9LCBzdGFydClcbiAgICAgICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGVzY2FwZWQgPSAoe246IFwiXFxuXCIsIHI6IFwiXFxyXCIsIHQ6IFwiXFx0XCIsICdcIic6ICdcIicsIFwiXFxcXFwiOiBcIlxcXFxcIn0gYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPilbbmV4dF1cbiAgICAgICAgICB2YWx1ZSArPSBlc2NhcGVkID8/IG5leHRcbiAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICBhZHZhbmNlKClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJyZW50ID09PSAnXCInKSBicmVha1xuICAgICAgICB2YWx1ZSArPSBjdXJyZW50XG4gICAgICAgIGFkdmFuY2UoKVxuICAgICAgfVxuICAgICAgaWYgKGNvZGVbaV0gIT09ICdcIicpIHtcbiAgICAgICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVudGVybWluYXRlZCBzdHJpbmcgbGl0ZXJhbFwiLCBjb250ZW50OiBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSl9LCBzdGFydClcbiAgICAgICAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxuICAgICAgfVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcInN0cmluZ1wiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoaXNEaWdpdChjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZVN0YXJ0ID0gaVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBpc0RpZ2l0KGNvZGVbaV0pKSBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBOdW1iZXIoY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKSl9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzQWxwaGEoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNJZGVudChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBjb2RlLnNsaWNlKHZhbHVlU3RhcnQsIGkpXG4gICAgICBpZiAodmFsdWUgPT09IFwibGV0XCIgfHwgdmFsdWUgPT09IFwiaW5cIiB8fCB2YWx1ZSA9PT0gXCJmblwiKSBwdXNoKHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGVsc2UgcHVzaCh7dHlwZTogXCJpZGVudFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgIGFkdmFuY2UoKVxuICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogYFVuZXhwZWN0ZWQgY2hhcmFjdGVyOiAke2NoYXJ9YCwgY29udGVudDogY2hhcn0sIHN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxufVxuXG5jbGFzcyBQYXJzZXIge1xuICBwcml2YXRlIGkgPSAwXG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSB0b2tlbnM6IFRva2VuW10sIHByaXZhdGUgc291cmNlOiBzdHJpbmcsIHByaXZhdGUgZW9mOiBQb3MpIHt9XG5cbiAgcGFyc2UoKTogQVNUIHtcbiAgICBsZXQgYXN0ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIGlmICh0aGlzLnBlZWsoKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5wZWVrKCkhLnNwYW4uc3RhcnRcbiAgICAgIGxldCBlbmQgPSB0aGlzLnRva2Vuc1t0aGlzLnRva2Vucy5sZW5ndGggLSAxXT8uc3Bhbi5lbmQgPz8gc3RhcnRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVuZXhwZWN0ZWQgZXh0cmEgaW5wdXQgYWZ0ZXIgZXhwcmVzc2lvblwiLCB7c3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgfVxuICAgIHJldHVybiBhc3RcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VFeHByKCk6IEFTVCB7XG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwibGV0XCIpKSByZXR1cm4gdGhpcy5wYXJzZUxldCgpXG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwiZm5cIikpIHJldHVybiB0aGlzLnBhcnNlRnVuY3Rpb24oKVxuICAgIHJldHVybiB0aGlzLnBhcnNlQXRvbSgpXG4gIH1cblxuICBwcml2YXRlIHBhcnNlTGV0KCk6IEFTVCB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5leHBlY3RLZXl3b3JkKFwibGV0XCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyaWFibGUgPSB0aGlzLnBhcnNlTGV0QmluZGVyKClcbiAgICBpZiAodmFyaWFibGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gdmFyaWFibGVcblxuICAgIGxldCB2YWx1ZTogQVNUXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI9XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIj1cIilcbiAgICAgIHZhbHVlID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIilcbiAgICB9XG5cbiAgICBsZXQgYm9keTogQVNUXG4gICAgaWYgKHRoaXMuaXNLZXl3b3JkKFwiaW5cIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0S2V5d29yZChcImluXCIpXG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkIGtleXdvcmQgaW4gYWZ0ZXIgbGV0IGJpbmRpbmdcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGtleXdvcmQgaW4gYWZ0ZXIgbGV0IGJpbmRpbmdcIilcbiAgICB9XG5cbiAgICByZXR1cm4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdmFyaWFibGUsIHZhbHVlLCBib2R5fSwge3N0YXJ0LCBlbmQ6IGJvZHkuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUZ1bmN0aW9uKCk6IEFTVCB7XG4gICAgbGV0IHN0YXJ0ID0gdGhpcy5leHBlY3RLZXl3b3JkKFwiZm5cIikuc3Bhbi5zdGFydFxuICAgIGxldCB2YXJzOiBWYXJbXSA9IFtdXG4gICAgd2hpbGUgKHRoaXMucGVlaygpPy50eXBlID09PSBcImlkZW50XCIgfHwgdGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIGxldCBiaW5kZXIgPSB0aGlzLnBhcnNlQmluZGVyKClcbiAgICAgIGlmIChiaW5kZXIuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keTogYmluZGVyfSwge3N0YXJ0LCBlbmQ6IGJpbmRlci5zcGFuLmVuZH0pXG4gICAgICB2YXJzLnB1c2goYmluZGVyKVxuICAgIH1cbiAgICBsZXQgYm9keTogQVNUXG4gICAgaWYgKHZhcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBpZiAodGhpcy5tYXRjaFRva2VuKFwiYXJyb3dcIikpIGJvZHkgPSB0aGlzLndyYXBFcnJvcihcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgdGhpcy5wYXJzZUV4cHIoKSlcbiAgICAgIGVsc2UgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHN0YXJ0KVxuICAgIH0gZWxzZSBpZiAoIXRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSB7XG4gICAgICBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJz0+JyBhZnRlciBmdW5jdGlvbiBwYXJhbWV0ZXJzXCIpXG4gICAgfSBlbHNlIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfVxuICAgIHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzLCBib2R5fSwge3N0YXJ0LCBlbmQ6IGJvZHkuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0b20oKTogQVNUIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4pIHJldHVybiB0aGlzLmVycm9ySGVyZShcIlVuZXhwZWN0ZWQgZW5kIG9mIGlucHV0XCIpXG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJpZGVudFwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwidmFyXCIsIHtuYW1lOiB0b2tlbi52YWx1ZX0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcIm51bWJlclwiLCB0b2tlbi52YWx1ZSwgdG9rZW4uc3BhbilcbiAgICB9XG5cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInN0cmluZ1wiLCB0b2tlbi52YWx1ZSwgdG9rZW4uc3BhbilcbiAgICB9XG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiZXJyb3JcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiB0b2tlbi5tZXNzYWdlLCBjb250ZW50OiB0b2tlbi5jb250ZW50fSwgdG9rZW4uc3BhbilcbiAgICB9XG5cbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHJldHVybiB0aGlzLnBhcnNlUGFyZW5zKClcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIntcIikpIHJldHVybiB0aGlzLnBhcnNlUmVjb3JkKClcblxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBVbmV4cGVjdGVkIHRva2VuOiAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWAsIHRva2VuLnNwYW4pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUGFyZW5zKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIihcIilcbiAgICBsZXQgaXRlbXM6IEFTVFtdID0gW11cbiAgICB3aGlsZSAoIXRoaXMuaXNTeW1ib2woXCIpXCIpKSB7XG4gICAgICBpZiAoIXRoaXMucGVlaygpKSB7XG4gICAgICAgIGxldCBlbmQgPSBpdGVtcy5sZW5ndGggPiAwID8gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgaXRlbXMucHVzaCh0aGlzLnBhcnNlRXhwcigpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJFbXB0eSBwYXJlbnRoZXNlcyBhcmUgbm90IGFsbG93ZWRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBjbG9zZS5zcGFuLmVuZC5vZmZzZXQpKVxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDEpIHJldHVybiBpdGVtc1swXVxuICAgIHJldHVybiBta0FzdChcImFwcFwiLCB7Zm46IGl0ZW1zWzBdLCBhcmdzOiBpdGVtcy5zbGljZSgxKX0sIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VSZWNvcmQoKTogQVNUIHtcbiAgICBsZXQgb3BlbiA9IHRoaXMuZXhwZWN0U3ltYm9sKFwie1wiKVxuICAgIGxldCBmaWVsZHM6IFtWYXIsIEFTVF1bXSA9IFtdXG5cbiAgICB3aGlsZSAoIXRoaXMuaXNTeW1ib2woXCJ9XCIpKSB7XG4gICAgICBpZiAoIXRoaXMucGVlaygpKSB7XG4gICAgICAgIGxldCBlbmQgPSBmaWVsZHMubGVuZ3RoID4gMCA/IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV1bMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgICAgaWYgKCFuYW1lKSB7XG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpIVxuICAgICAgICB0aGlzLmkrK1xuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoYEV4cGVjdGVkIHJlY29yZCBmaWVsZCBuYW1lLCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiB0b2tlbi5zcGFuLmVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIHRva2VuLnNwYW4uZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBsZXQga2V5ID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgICBsZXQgdmFsdWUgPSB0aGlzLmlzU3ltYm9sKFwiOlwiKVxuICAgICAgICA/ICh0aGlzLmV4cGVjdFN5bWJvbChcIjpcIiksIHRoaXMuaXNTeW1ib2woXCJ9XCIpID8gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCByZWNvcmQgZmllbGQgdmFsdWUgYWZ0ZXIgJzonXCIpIDogdGhpcy5wYXJzZUV4cHIoKSlcbiAgICAgICAgOiBrZXlcbiAgICAgIGZpZWxkcy5wdXNoKFtrZXksIHZhbHVlXSlcbiAgICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiLFwiKSkgdGhpcy5pKytcbiAgICAgIGVsc2UgYnJlYWtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNTeW1ib2woXCJ9XCIpKSB7XG4gICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHJlY29yZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgfVxuICAgIGxldCBjbG9zZSA9IHRoaXMuZXhwZWN0U3ltYm9sKFwifVwiKVxuICAgIHJldHVybiBta0FzdChcInJlY29yZFwiLCBmaWVsZHMsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiKFwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgICBsZXQgZGVjbGFyZWRUeXBlID0gdGhpcy5wYXJzZUF0b20oKVxuICAgICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyIGluIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICBpZiAoIXRoaXMuaXNTeW1ib2woXCIpXCIpKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnKScgYWZ0ZXIgYmluZGVyIHBhdHRlcm5cIilcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKVwiKVxuICAgICAgaWYgKGRlY2xhcmVkVHlwZS4kID09PSBcImVycm9yXCIpIHJldHVybiBkZWNsYXJlZFR5cGVcbiAgICAgIGxldCB2YXJpYWJsZSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgICAgcmV0dXJuIHZhcmlhYmxlXG4gICAgfVxuICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICBpZiAoIW5hbWUpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGlkZW50aWZpZXJcIilcbiAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIjpcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiOlwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICB2YXJpYWJsZS50eXBlID0gZGVjbGFyZWRUeXBlXG4gICAgfVxuICAgIHJldHVybiB2YXJpYWJsZVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldEJpbmRlcigpOiBWYXIgfCBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PiB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VCaW5kZXIoKVxuICB9XG5cbiAgcHJpdmF0ZSBwZWVrKCk6IFRva2VuIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbnNbdGhpcy5pXVxuICB9XG5cbiAgcHJpdmF0ZSBpc0tleXdvcmQodmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJrZXl3b3JkXCIgJiYgdG9rZW4udmFsdWUgPT09IHZhbHVlXG4gIH1cblxuICBwcml2YXRlIGlzU3ltYm9sKHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIik6IGJvb2xlYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgcmV0dXJuIHRva2VuPy50eXBlID09PSBcInN5bWJvbFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RUb2tlbjxLIGV4dGVuZHMgVG9rZW5bXCJ0eXBlXCJdPih0eXBlOiBLKTogRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuIHx8IHRva2VuLnR5cGUgIT09IHR5cGUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHt0eXBlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlbiBhcyBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+XG4gIH1cblxuICBwcml2YXRlIG1hdGNoVG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4gfCB1bmRlZmluZWQge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwia2V5d29yZFwiIHx8IHRva2VuLnZhbHVlICE9PSB2YWx1ZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBrZXl3b3JkICR7dmFsdWV9LCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuXG4gIH1cblxuICBwcml2YXRlIGV4cGVjdFN5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbj8udHlwZSAhPT0gXCJzeW1ib2xcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJyR7dmFsdWV9JywgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBkZXNjcmliZSh0b2tlbjogVG9rZW4gfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICAgIGlmICghdG9rZW4pIHJldHVybiBcImVuZCBvZiBpbnB1dFwiXG4gICAgaWYgKFwidmFsdWVcIiBpbiB0b2tlbikgcmV0dXJuIGAke3Rva2VuLnR5cGV9KCR7U3RyaW5nKHRva2VuLnZhbHVlKX0pYFxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHJldHVybiBgZXJyb3IoJHt0b2tlbi5tZXNzYWdlfSlgXG4gICAgcmV0dXJuIHRva2VuLnR5cGVcbiAgfVxuXG4gIHByaXZhdGUgZXJyb3JOb2RlKG1lc3NhZ2U6IHN0cmluZywgc3Bhbj86IFNwYW4sIGNvbnRlbnQ/OiBzdHJpbmcpOiBFcnJvck5vZGUge1xuICAgIGxldCBmaW5hbFNwYW4gPSBzcGFuID8/IHRoaXMucG9pbnRTcGFuKClcbiAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZSwgY29udGVudDogY29udGVudCA/PyB0aGlzLnNvdXJjZS5zbGljZShmaW5hbFNwYW4uc3RhcnQub2Zmc2V0LCBmaW5hbFNwYW4uZW5kLm9mZnNldCl9LCBmaW5hbFNwYW4pXG4gIH1cblxuICBwcml2YXRlIGVycm9ySGVyZShtZXNzYWdlOiBzdHJpbmcsIHN0YXJ0PzogUG9zKTpFcnJvck5vZGUge1xuICAgIGxldCBzcGFuID0gdGhpcy5wZWVrKCk/LnNwYW4gPz8ge3N0YXJ0OiB0aGlzLmVvZiwgZW5kOiB0aGlzLmVvZn1cbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUobWVzc2FnZSwge3N0YXJ0OiBzdGFydCA/PyBzcGFuLnN0YXJ0LCBlbmQ6IHNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgd3JhcEVycm9yKG1lc3NhZ2U6IHN0cmluZywgbm9kZTogQVNUKTogQVNUIHtcbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUobWVzc2FnZSwgbm9kZS5zcGFuLCB0aGlzLnNvdXJjZS5zbGljZShub2RlLnNwYW4uc3RhcnQub2Zmc2V0LCBub2RlLnNwYW4uZW5kLm9mZnNldCkpXG4gIH1cblxuICBwcml2YXRlIHBvaW50U3BhbigpOiBTcGFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbikgcmV0dXJuIHRva2VuLnNwYW5cbiAgICByZXR1cm4ge3N0YXJ0OiB0aGlzLmVvZiwgZW5kOiB0aGlzLmVvZn1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgYnVpbGRBc3RNYXAgPSAoYXN0OiBBU1QsIGNvbW1lbnRzOiBDb21tZW50W10gPSBbXSk6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0+IHtcbiAgbGV0IG1heEVuZCA9IGNvbW1lbnRzLnJlZHVjZSgobSwgYykgPT4gYy5zcGFuLmVuZC5vZmZzZXQgPiBtID8gYy5zcGFuLmVuZC5vZmZzZXQgOiBtLCBhc3Quc3Bhbi5lbmQub2Zmc2V0KVxuICBsZXQgcmVzOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IEFycmF5LmZyb20oe2xlbmd0aDogbWF4RW5kfSwgKCk9PnVuZGVmaW5lZClcbiAgY29uc3Qgd2FsayA9IChub2RlOiBBU1QpID0+IHtcbiAgICBmb3IgKGxldCBpID0gbm9kZS5zcGFuLnN0YXJ0Lm9mZnNldDsgaSA8IG5vZGUuc3Bhbi5lbmQub2Zmc2V0OyBpKyspIHJlc1tpXSA9IG5vZGVcbiAgICBjaGlsZHJlbihub2RlKS5mb3JFYWNoKHdhbGspXG4gIH1cbiAgd2Fsayhhc3QpXG4gIGNvbW1lbnRzLmZvckVhY2goY29tbWVudCA9PiB7XG4gICAgZm9yIChsZXQgaSA9IGNvbW1lbnQuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBjb21tZW50LnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBjb21tZW50XG4gIH0pXG4gIHJldHVybiByZXNcbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGNvZGU6c3RyaW5nKTogUGFyc2VSZXN1bHQgPT4ge1xuICBsZXQge3Rva2VucywgY29tbWVudHMsIGVvZn0gPSB0b2tlbml6ZShjb2RlKVxuICBsZXQgYXN0ID0gbmV3IFBhcnNlcih0b2tlbnMsIGNvZGUsIGVvZikucGFyc2UoKVxuICByZXR1cm4ge2FzdCwgY29tbWVudHMsIGFzdG1hcDogYnVpbGRBc3RNYXAoYXN0LCBjb21tZW50cyl9XG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZUFTVCA9IChjb2RlOnN0cmluZyk6IEFTVCA9PiBwYXJzZShjb2RlKS5hc3RcblxuZXhwb3J0IGNvbnN0IGNoaWxkcmVuID0gKG5vZGU6IEFTVCk6IEFTVFtdID0+IHtcbiAgaWYgKG5vZGUuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gWy4uLm5vZGUuY29udGVudC52YXJzLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJhcHBcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQuZm4sIC4uLm5vZGUuY29udGVudC5hcmdzXVxuICBpZiAobm9kZS4kID09PSBcImxldFwiKSByZXR1cm4gW25vZGUuY29udGVudC52YXIsIG5vZGUuY29udGVudC52YWx1ZSwgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwicmVjb3JkXCIpIHJldHVybiBub2RlLmNvbnRlbnQuZmxhdE1hcCgoW2tleSwgdmFsdWVdKSA9PiBba2V5LCB2YWx1ZV0pXG4gIHJldHVybiBbXVxufVxuXG5jb25zdCBzdHJpcFNwYW5zID0gKGFzdDogQVNUKTogdW5rbm93biA9PiB7XG4gIGlmIChhc3QuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyczogYXN0LmNvbnRlbnQudmFycy5tYXAoc3RyaXBTcGFucyksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwiYXBwXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHtmbjogc3RyaXBTcGFucyhhc3QuY29udGVudC5mbiksIGFyZ3M6IGFzdC5jb250ZW50LmFyZ3MubWFwKHN0cmlwU3BhbnMpfX1cbiAgaWYgKGFzdC4kID09PSBcImxldFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhciksIHZhbHVlOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhbHVlKSwgYm9keTogc3RyaXBTcGFucyhhc3QuY29udGVudC5ib2R5KX19XG4gIGlmIChhc3QuJCA9PT0gXCJyZWNvcmRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnQubWFwKChbbmFtZSwgdmFsdWVdKSA9PiBbc3RyaXBTcGFucyhuYW1lKSwgc3RyaXBTcGFucyh2YWx1ZSldKX1cbiAgaWYgKGFzdC4kID09PSBcImVycm9yXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50fVxuICByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbn1cblxuXG5sZXQgc3RyaW5naWZ5ID0gKHg6IHVua25vd24pID0+IEpTT04uc3RyaW5naWZ5KHgsIG51bGwsIDIpXG5cbmNvbnN0IHRlc3RfcGFyc2UgPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogQVNUKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuXG4gIGlmIChKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpICE9PSBKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGV4cGVjdGVkKSkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIHN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpKVxuICAgIHRocm93IG5ldyBFcnJvcihgVGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmNvbnN0IHRlc3Rfc3BhbiA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBTcGFuKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuICBpZiAoSlNPTi5zdHJpbmdpZnkoYXN0LnNwYW4pICE9PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZCkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTpcIiwgY29kZSlcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIGV4cGVjdGVkKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIGFzdC5zcGFuKVxuICAgIHRocm93IG5ldyBFcnJvcihgU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTogJHtjb2RlfWApXG4gIH1cbn1cblxuZXhwb3J0IGxldCBta251bSA9IChuOiBudW1iZXIpID0+IG1rQXN0KFwibnVtYmVyXCIsIG4pXG5leHBvcnQgbGV0IG1rc3RyID0gKHM6IHN0cmluZykgPT4gbWtBc3QoXCJzdHJpbmdcIiwgcylcbmV4cG9ydCBsZXQgbWt2YXIgPSAobmFtZTogc3RyaW5nKSA9PiBta0FzdChcInZhclwiLCB7bmFtZX0pXG5leHBvcnQgbGV0IG1rYXBwID0gKGZuOiBBU1QsIGFyZ3M6IEFTVFtdKSA9PiBta0FzdChcImFwcFwiLCB7Zm4sIGFyZ3N9KVxuZXhwb3J0IGxldCBta2xldCA9ICh2OiBzdHJpbmcgfCBWYXIsIHZhbHVlOiBBU1QsIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYsIHZhbHVlLCBib2R5fSlcbmV4cG9ydCBsZXQgbWtmdW4gPSAodmFyczogKHN0cmluZyB8IFZhcilbXSwgYm9keTogQVNUKSA9PiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzOiB2YXJzLm1hcCh2ID0+IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2KSwgYm9keX0pIGFzIEZ1bmNcbmV4cG9ydCBsZXQgYW5ub3QgPSAodHlwZTogQVNULCB2YWx1ZTogQVNUKSA9PiBta0FzdChcImFubm90XCIsIHt0eXBlLCB2YWx1ZX0pXG5leHBvcnQgbGV0IG1rcmVjb3JkID0gKGZpZWxkczoge1trZXkgOiBzdHJpbmddIDogQVNUfSkgPT4gbWtBc3QoXCJyZWNvcmRcIiwgT2JqZWN0LmVudHJpZXMoZmllbGRzKS5tYXAoKFtrLHZdKT0+IFtta3ZhcihrKSwgdl0pKVxuXG5PYmplY3QuZW50cmllcyh7XG4gIFwieFwiOiBta3ZhcihcInhcIiksXG4gIFwiMjJcIjogbWtudW0oMjIpLFxuICAnXCJoZWxsb1wiJzogbWtzdHIoXCJoZWxsb1wiKSxcbiAgXCIoZiB4KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIildKSxcbiAgXCIoZiB4IHkpXCI6IG1rYXBwKG1rdmFyKFwiZlwiKSwgW21rdmFyKFwieFwiKSwgbWt2YXIoXCJ5XCIpXSksXG4gIFwibGV0IHggPSAyMiBpbiB4XCI6IG1rbGV0KFwieFwiLCBta251bSgyMiksIG1rdmFyKFwieFwiKSksXG4gIFwie2E6IDIyLCBiOiB4fVwiOiBta3JlY29yZCh7YTogbWtudW0oMjIpLCBiOiBta3ZhcihcInhcIil9KSxcbiAgXCJmbiB4ID0+IHhcIjogbWtmdW4oW1wieFwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiB4IHkgPT4geFwiOiBta2Z1bihbXCJ4XCIsIFwieVwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJsZXQgKG51bWJlciB4KSA9IDIyIGluIHhcIjogbWtsZXQoT2JqZWN0LmFzc2lnbihta3ZhcihcInhcIiksIHt0eXBlOiBta3ZhcihcIm51bWJlclwiKX0pLCBta251bSgyMiksIG1rdmFyKFwieFwiKSksXG4gIFwiZm4gKG51bWJlciB4KSAoc3RyaW5nIHkpID0+IHhcIjogbWtmdW4oW1xuICAgIE9iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KSxcbiAgICBPYmplY3QuYXNzaWduKG1rdmFyKFwieVwiKSwge3R5cGU6IG1rdmFyKFwic3RyaW5nXCIpfSksXG4gIF0sIG1rdmFyKFwieFwiKSksXG4gIFwie2U6MjJ9XCIgOiBta3JlY29yZCh7ZTogbWtudW0oMjIpfSksXG4gIFwie2V9XCI6IG1rcmVjb3JkKHtlOiBta3ZhcihcImVcIil9KSxcbiAgXCIvL2NvbW1lbnRcXG4yMlwiOiBwYXJzZUFTVChcIjIyXCIpLFxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG5PYmplY3QuZW50cmllcyh7XG4gIFwiKFwiOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIlVudGVybWluYXRlZCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIiwgY29udGVudDogXCIoXCJ9KSxcbiAgXCJsZXQgeCAyMiBpbiB4XCI6IG1rQXN0KFwibGV0XCIsIHtcbiAgICB2YXI6IG1rdmFyKFwieFwiKSxcbiAgICB2YWx1ZTogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiLCBjb250ZW50OiBcIjIyXCJ9KSxcbiAgICBib2R5OiBta3ZhcihcInhcIiksXG4gIH0pLFxuICBcIntlOn1cIjogbWtyZWNvcmQoe2U6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiLCBjb250ZW50OiBcIn1cIn0pfSksXG5cbn0pLmZvckVhY2goKFtjb2RlLCBleHBlY3RlZF0pID0+IHRlc3RfcGFyc2UoY29kZSwgZXhwZWN0ZWQgYXMgQVNUKSlcblxudGVzdF9zcGFuKFwibGV0IHggPSAyMlxcbmluIHhcIiwge1xuICBzdGFydDoge29mZnNldDogMCwgbGluZTogMSwgY29sOiAxfSxcbiAgZW5kOiB7b2Zmc2V0OiAxNSwgbGluZTogMiwgY29sOiA1fSxcbn0pXG4iLAogICAgImltcG9ydCB7IEFTVCwgVmFyIH0gZnJvbSBcIi4vcGFyc2VyXCJcbmltcG9ydCB7Y2hpbGRyZW59IGZyb20gXCIuL3BhcnNlclwiXG5cblxuZXhwb3J0IGNvbnN0IGdldGRlZiA9IChyb290OiBBU1QsIHZhcmk6IFZhcik6IEFTVCB8IHVuZGVmaW5lZCA9PiB7XG4gIGlmIChyb290LnNwYW4uc3RhcnQub2Zmc2V0ID4gdmFyaS5zcGFuLnN0YXJ0Lm9mZnNldCB8fCByb290LnNwYW4uZW5kLm9mZnNldCA8IHZhcmkuc3Bhbi5lbmQub2Zmc2V0KSByZXR1cm4gdW5kZWZpbmVkXG4gIGZvciAobGV0IGNoaWxkIG9mIGNoaWxkcmVuKHJvb3QpKXtcbiAgICBsZXQgcmVzID0gZ2V0ZGVmKGNoaWxkLCB2YXJpKVxuICAgIGlmIChyZXMpIHJldHVybiByZXNcbiAgfVxuXG4gIGlmIChyb290LiQgPT09IFwibGV0XCIgJiYgcm9vdC5jb250ZW50LnZhci5jb250ZW50Lm5hbWUgPT09IHZhcmkuY29udGVudC5uYW1lKVxuICAgIHJldHVybiByb290LmNvbnRlbnQudmFyXG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJmdW5jdGlvblwiKVxuICAgIGZvciAobGV0IHYgb2Ygcm9vdC5jb250ZW50LnZhcnMpXG4gICAgICBpZiAodi5jb250ZW50Lm5hbWUgPT09IHZhcmkuY29udGVudC5uYW1lKVxuICAgICAgICByZXR1cm4gdlxufVxuIiwKICAgICJcbmltcG9ydCB7IGJvZHksIGNvbG9yLCBkaXYsIHRhYmxlLCB0ZCwgdHIgfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7bWtudW0sIFRhZywgdHlwZSBBU1R9IGZyb20gXCIuL3BhcnNlclwiXG5pbXBvcnQge3BhcnNlLCBwcmV0dHlBU1QsIG1rQXN0LCBta3ZhciwgbWthcHAsIG1rZnVuLCBta2xldCwgVmFyfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5sZXQgYW5ub3QgPSAoYXN0OiBBU1QsIHR5cGU6IEFTVCk6IEFTVCAmIHt0eXBlOiBBU1R9ID0+IHtcbiAgaWYgKGFzdC50eXBlICYmIHByZXR0eUFTVChhc3QudHlwZSkgIT0gcHJldHR5QVNUKHR5cGUpKSB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkICR7cHJldHR5QVNUKHR5cGUpfSwgZ290ICR7cHJldHR5QVNUKGFzdC50eXBlKX1gKVxuICBhc3QudHlwZSA9IHR5cGVcbiAgcmV0dXJuIGFzdCBhcyBBU1QgJiB7dHlwZTogQVNUfVxuXG59XG5cbmV4cG9ydCBsZXQgTlVNQkVSIDogQVNUID0gbWt2YXIoXCJudW1iZXJcIilcbmV4cG9ydCBsZXQgU1RSSU5HIDogQVNUID0gbWt2YXIoXCJzdHJpbmdcIilcbmV4cG9ydCBsZXQgVFlQRSA6IEFTVCA9IG1rdmFyKFwidHlwZVwiKVxuZXhwb3J0IGxldCBUWVBFT0Y6IEFTVCA9IG1rdmFyKFwidHlwZW9mXCIpXG5cbk5VTUJFUi50eXBlID0gVFlQRVxuU1RSSU5HLnR5cGUgPSBUWVBFXG5UWVBFLnR5cGUgPSBUWVBFXG5UWVBFT0YudHlwZSA9IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0IVxuXG5cbmV4cG9ydCBsZXQgQU5ZIDogQVNUID0gbWt2YXIoXCJhbnlcIilcblxuXG5sZXQgcHJpbWl0aXZlVHlwZSA9IChuYW1lOiBzdHJpbmcpID0+ICh7XG4gIHR5cGU6IFRZUEUsXG4gIGltcGw6ICh4OiBBU1QpID0+IHtcbiAgICBpZiAoeC50eXBlKSB7XG4gICAgICBpZiAoeC50eXBlLiQgPT0gXCJ2YXJcIiAmJiB4LnR5cGUuY29udGVudC5uYW1lID09IG5hbWUpIHJldHVybiB4XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkICR7bmFtZX0sIGdvdCAke3ByZXR0eUFTVCh4LnR5cGUpfWApXG5cblxuICAgIH1cblxuICAgIHJldHVybiBhbm5vdCh4LCBta3ZhcihuYW1lKSlcbiAgICAvLyBpZiAoeC4kID09IFwidmFyXCIpICBhbm5vdCh4LCBta3ZhcihuYW1lKSlcbiAgICAvLyBlbHNlIGlmICh4LiQgPT0gbmFtZSkgcmV0dXJuIGFubm90KHgsIG1rdmFyKG5hbWUpKVxuXG4gICAgLy8gdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yOiBleHBlY3RlZCAke25hbWV9LCBnb3QgJHtwcmV0dHlBU1QoeCl9YClcbiAgfVxufSlcblxubGV0IGJ1aWx0aW5zOiBSZWNvcmQ8c3RyaW5nLCB7IHR5cGU6IEFTVCwgaW1wbDogKC4uLmFyZ3M6QVNUW10pID0+IEFTVCB9PiA9IHtcbiAgbnVtYmVyOiBwcmltaXRpdmVUeXBlKFwibnVtYmVyXCIpLFxuICBzdHJpbmc6IHByaW1pdGl2ZVR5cGUoXCJzdHJpbmdcIiksXG4gIFwiZXFcIjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4IHkgPT4gKG51bWJlciAoZiB4IHkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IG1rbnVtKFxuICAgICAgKHguJCA9PSBcIm51bWJlclwiICYmIHkuJCA9PSBcIm51bWJlclwiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8XG4gICAgICAoeC4kID09IFwic3RyaW5nXCIgJiYgeS4kID09IFwic3RyaW5nXCIgJiYgeC5jb250ZW50ID09IHkuY29udGVudCkgfHwgKHggPT0geSlcbiAgICAgID8gMSA6IDApXG4gIH0sXG4gIFwiYWRkXCI6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGY9PiBmbiB4IHkgPT4gKG51bWJlciAoZiAobnVtYmVyIHgpIChudW1iZXIgeSkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IHtcbiAgICAgIGlmICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIikgcmV0dXJuIG1rbnVtKHguY29udGVudCArIHkuY29udGVudClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBhZGQ6IGV4cGVjdGVkIG51bWJlcnMsIGdvdCAke3ByZXR0eUFTVCh4KX0gYW5kICR7cHJldHR5QVNUKHkpfWApXG4gICAgfVxuICB9LFxuICBcImlmZWxzZVwiIDoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiBUIGNvbmQgdGhlbiBlbHNlID0+IChUIChmIChudW1iZXIgY29uZCkgKFQgdGhlbikgKFQgZWxzZSkpKVwiKS5hc3QhLFxuICAgIGltcGw6IChjb25kLCB0aGVuLCBlbHMpID0+IHtcbiAgICAgIGxldCB2YWwgPSBjb25kLiQgPT0gXCJudW1iZXJcIiA/IGNvbmQuY29udGVudCA6IGNvbmQuJCA9PSBcInN0cmluZ1wiID8gY29uZC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgIHJldHVybiB2YWwgPyB0aGVuIDogZWxzXG4gICAgfVxuICB9LFxuICBcInR5cGVvZlwiOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIHggPT4gKHR5cGUgKGYgeCkpXCIpLmFzdCEsXG4gICAgaW1wbDogKHgpID0+IHtcbiAgICAgIGlmICgheC50eXBlKSByZXR1cm4gbWthcHAoVFlQRU9GLCBbeF0pXG4gICAgICByZXR1cm4geC50eXBlXG4gICAgfVxuICB9XG59XG5leHBvcnQgdHlwZSBFbnYgPSB7YmluZGVyOiBWYXIsIHZhbHVlOiBBU1QsIG5leHQ6IEVudn0gfCBudWxsXG5cbmxldCBwcmV0dHlFbnYgPSAoZW52OiBFbnYpOiBzdHJpbmcgPT4ge1xuICBpZiAoIWVudikgcmV0dXJuIFwie31cIlxuICByZXR1cm4gYHske2Vudi5iaW5kZXIuY29udGVudC5uYW1lfSA6ICR7cHJldHR5QVNUKGVudi52YWx1ZS50eXBlID8/IEFOWSl9ID0gJHtwcmV0dHlBU1QoZW52LnZhbHVlKX19IC0+IGAgKyBwcmV0dHlFbnYoZW52Lm5leHQpXG59XG5cbmV4cG9ydCBjb25zdCBydW4gPSAoYXN0OiBBU1QpOiBBU1QgPT4ge1xuXG4gIGxldCBsb29rdXAgPSAobmFtZTogc3RyaW5nLCBlbnY6IEVudik6IEVudiA9PiB7XG4gICAgaWYgKCFlbnYpIHJldHVybiBudWxsXG4gICAgaWYgKGVudi5iaW5kZXIuY29udGVudC5uYW1lID09PSBuYW1lKSByZXR1cm4gZW52XG4gICAgcmV0dXJuIGxvb2t1cChuYW1lLCBlbnYubmV4dClcbiAgfVxuXG4gIGxldCBmcmVlbmFtZSA9IChlbnY6RW52KTpzdHJpbmc9PntcbiAgICBsZXQgbiA9IDBcbiAgICB3aGlsZShsb29rdXAoYHgke259YCwgZW52KSkgbisrXG4gICAgcmV0dXJuIGB4JHtufWBcbiAgfVxuICBsZXQgYmluZCA9IChlbnY6IEVudiwgYmluZGVyOiBWYXIsIHZhbHVlOiBBU1QpOiBFbnYgPT4gKHtiaW5kZXIsIHZhbHVlLCBuZXh0OiBlbnZ9KVxuICBsZXQgYmluZFZhbHVlID0gKGVudjogRW52LCBiaW5kZXI6IFZhciwgdmFsdWU6IEFTVCwgaW5mZXIgPSBmYWxzZSk6IEVudiA9PiB7XG5cbiAgICBpZiAoYmluZGVyLnR5cGUpXG4gICAgICBpZiAodmFsdWUudHlwZSAmJiBwcmV0dHlBU1QoYmluZGVyLnR5cGUpICE9IHByZXR0eUFTVCh2YWx1ZS50eXBlISkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBsZXQ6IGV4cGVjdGVkICR7cHJldHR5QVNUKGJpbmRlci50eXBlKX0sIGdvdCAke3ByZXR0eUFTVCh2YWx1ZS50eXBlISl9YClcbiAgICBlbHNlIGJpbmRlci50eXBlID0gdmFsdWUudHlwZVxuICAgIHJldHVybiBiaW5kKGVudiwgYmluZGVyLCB2YWx1ZSlcblxuICB9XG5cbiAgY29uc3QgZ28gPSAoYXN0OiBBU1QsIGVudjogRW52KTogQVNUID0+IHtcbiAgICBzd2l0Y2goYXN0LiQpe1xuICAgICAgY2FzZSBcIm51bWJlclwiOiB7XG4gICAgICAgIGFzdC50eXBlID0gTlVNQkVSXG4gICAgICAgIHJldHVybiBhc3QgYXMgQVNUICYge3R5cGU6IEFTVH1cbiAgICAgIH1cbiAgICAgIGNhc2UgXCJzdHJpbmdcIjp7XG4gICAgICAgIGFzdC50eXBlID0gU1RSSU5HXG4gICAgICAgIHJldHVybiBhc3QgYXMgQVNUICYge3R5cGU6IEFTVH1cbiAgICAgIH1cblxuICAgICAgY2FzZSBcInZhclwiOiB7XG4gICAgICAgIGlmIChidWlsdGluc1thc3QuY29udGVudC5uYW1lXSkge1xuICAgICAgICAgIGxldCBkZWYgPSBidWlsdGluc1thc3QuY29udGVudC5uYW1lXVxuICAgICAgICAgIHJldHVybiBhbm5vdChhc3QsIGRlZi50eXBlKVxuICAgICAgICB9XG4gICAgICAgIGxldCBoaXQgPSBsb29rdXAoYXN0LmNvbnRlbnQubmFtZSwgZW52KVxuICAgICAgICBpZiAoaGl0KSB7XG4gICAgICAgICAgaWYgKGhpdC5iaW5kZXIudHlwZSkgYW5ub3QoYXN0LCBoaXQuYmluZGVyLnR5cGUpXG4gICAgICAgICAgcmV0dXJuIGhpdC52YWx1ZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc3RcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJsZXRcIjoge1xuXG4gICAgICAgIGxldCB2YWx1ZSA9IGdvKGFzdC5jb250ZW50LnZhbHVlLCBlbnYpXG5cbiAgICAgICAgaWYgKGFzdC5jb250ZW50LnZhci50eXBlID09IHVuZGVmaW5lZCkgYW5ub3QoYXN0LmNvbnRlbnQudmFyLCB2YWx1ZS50eXBlISlcbiAgICAgICAgZW52ID0gYmluZFZhbHVlKGVudiwgYXN0LmNvbnRlbnQudmFyLCB2YWx1ZSwgdHJ1ZSlcbiAgICAgICAgbGV0IHJlcyA9IGdvKGFzdC5jb250ZW50LmJvZHksIGVudilcbiAgICAgICAgaWYgKHJlcy50eXBlKSBhbm5vdChhc3QsIHJlcy50eXBlKVxuICAgICAgICByZXR1cm4gcmVzXG4gICAgICB9XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjp7XG4gICAgICAgIGlmIChhc3QuY29udGVudC5lbnYgPT0gdW5kZWZpbmVkKSBhc3QuY29udGVudC5lbnYgPSBlbnZcblxuICAgICAgICBsZXQgYm9keSA9IGdvKFxuICAgICAgICAgIGFzdC5jb250ZW50LmJvZHksXG4gICAgICAgICAgYXN0LmNvbnRlbnQudmFycy5yZWR1Y2UoKGVudiwgdikgPT4gYmluZChlbnYsIHYsIHYpLCBhc3QuY29udGVudC5lbnYgYXMgRW52KVxuICAgICAgICApXG5cbiAgICAgICAgbGV0IGZ2YXIgPSBta3ZhcihmcmVlbmFtZShlbnYpKVxuICAgICAgICBsZXQgZnR5cGU6IEFTVCA9IG1rZnVuKCBbZnZhcl0sIG1rZnVuKGFzdC5jb250ZW50LnZhcnMsIGFzdC5jb250ZW50LmJvZHkudHlwZSA/PyBta2FwcChUWVBFT0YsIFtib2R5XSkpKVxuICAgICAgICBhbm5vdChhc3QsIGZ0eXBlKVxuICAgICAgICBsZXQgcmVzID0gbWtmdW4oYXN0LmNvbnRlbnQudmFycywgYm9keSlcbiAgICAgICAgcmVzLmNvbnRlbnQuZW52ID0gYXN0LmNvbnRlbnQuZW52XG4gICAgICAgIHJldHVybiBhbm5vdChyZXMsIGZ0eXBlKVxuICAgICAgfVxuXG4gICAgICBjYXNlIFwiYXBwXCI6IHtcbiAgICAgICAgbGV0IGZuID0gZ28oYXN0LmNvbnRlbnQuZm4sIGVudilcbiAgICAgICAgbGV0IGFyZ3MgPSBhc3QuY29udGVudC5hcmdzLm1hcChhcmcgPT4gZ28oYXJnLCBlbnYpKVxuXG4gICAgICAgIGlmIChmbi4kID09IFwidmFyXCIgJiYgYnVpbHRpbnNbZm4uY29udGVudC5uYW1lXSkge1xuICAgICAgICAgIGxldCByZXMgPSBidWlsdGluc1tmbi5jb250ZW50Lm5hbWVdLmltcGwoLi4uYXJncylcbiAgICAgICAgICBpZiAocmVzLnR5cGUpIGFubm90KGFzdCwgcmVzLnR5cGUpXG4gICAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbi4kID09IFwiZnVuY3Rpb25cIil7XG5cbiAgICAgICAgICBpZiAoZm4uY29udGVudC52YXJzLmxlbmd0aCAhPT0gYXJncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtmbi5jb250ZW50LnZhcnMubGVuZ3RofSBhcmd1bWVudHMsIGdvdCAke2FyZ3MubGVuZ3RofWApXG4gICAgICAgICAgbGV0IGNhbGxlbnYgPSBmbi5jb250ZW50LmVudiBhcyBFbnY7XG4gICAgICAgICAgY2FsbGVudiA9IGZuLmNvbnRlbnQudmFycy5yZWR1Y2UoKGVudiwgdiwgaSkgPT4gYmluZFZhbHVlKGVudiwgdiwgYXJnc1tpXSwgdHJ1ZSksIGNhbGxlbnYpXG4gICAgICAgICAgbGV0IHJlcyA9IGdvKGZuLmNvbnRlbnQuYm9keSwgY2FsbGVudilcbiAgICAgICAgICBpZiAocmVzLnR5cGUpIGFubm90KGFzdCwgcmVzLnR5cGUpXG5cbiAgICAgICAgICByZXR1cm4gcmVzXG4gICAgICAgIH1cbiAgICAgICAgLy8gdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgYXBwbHkgbm9uLWZ1bmN0aW9uICR7cHJldHR5QVNUKGZuKX1gKVxuICAgICAgICByZXR1cm4gbWthcHAoZm4sIGFyZ3MpXG4gICAgICB9XG4gICAgICBkZWZhdWx0OiByZXR1cm4gYXN0XG4gICAgfVxuICB9XG4gIHJldHVybiBnbyhhc3QsIG51bGwpXG59XG5cblxubGV0IHNhbXBsZXMgPSBbXG4gIFwiMjIgfCBudW1iZXIgfCAyMlwiLFxuICAnbGV0IHggPSAyMiBpbiB4IHwgbnVtYmVyIHwgMjInLFxuICAnbGV0IChudW1iZXIgeCkgPSAyMiBpbiB4IHwgbnVtYmVyIHwgMjInLFxuICAnZm4geCA9PiB4IHwgZm4geDAgPT4gZm4geCA9PiAodHlwZW9mIHgpJyxcbiAgJyhudW1iZXIgMjIpIHwgbnVtYmVyIHwgMjInLFxuICAnZm4gKG51bWJlciB4KSA9PiB4IHwgZm4geDAgPT4gZm4gKG51bWJlciB4KSA9PiBudW1iZXIgfCBmbiAobnVtYmVyIHgpID0+IHgnLFxuICAnZm4geCA9PiAobnVtYmVyIHgpIHwgZm4geDAgPT4gZm4gKG51bWJlciB4KSA9PiBudW1iZXInLFxuICAnKGZuIHggPT4geCAyMikgfCBudW1iZXInLFxuICAnKGZuIChudW1iZXIgeCkgPT4geCAyMikgfCBudW1iZXInLFxuICAnKGZuIChzdHJpbmcgeCkgPT4geCAyMikgfCBlcnJvcicsXG4gICdsZXQgaWQgPSBmbiB4ID0+IHggaW4gZm4geSA9PiAoaWQgeSkgfCBmbiB4MCA9PiBmbiB5ID0+ICh0eXBlb2YgeSkgfCBmbiB5ID0+IHknLFxuICAnZm4gKG51bWJlciB4KSA9PiAoc3RyaW5nIHgpIHwgZXJyb3InLFxuXS5tYXAoY29kZSA9PiBjb2RlLnNwbGl0KFwifFwiKS5tYXAocyA9PiBzLnRyaW0oKSkpXG5cblxubGV0IHJlc3VsdHMgPSB0YWJsZSgpLnN0eWxlKHtcbiAgd2lkdGg6IFwiMTAwJVwiLFxuICB3aGl0ZVNwYWNlOiBcInByZVwiLFxufSlcblxuXG5cblxuZm9yIChsZXQgW2NvZGUsIGV4cGVjdGVkVHlwZSwgZXhwZWN0ZWRSZXN1bHRdIG9mIHNhbXBsZXMpe1xuXG4gIGxldCBhc3QgPSBwYXJzZShjb2RlKVxuICBsZXQgcmVzIDogQVNUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkXG5cbiAgdHJ5e1xuICAgIHJlcyA9IHJ1bihhc3QuYXN0KVxuICB9Y2F0Y2goZSl7XG4gICAgaWYgKGV4cGVjdGVkVHlwZSAhPSBcImVycm9yXCIpIGNvbnNvbGUuZXJyb3IoYEVycm9yIHJ1bm5pbmcgY29kZTogJHtjb2RlfVxcbmAsIGUpXG4gIH1cblxuICBsZXQgdHlwZVN0ciA9IHJlcyA/IHJlcy50eXBlID8gcHJldHR5QVNUKHJlcy50eXBlKSA6IFwibm8gdHlwZVwiIDogXCJlcnJvclwiXG4gIGxldCByZXNTdHIgPSByZXMgPyBwcmV0dHlBU1QocmVzKSA6IFwiZXJyb3JcIlxuXG4gIGxldCBjaGVjayA9ICh0eXBlU3RyID09IChleHBlY3RlZFR5cGUgPz8gdHlwZVN0cikgJiYgcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpKVxuXG5cblxuXG4gIGlmICghY2hlY2spIHtcbiAgICByZXN1bHRzLmFwcGVuZChcbiAgICAgIHRyKFxuICAgICAgICB0ZChjb2RlKSxcbiAgICAgICAgdGQodHlwZVN0cikuc3R5bGUoe2NvbG9yOiB0eXBlU3RyID09IChleHBlY3RlZFR5cGUgPz8gdHlwZVN0cikgPyBcImdyZWVuXCIgOiBcInJlZFwiLCBwYWRkaW5nOiBcIjAgOHB4XCJ9KSxcbiAgICAgICAgdGQocmVzU3RyKS5zdHlsZSh7Y29sb3I6IHJlc1N0ciA9PSAoZXhwZWN0ZWRSZXN1bHQgPz8gcmVzU3RyKSA/IFwiZ3JlZW5cIiA6IFwicmVkXCJ9KVxuICAgICAgKVxuICAgICAgLnN0eWxlKHtcbiAgICAgICAgYm9yZGVyQm90dG9tOiBcIjFweCBzb2xpZCBcIitjb2xvci5jb2xvcixcbiAgICAgIH0pXG4gICAgKVxuICAgIGJvZHkuYXBwZW5kKGRpdihyZXN1bHRzKVxuICAgIC5zdHlsZSh7XG4gICAgICBwb3NpdGlvbjogXCJhYnNvbHV0ZVwiLFxuICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCBcIitjb2xvci5jb2xvcixcbiAgICAgIHBhZGRpbmc6IFwiMTZweFwiLFxuICAgICAgYmFja2dyb3VuZENvbG9yOiBjb2xvci5iYWNrZ3JvdW5kLFxuICAgIH0pKVxuICB9XG59ICAgIFxuXG5cblxuIiwKICAgICJpbXBvcnQgeyBib2R5LCBodG1sLCBzcGFuICwgZnJvbUhUTUwsIGgyLCBkaXZ9IGZyb20gXCIuL2h0bWxcIjtcbmltcG9ydCB7IGVkaXRvciB9IGZyb20gXCIuL2VkaXRvclwiO1xuaW1wb3J0IHsgcGFyc2UsIHByZXR0eUFTVCwgdHlwZSBBU1QsIHR5cGUgU3BhbiwgdHlwZSBTeW50YXhOb2RlIH0gZnJvbSBcIi4vcGFyc2VyXCI7XG5pbXBvcnQgeyBnZXRkZWYgfSBmcm9tIFwiLi9sc3BcIlxuaW1wb3J0IHsgcnVuLCBBTlkgfSBmcm9tIFwiLi9ydW50aW1lXCJcbmltcG9ydCB7IGNvbG9yIH0gZnJvbSBcIi4vaHRtbFwiO1xuXG5cbmlmICh3aW5kb3cubG9jYXRpb24ub3JpZ2luLmluY2x1ZGVzKFwibG9jYWxob3N0XCIpKShhc3luYyAoKT0+e1xuICBsZXQgdmVyc2lvbiA9IGF3YWl0IGZldGNoKFwiL3ZlcnNpb25cIikudGhlbihyZXMgPT4gcmVzLnRleHQoKSlcbiAgLmNhdGNoKGU9PlwiMFwiKVxuICB3aGlsZSAodHJ1ZSl7XG4gICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpXG4gICAgdHJ5e1xuICAgICAgaWYgKGF3YWl0IGZldGNoKFwiL3ZlcnNpb25cIikudGhlbihyZXMgPT4gcmVzLnRleHQoKSkuY2F0Y2goZT0+XCIwXCIpIT0gdmVyc2lvbikgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpXG4gICAgfWNhdGNoKGUpe2JyZWFrO31cbiAgfVxufSkoKTtcblxuXG5cbmxldCBvdXR2aWV3ID0gaHRtbCgncHJlJykoKS5zdHlsZSh7XG4gIGJvcmRlclRvcDogXCIxcHggc29saWQgXCIrY29sb3IuY29sb3IsXG4gIHBhZGRpbmdUb3A6IFwiMTZweFwiLFxufSlcblxubGV0IGFzdDogQVNUIHwgdW5kZWZpbmVkXG5sZXQgY3VycmVudEFzdE1hcDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBbXVxuXG5cbmxldCBjb2RlOnN0cmluZyA9ICcnXG5cbmxldCBFZGl0ID0gZWRpdG9yKHM9PiB7XG4gICAgdHJ5e1xuICAgICAgbGV0IHBhcnNlZCA9IHBhcnNlKHMpXG4gICAgICBhc3QgPSBwYXJzZWQuYXN0XG4gICAgICBjdXJyZW50QXN0TWFwID0gcGFyc2VkLmFzdG1hcFxuICAgICAgY29kZSA9IHNcbiAgICAgIGxldCByZXMgPSBydW4oYXN0KVxuICAgICAgb3V0dmlldy5lbC50ZXh0Q29udGVudCA9IHByZXR0eUFTVChyZXMpXG5cbiAgICB9Y2F0Y2goZSl7XG4gICAgICBhc3QgPSB1bmRlZmluZWRcbiAgICAgIGN1cnJlbnRBc3RNYXAgPSBbXVxuICAgICAgb3V0dmlldy5lbC50ZXh0Q29udGVudCA9IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKVxuICAgIH1cbiAgfSxcbiAgKCk9PiBjdXJyZW50QXN0TWFwLFxuICAocmVxKSA9PiB7XG4gICAgbGV0IGRlZiA9IHJlcS4kID09IFwidmFyXCIgPyBnZXRkZWYoYXN0ISwgcmVxKSA6IHVuZGVmaW5lZFxuICAgIGlmIChkZWYpIEVkaXQuc2V0Q3Vyc29yKHtyb3c6IGRlZi5zcGFuLnN0YXJ0LmxpbmUtMSwgY29sOiBkZWYuc3Bhbi5zdGFydC5jb2wtMX0pXG4gIH0sXG4gIChub2RlKSA9PiB7XG4gICAgaWYgKG5vZGUuJCA9PT0gXCJjb21tZW50XCIpIHJldHVybiB1bmRlZmluZWRcblxuICAgIHJldHVybiBub2RlLiQgKyBcIjogXCIgKyAobm9kZS50eXBlID8gcHJldHR5QVNUKG5vZGUudHlwZSkgOiAobm9kZS4kID09IFwidmFyXCIgPyBwcmV0dHlBU1QoZ2V0ZGVmKGFzdCEsIG5vZGUpPy50eXBlID8/IEFOWSkgOiBcIlhYXCIpKVxuICB9XG4pXG5cbmJvZHkuc3R5bGUoe3BhZGRpbmc6IFwiNDRweFwiLGZvbnRGYW1pbHk6IFwic2Fucy1zZXJpZlwiLH0pXG5cblxubGV0IGJ1dHRuID0gKHQ6c3RyaW5nLCBvbkNsaWNrOigpID0+IHZvaWQpID0+IHNwYW4odCwgb25DbGljaykuc3R5bGUoe2NvbG9yOiBcImdyYXlcIiwgYm9yZGVyOiBcIjFweCBzb2xpZCBncmF5XCIsIGJvcmRlclJhZGl1czogXCI0cHhcIiwgcGFkZGluZzogXCIycHggNHB4XCIsIG1hcmdpblJpZ2h0OiBcIjhweFwifSlcblxubGV0IGFib3V0X3RleHQgPSBgXG5cbi8vIFRoaXMgaXMgYSB0b3kgY29kZSBlZGl0b3Igc3RpbGwgaW4gZGV2ZWxvcG1lbnQuXG5cbi8vIHRoZSBnb2FsIGlzIHRvIGJ1aWxkIGEgbGFuZ3VhZ2Ugd2l0aDpcblxuLy8gZXh0cmVtZWx5IG1pbmltYWwgc3ludGF4XG4vLyBmaXJzdCBjbGFzcyBzdXBwb3J0IGZvciB0eXBlcyBhcyB2YWx1ZXNcbi8vIGZpcnN0IGNhc3MgTFNQIHByb2dyYW1uZyBpbiBhIHN0cmFpZ2h0Zm9yd2FyZCB3YXkuXG5cblxuLy8gaG92ZXIgb3ZlciB4IHRvIHNlZSBpdHMgaW5mZXJyZWQgdHlwZVxubGV0IG4gPSAyMiBpblxuXG4vLyB0aGlzIGlzIGhvdyB0eXBlcyBhcmUgYW5ub3RhdGVkLiB0eXBlcyBhcmUgZXNzZW50aWFsbHkganVzdCBmdW5jdGlvbnMgb3ZlciB2YWx1ZXMuXG5sZXQgayA9IChudW1iZXIgMzMpIGluXG5sZXQgdSA9IChzdHJpbmcgXCJobGxvXCIpIGluXG5cblxuLy8gdW50eXBlZCBpZFxubGV0IGlkID0gZm4geCA9PiB4IGluXG5cblxuLy8gbnVtYmVyIHR5cGVkIGlkXG5sZXQgaWRuID0gZm4geCA9PiAobnVtYmVyIHgpIGluXG5cbi8vIHR5cGUgb2YgbnVtYmVyIC0+IG51bWJlclxubGV0IFQgPSBmbiBmPT4gZm4geCA9PiAobnVtYmVyIChmIChudW1iZXIgeCkpKSBpblxuXG4vLyBhbm5vdGVkIGlkXG5cbmxldCBpZG5fID0gKFQgaWQpIGluXG5cbmxldCByID0gKGlkIFwiMlwiKSBpblxuXG4vLyB0aGlzIGlzIHdpbGwgcmVzdWx0IGluIHR5cGUgZXJyb3IuXG4vLyBsZXQgQkFEID0gKGlkbl8gXCIyXCIpIGluXG5cbihpZCAyKVxuYFxuXG5ib2R5LmFwcGVuZChcbiAgZGl2KFxuICAgIHNwYW4oJ+KciO+4jicpLnN0eWxlKHtmb250U2l6ZTogXCIzZW1cIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KSxcbiAgICBzcGFuKFwiTWlHXCIpLnN0eWxlKHtmb250U2l6ZTogXCIxLjVlbVwiLCBmb250V2VpZ2h0OiBcImJvbGRcIiwgZm9udEZhbWlseTogXCJtb25vc3BhY2VcIn0pXG4gICkuc3R5bGUoe2Rpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBtYXJnaW5Cb3R0b206IFwiMTZweFwiLCBjb2xvcjogXCJncmF5XCJ9KSxcblxuICBFZGl0LmVsLFxuICBvdXR2aWV3LFxuICBidXR0bihcImFib3V0XCIsICgpID0+IEVkaXQuc2V0VGV4dChhYm91dF90ZXh0KSksXG4gIGJ1dHRuKFwiZ2l0aHViXCIsICgpID0+IHdpbmRvdy5vcGVuKFwiaHR0cHM6Ly9naXRodWIuY29tL2Rrb3JtYW5uL215ZWRpdG9yXCIpKVxuKVxuXG5cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFhTyxJQUFNLE9BQU8sQ0FBeUMsUUFBVSxJQUFJLGFBQW9EO0FBQUEsRUFDN0gsSUFBSSxVQUFVLFNBQVMsS0FBSyxPQUFLLE9BQU8sTUFBTSxVQUFVO0FBQUEsRUFDeEQs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
