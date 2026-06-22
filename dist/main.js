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
  console.log(ast);
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
  return { ast, comments };
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
  type: {
    type: TYPE,
    impl: (x) => {
      if (x.type == TYPE)
        return x;
      if (x == NUMBER || x == STRING)
        return x;
      if (x.$ != "function")
        throw new Error(`Type error: expected a type, got ${prettyAST(x)}`);
      let { vars, body: body2 } = x.content;
      if (vars.length != 1)
        throw new Error(`Expected function Type with 1 argument, got ${vars.length}`);
      if (body2.$ != "function")
        throw new Error(`Expected function Type, got ${body2.$}`);
      return x;
    }
  },
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
        return mkAst("app", { fn: TYPEOF, args: [x] });
      return evaluate(x.type, {});
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
  pr.append(`
`);
};
var debugCall = (fn) => (...args) => {
  if (!DEBUG)
    return fn(...args);
  console.log("DEBUG", fn.name);
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
        return el.append("fn ", ...ast2.content.vars.map((x) => {
          if (x.type)
            return go(mkapp(x.type, [x]));
          return go(x);
        }), " => ").append(go(ast2.content.body));
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
var annot = (term, type) => {
  if (type === undefined)
    return term;
  if (term.type !== undefined && prettyAST(term.type) !== prettyAST(type))
    throw new Error(`Expected ${prettyAST(type)}, got ${prettyAST(term.type)}`);
  term.type = type;
  return term;
};
var evaluate = (term, env = {}) => {
  let go = (term2, env2) => {
    switch (term2.$) {
      case "var": {
        if (env2[term2.content.name])
          return env2[term2.content.name].val;
        return term2;
      }
      case "function":
        return mkAst("function", {
          vars: term2.content.vars,
          body: term2.content.body,
          env: env2
        });
      case "app":
        return apply(evaluate(term2.content.fn, env2), term2.content.args.map((arg) => evaluate(arg, env2)));
      case "let": {
        let val;
        try {
          val = evaluate(term2.content.value, env2);
        } catch (e) {
          val = mkAst("error", { message: e instanceof Error ? e.message : String(e), content: "" });
          val.span = term2.content.value.span;
          term2.content.value = val;
          return evaluate(term2.content.body, env2);
        }
        annot(term2.content.var, val.type);
        return evaluate(term2.content.body, { ...env2, [term2.content.var.content.name]: { binder: term2.content.var, val } });
      }
      case "number":
        return annot(term2, NUMBER);
      case "string":
        return term2;
    }
    throw new Error(`Cannot evaluate term of type ${term2.$}`);
  };
  let res = go(term, env);
  annot(term, res.type);
  return res;
};
evaluate = debugCall(evaluate);
var apply = (fn, args) => {
  if (fn.$ == "function") {
    if (fn.content.vars.length != args.length)
      throw new Error(`Expected ${fn.content.vars.length} arguments, got ${args.length}`);
    let env = { ...fn.content.env };
    fn.content.vars.forEach((binder, i) => env[binder.content.name] = { binder, val: args[i] });
    return evaluate(fn.content.body, env);
  }
  if (fn.$ == "var") {
    let name = fn.content.name;
    if (builtins[name])
      return builtins[name].impl(...args);
  }
  let res = mkAst("app", { fn, args });
  return res;
};
var counter = 0;
var readback = (val) => {
  if (val.$ == "function") {
    let vars = val.content.vars.map((x) => annot(mkvar(x.content.name + "_" + counter++), x.type));
    return mkfun(vars, readback(apply(val, vars)));
  }
  if (val.$ == "app")
    return mkapp(readback(val.content.fn), val.content.args.map(readback));
  return val;
};
readback = debugCall(readback);
var run = (ast) => {
  counter = 0;
  return readback(evaluate(ast, {}));
};

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
var ast;
var currentAstMap = [];
var Edit = editor(localStorage.getItem("lines") ?? about_text, (code) => {
  try {
    let parsed = parse(code);
    ast = parsed.ast;
    code = code;
    let res = run(ast);
    currentAstMap = buildAstMap(ast, parsed.comments);
    outview.el.textContent = prettyAST(res);
    localStorage.setItem("lines", code);
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
    return ["", []];
  let str = node.$ + ": ";
  let map = str.split("").map((c) => {
    return;
  });
  let ast2 = node.type ? node.type : ANY;
  let co = prettyAST(ast2);
  str += co;
  return [str, map];
});
body.style({ padding: "44px", fontFamily: "sans-serif" });
var buttn = (t, onClick) => span(t, onClick).style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginRight: "8px" });
body.append(div(span("✈︎").style({ fontSize: "3em", marginRight: "8px" }), span("MiG").style({ fontSize: "1.5em", fontWeight: "bold", fontFamily: "monospace" })).style({ display: "flex", alignItems: "center", marginBottom: "16px", color: "gray" }), Edit.el, outview, buttn("about", () => Edit.setText(about_text)), buttn("github", () => window.open("https://github.com/dkormann/myeditor")));

//# debugId=4598A2970A1BEE1364756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCk9PiBOT0RFLFxuICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IE5PREU8SD4sXG4gIGFzc2lnbjogKGh0bWxQcm9wczogUGFydGlhbDxIVE1MRWxlbWVudD4pID0+IE5PREVcbn1cblxuZXhwb3J0IHR5cGUgQVJHID0gTk9ERSB8IHN0cmluZyB8ICgoZTpNb3VzZUV2ZW50KT0+dm9pZClcblxuZXhwb3J0IGNvbnN0IGh0bWwgPSA8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4gKHRhZzpLKSA9PiAoLi4uY2hpbGRyZW46QVJHW10pOiBOT0RFIDxIVE1MRWxlbWVudFRhZ05hbWVNYXBbS10+ID0+IHtcbiAgbGV0IG9uY2xpY2sgPSBjaGlsZHJlbi5maW5kKGMgPT4gdHlwZW9mIGMgPT09IFwiZnVuY3Rpb25cIikgYXMgRnVuY3Rpb25cbiAgbGV0IGVsID0gZnJvbUhUTUwgKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSkuYXBwZW5kKC4uLiBjaGlsZHJlbi5maWx0ZXIoYyA9PiB0eXBlb2YgYyAhPT0gXCJmdW5jdGlvblwiKSBhcyAoTk9ERSB8IHN0cmluZylbXSkgYXMgTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPjtcbiAgaWYgKG9uY2xpY2spIGVsLmVsLiBvbmNsaWNrID0gKG9uY2xpY2sgYXMgKGU6TW91c2VFdmVudCk9PnZvaWQpXG4gIFxuICByZXR1cm4gZWxcbn1cblxuXG5leHBvcnQgY29uc3QgZnJvbUhUTUwgID0gPEggZXh0ZW5kcyBIVE1MRWxlbWVudD4gIChlbDpIKTogTk9ERSA8SD4gPT4ge1xuXG4gIGxldCBub2RlIDogTk9ERTxIPiA9IHtcbiAgICAkOiBcIk5PREVcIixcbiAgICBlbCxcbiAgICBhcHBlbmQ6ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBjaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gXCJzdHJpbmdcIikgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpKTtcbiAgICAgICAgZWxzZSBlbC5hcHBlbmRDaGlsZChjaGlsZC5lbCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG4gICAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCkgPT4ge1xuICAgICAgZWwub25jbGljayA9IGZcbiAgICAgIHJldHVybiBub2RlXG4gICAgfSxcbiAgICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGVsLnJlcGxhY2VDaGlsZHJlbigpXG4gICAgICByZXR1cm4gbm9kZS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gICAgfSxcbiAgICBzdHlsZTogKHN0eWxlczogUGFydGlhbDxDU1NTdHlsZURlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgc3R5bGVzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfSxcbiAgICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiB7XG4gICAgICBPYmplY3QuYXNzaWduKGVsLCBodG1sUHJvcHMpO1xuICAgICAgcmV0dXJuIGZyb21IVE1MKGVsKTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBub2RlXG59XG5cblxuZXhwb3J0IGNvbnN0IGRpdiA9IGh0bWwoXCJkaXZcIik7XG5leHBvcnQgY29uc3Qgc3BhbiA9IGh0bWwoXCJzcGFuXCIpO1xuZXhwb3J0IGNvbnN0IHAgPSBodG1sKFwicFwiKTtcbmV4cG9ydCBjb25zdCBib2R5ID0gZnJvbUhUTUwoZG9jdW1lbnQuYm9keSk7XG5leHBvcnQgY29uc3QgaDEgPSBodG1sKFwiaDFcIik7XG5leHBvcnQgY29uc3QgaDIgPSBodG1sKFwiaDJcIik7XG5leHBvcnQgY29uc3QgaDMgPSBodG1sKFwiaDNcIik7XG5leHBvcnQgY29uc3QgaDQgPSBodG1sKFwiaDRcIik7XG5leHBvcnQgY29uc3QgdGFibGUgPSBodG1sKFwidGFibGVcIik7XG5leHBvcnQgY29uc3QgdHIgPSBodG1sKFwidHJcIik7XG5leHBvcnQgY29uc3QgdGQgPSBodG1sKFwidGRcIik7XG5leHBvcnQgY29uc3QgcHJlID0gaHRtbChcInByZVwiKVxuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNmVlZWZmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMjIyMTIyO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZjEwZjIyO1xuICAgICAgLS1ncmVlbjogIzU0YzgwMTtcbiAgICAgIC0tYmx1ZTogIzFmMzJmZjtcbiAgICAgIC0teWVsbG93OiAjZDM5ZTNkO1xuICAgICAgLS1icm93bjogI2M1NWQwMDtcbiAgICAgIC0tcHVycGxlOiAjYTYxZmQwO1xuICAgICAgLS1jeWFuOiAjMGJhZWJjO1xuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuZXhwb3J0IGNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IGFueSk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJcblxuXG5leHBvcnQgdHlwZSBQb3MgPSB7b2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXJ9XG5leHBvcnQgdHlwZSBTcGFuID0ge3N0YXJ0OiBQb3MsIGVuZDogUG9zfVxuXG5leHBvcnQgdHlwZSBUYWcgPFQgZXh0ZW5kcyBzdHJpbmcsIEM+ID0geyQ6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4sIHR5cGU/OiBBU1R9XG5cbmV4cG9ydCB0eXBlIFZhciA9IFRhZzxcInZhclwiLCB7bmFtZTogc3RyaW5nfT5cbmV4cG9ydCB0eXBlIENvbW1lbnQgPSBUYWc8XCJjb21tZW50XCIsIHN0cmluZz5cbmV4cG9ydCB0eXBlIEZ1bmMgPSBUYWc8XCJmdW5jdGlvblwiLCB7dmFyczogVmFyW10sIGJvZHk6IEFTVH0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIFByaW0gPSBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPiB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFByaW1cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXX1cblxuXG5cbmNvbnN0IHplcm9Qb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9KVxuY29uc3QgemVyb1NwYW4gPSAoKTogU3BhbiA9PiAoe3N0YXJ0OiB6ZXJvUG9zKCksIGVuZDogemVyb1BvcygpfSlcblxuZXhwb3J0IGNvbnN0IG1rQXN0ID0gPFQgZXh0ZW5kcyBzdHJpbmcsIEM+KHRhZzogVCwgY29udGVudDogQywgc3BhbjogU3BhbiA9IHplcm9TcGFuKCkpOiBUYWc8VCwgQz4gPT4gKHskOiB0YWcsIGNvbnRlbnQsIHNwYW59KVxuXG50eXBlIFRva2VuQmFzZSA9IHtzcGFuOiBTcGFufVxuXG50eXBlIFRva2VuID1cbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiaWRlbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogbnVtYmVyfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiYXJyb3dcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImNvbW1lbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30pXG5cbnR5cGUgVG9rZW5Ob1NwYW4gPSBUb2tlbiBleHRlbmRzIGluZmVyIFQgPyBUIGV4dGVuZHMge3NwYW46IFNwYW59ID8gT21pdDxULCBcInNwYW5cIj4gOiBuZXZlciA6IG5ldmVyXG5cbmNvbnN0IHRva2VuaXplID0gKGNvZGU6IHN0cmluZyk6IHt0b2tlbnM6IFRva2VuW10sIGNvbW1lbnRzOiBDb21tZW50W10sIGVvZjogUG9zfSA9PiB7XG4gIGxldCB0b2tlbnM6IFRva2VuW10gPSBbXVxuICBsZXQgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdXG4gIGxldCBpID0gMFxuICBsZXQgbGluZSA9IDFcbiAgbGV0IGNvbCA9IDFcblxuICBsZXQgaXNBbHBoYSA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16X10vLnRlc3QoY2hhcilcbiAgbGV0IGlzRGlnaXQgPSAoY2hhcjogc3RyaW5nKSA9PiAvWzAtOV0vLnRlc3QoY2hhcilcbiAgbGV0IGlzSWRlbnQgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtejAtOV9dLy50ZXN0KGNoYXIpXG4gIGxldCBwb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiBpLCBsaW5lLCBjb2x9KVxuICBsZXQgYWR2YW5jZSA9ICgpID0+IHtcbiAgICBpZiAoY29kZVtpXSA9PT0gXCJcXG5cIikge1xuICAgICAgaSsrXG4gICAgICBsaW5lKytcbiAgICAgIGNvbCA9IDFcbiAgICB9IGVsc2Uge1xuICAgICAgaSsrXG4gICAgICBjb2wrK1xuICAgIH1cbiAgfVxuICBsZXQgcHVzaCA9ICh0b2tlbjogVG9rZW5Ob1NwYW4sIHN0YXJ0OiBQb3MpID0+IHtcbiAgICB0b2tlbnMucHVzaCh7Li4udG9rZW4sIHNwYW46IHtzdGFydCwgZW5kOiBwb3MoKX19IGFzIFRva2VuKVxuICB9XG5cbiAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgIGxldCBjaGFyID0gY29kZVtpXVxuXG4gICAgaWYgKC9cXHMvLnRlc3QoY2hhcikpIHtcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCIvXCIgJiYgY29kZVtpICsgMV0gPT09IFwiL1wiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgY29kZVtpXSAhPT0gXCJcXG5cIikgYWR2YW5jZSgpXG4gICAgICBjb21tZW50cy5wdXNoKG1rQXN0KFwiY29tbWVudFwiLCBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSksIHtzdGFydCwgZW5kOiBwb3MoKX0pKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCI9XCIgJiYgY29kZVtpICsgMV0gPT09IFwiPlwiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwiYXJyb3dcIn0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoXCIoKXt9PSw6XCIuaW5jbHVkZXMoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWUgPSBjaGFyIGFzIFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBcIlwiXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gY29kZVtpXVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICBsZXQgbmV4dCA9IGNvZGVbaSArIDFdXG4gICAgICAgICAgaWYgKG5leHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBlc2NhcGVcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBlc2NhcGVkID0gKHtuOiBcIlxcblwiLCByOiBcIlxcclwiLCB0OiBcIlxcdFwiLCAnXCInOiAnXCInLCBcIlxcXFxcIjogXCJcXFxcXCJ9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pW25leHRdXG4gICAgICAgICAgdmFsdWUgKz0gZXNjYXBlZCA/PyBuZXh0XG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gJ1wiJykgYnJlYWtcbiAgICAgICAgdmFsdWUgKz0gY3VycmVudFxuICAgICAgICBhZHZhbmNlKClcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlW2ldICE9PSAnXCInKSB7XG4gICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGxpdGVyYWxcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgIH1cbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzRGlnaXQoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNEaWdpdChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogTnVtYmVyKGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSkpfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0FscGhhKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzSWRlbnQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKVxuICAgICAgaWYgKHZhbHVlID09PSBcImxldFwiIHx8IHZhbHVlID09PSBcImluXCIgfHwgdmFsdWUgPT09IFwiZm5cIikgcHVzaCh7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBlbHNlIHB1c2goe3R5cGU6IFwiaWRlbnRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICBhZHZhbmNlKClcbiAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IGBVbmV4cGVjdGVkIGNoYXJhY3RlcjogJHtjaGFyfWAsIGNvbnRlbnQ6IGNoYXJ9LCBzdGFydClcbiAgfVxuXG4gIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbn1cblxuY2xhc3MgUGFyc2VyIHtcbiAgcHJpdmF0ZSBpID0gMFxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdG9rZW5zOiBUb2tlbltdLCBwcml2YXRlIHNvdXJjZTogc3RyaW5nLCBwcml2YXRlIGVvZjogUG9zKSB7fVxuXG4gIHBhcnNlKCk6IEFTVCB7XG4gICAgbGV0IGFzdCA9IHRoaXMucGFyc2VFeHByKClcbiAgICBpZiAodGhpcy5wZWVrKCkpIHtcbiAgICAgIGxldCBzdGFydCA9IHRoaXMucGVlaygpIS5zcGFuLnN0YXJ0XG4gICAgICBsZXQgZW5kID0gdGhpcy50b2tlbnNbdGhpcy50b2tlbnMubGVuZ3RoIC0gMV0/LnNwYW4uZW5kID8/IHN0YXJ0XG4gICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbmV4cGVjdGVkIGV4dHJhIGlucHV0IGFmdGVyIGV4cHJlc3Npb25cIiwge3N0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICByZXR1cm4gYXN0XG4gIH1cblxuICBwcml2YXRlIHBhcnNlRXhwcigpOiBBU1Qge1xuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImxldFwiKSkgcmV0dXJuIHRoaXMucGFyc2VMZXQoKVxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImZuXCIpKSByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKClcbiAgICByZXR1cm4gdGhpcy5wYXJzZUF0b20oKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldCgpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImxldFwiKS5zcGFuLnN0YXJ0XG4gICAgbGV0IHZhcmlhYmxlID0gdGhpcy5wYXJzZUxldEJpbmRlcigpXG4gICAgaWYgKHZhcmlhYmxlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIHZhcmlhYmxlXG5cbiAgICBsZXQgdmFsdWU6IEFTVFxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiPVwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCI9XCIpXG4gICAgICB2YWx1ZSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIpXG4gICAgfVxuXG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImluXCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdEtleXdvcmQoXCJpblwiKVxuICAgICAgYm9keSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIpXG4gICAgfVxuXG4gICAgcmV0dXJuIG1rQXN0KFwibGV0XCIsIHt2YXI6IHZhcmlhYmxlLCB2YWx1ZSwgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VGdW5jdGlvbigpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImZuXCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyczogVmFyW10gPSBbXVxuICAgIHdoaWxlICh0aGlzLnBlZWsoKT8udHlwZSA9PT0gXCJpZGVudFwiIHx8IHRoaXMuaXNTeW1ib2woXCIoXCIpKSB7XG4gICAgICBsZXQgYmluZGVyID0gdGhpcy5wYXJzZUJpbmRlcigpXG4gICAgICBpZiAoYmluZGVyLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHk6IGJpbmRlcn0sIHtzdGFydCwgZW5kOiBiaW5kZXIuc3Bhbi5lbmR9KVxuICAgICAgdmFycy5wdXNoKGJpbmRlcilcbiAgICB9XG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh2YXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKHRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSBib2R5ID0gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpXG4gICAgICBlbHNlIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCBzdGFydClcbiAgICB9IGVsc2UgaWYgKCF0aGlzLm1hdGNoVG9rZW4oXCJhcnJvd1wiKSkge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPT4nIGFmdGVyIGZ1bmN0aW9uIHBhcmFtZXRlcnNcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH1cbiAgICByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBdG9tKCk6IEFTVCB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dFwiKVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiaWRlbnRcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInZhclwiLCB7bmFtZTogdG9rZW4udmFsdWV9LCB0b2tlbi5zcGFuKVxuICAgIH1cblxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJudW1iZXJcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJzdHJpbmdcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogdG9rZW4ubWVzc2FnZSwgY29udGVudDogdG9rZW4uY29udGVudH0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCIoXCIpKSByZXR1cm4gdGhpcy5wYXJzZVBhcmVucygpXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCJ7XCIpKSByZXR1cm4gdGhpcy5wYXJzZVJlY29yZCgpXG5cbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShgVW5leHBlY3RlZCB0b2tlbjogJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB0b2tlbi5zcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVBhcmVucygpOiBBU1Qge1xuICAgIGxldCBvcGVuID0gdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgbGV0IGl0ZW1zOiBBU1RbXSA9IFtdXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gaXRlbXMubGVuZ3RoID4gMCA/IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGl0ZW1zLnB1c2godGhpcy5wYXJzZUV4cHIoKSlcbiAgICB9XG4gICAgbGV0IGNsb3NlID0gdGhpcy5leHBlY3RTeW1ib2woXCIpXCIpXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiRW1wdHkgcGFyZW50aGVzZXMgYXJlIG5vdCBhbGxvd2VkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgY2xvc2Uuc3Bhbi5lbmQub2Zmc2V0KSlcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAxKSByZXR1cm4gaXRlbXNbMF1cbiAgICByZXR1cm4gbWtBc3QoXCJhcHBcIiwge2ZuOiBpdGVtc1swXSwgYXJnczogaXRlbXMuc2xpY2UoMSl9LCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVjb3JkKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIntcIilcbiAgICBsZXQgZmllbGRzOiBbVmFyLCBBU1RdW10gPSBbXVxuXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcmVjb3JkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkge1xuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKSFcbiAgICAgICAgdGhpcy5pKytcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBFeHBlY3RlZCByZWNvcmQgZmllbGQgbmFtZSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YCwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogdG9rZW4uc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCB0b2tlbi5zcGFuLmVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IGtleSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgbGV0IHZhbHVlID0gdGhpcy5pc1N5bWJvbChcIjpcIilcbiAgICAgICAgPyAodGhpcy5leHBlY3RTeW1ib2woXCI6XCIpLCB0aGlzLmlzU3ltYm9sKFwifVwiKSA/IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiKSA6IHRoaXMucGFyc2VFeHByKCkpXG4gICAgICAgIDoga2V5XG4gICAgICBmaWVsZHMucHVzaChba2V5LCB2YWx1ZV0pXG4gICAgICBpZiAodGhpcy5pc1N5bWJvbChcIixcIikpIHRoaXMuaSsrXG4gICAgICBlbHNlIGJyZWFrXG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgbGV0IGVuZCA9IGZpZWxkcy5sZW5ndGggPiAwID8gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXVsxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIn1cIilcbiAgICByZXR1cm4gbWtBc3QoXCJyZWNvcmRcIiwgZmllbGRzLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlQmluZGVyKCk6IFZhciB8IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+IHtcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKFwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgaWRlbnRpZmllciBpbiBiaW5kZXIgcGF0dGVyblwiKVxuICAgICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJyknIGFmdGVyIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICAgIHZhcmlhYmxlLnR5cGUgPSBkZWNsYXJlZFR5cGVcbiAgICAgIHJldHVybiB2YXJpYWJsZVxuICAgIH1cbiAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyXCIpXG4gICAgbGV0IHZhcmlhYmxlID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI6XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIjpcIilcbiAgICAgIGxldCBkZWNsYXJlZFR5cGUgPSB0aGlzLnBhcnNlQXRvbSgpXG4gICAgICBpZiAoZGVjbGFyZWRUeXBlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGRlY2xhcmVkVHlwZVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgIH1cbiAgICByZXR1cm4gdmFyaWFibGVcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VMZXRCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQmluZGVyKClcbiAgfVxuXG4gIHByaXZhdGUgcGVlaygpOiBUb2tlbiB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMuaV1cbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKTogYm9vbGVhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICByZXR1cm4gdG9rZW4/LnR5cGUgPT09IFwia2V5d29yZFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBpc1N5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJzeW1ib2xcIiAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWVcbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0VG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7dHlwZX0sIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaFRva2VuPEsgZXh0ZW5kcyBUb2tlbltcInR5cGVcIl0+KHR5cGU6IEspOiBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+IHwgdW5kZWZpbmVkIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4gfHwgdG9rZW4udHlwZSAhPT0gdHlwZSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuIGFzIEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT5cbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0S2V5d29yZCh2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIikge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuPy50eXBlICE9PSBcImtleXdvcmRcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQga2V5d29yZCAke3ZhbHVlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RTeW1ib2wodmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwic3ltYm9sXCIgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcke3ZhbHVlfScsIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW5cbiAgfVxuXG4gIHByaXZhdGUgZGVzY3JpYmUodG9rZW46IFRva2VuIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gXCJlbmQgb2YgaW5wdXRcIlxuICAgIGlmIChcInZhbHVlXCIgaW4gdG9rZW4pIHJldHVybiBgJHt0b2tlbi50eXBlfSgke1N0cmluZyh0b2tlbi52YWx1ZSl9KWBcbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJlcnJvclwiKSByZXR1cm4gYGVycm9yKCR7dG9rZW4ubWVzc2FnZX0pYFxuICAgIHJldHVybiB0b2tlbi50eXBlXG4gIH1cblxuICBwcml2YXRlIGVycm9yTm9kZShtZXNzYWdlOiBzdHJpbmcsIHNwYW4/OiBTcGFuLCBjb250ZW50Pzogc3RyaW5nKTogRXJyb3JOb2RlIHtcbiAgICBsZXQgZmluYWxTcGFuID0gc3BhbiA/PyB0aGlzLnBvaW50U3BhbigpXG4gICAgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2UsIGNvbnRlbnQ6IGNvbnRlbnQgPz8gdGhpcy5zb3VyY2Uuc2xpY2UoZmluYWxTcGFuLnN0YXJ0Lm9mZnNldCwgZmluYWxTcGFuLmVuZC5vZmZzZXQpfSwgZmluYWxTcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvckhlcmUobWVzc2FnZTogc3RyaW5nLCBzdGFydD86IFBvcyk6RXJyb3JOb2RlIHtcbiAgICBsZXQgc3BhbiA9IHRoaXMucGVlaygpPy5zcGFuID8/IHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIHtzdGFydDogc3RhcnQgPz8gc3Bhbi5zdGFydCwgZW5kOiBzcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHdyYXBFcnJvcihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEFTVCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIG5vZGUuc3BhbiwgdGhpcy5zb3VyY2Uuc2xpY2Uobm9kZS5zcGFuLnN0YXJ0Lm9mZnNldCwgbm9kZS5zcGFuLmVuZC5vZmZzZXQpKVxuICB9XG5cbiAgcHJpdmF0ZSBwb2ludFNwYW4oKTogU3BhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4pIHJldHVybiB0b2tlbi5zcGFuXG4gICAgcmV0dXJuIHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGJ1aWxkQXN0TWFwID0gKGFzdDogQVNULCBjb21tZW50czogQ29tbWVudFtdID0gW10pOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9PiB7XG4gIGNvbnNvbGUubG9nKGFzdClcbiAgbGV0IG1heEVuZCA9IGNvbW1lbnRzLnJlZHVjZSgobSwgYykgPT4gYy5zcGFuLmVuZC5vZmZzZXQgPiBtID8gYy5zcGFuLmVuZC5vZmZzZXQgOiBtLCBhc3Quc3Bhbi5lbmQub2Zmc2V0KVxuICBsZXQgcmVzOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IEFycmF5LmZyb20oe2xlbmd0aDogbWF4RW5kfSwgKCk9PnVuZGVmaW5lZClcbiAgY29uc3Qgd2FsayA9IChub2RlOiBBU1QpID0+IHtcbiAgICBmb3IgKGxldCBpID0gbm9kZS5zcGFuLnN0YXJ0Lm9mZnNldDsgaSA8IG5vZGUuc3Bhbi5lbmQub2Zmc2V0OyBpKyspIHJlc1tpXSA9IG5vZGVcbiAgICBjaGlsZHJlbihub2RlKS5mb3JFYWNoKHdhbGspXG4gIH1cbiAgd2Fsayhhc3QpXG4gIGNvbW1lbnRzLmZvckVhY2goY29tbWVudCA9PiB7XG4gICAgZm9yIChsZXQgaSA9IGNvbW1lbnQuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBjb21tZW50LnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBjb21tZW50XG4gIH0pXG4gIHJldHVybiByZXNcbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlID0gKGNvZGU6c3RyaW5nKTogUGFyc2VSZXN1bHQgPT4ge1xuICBsZXQge3Rva2VucywgY29tbWVudHMsIGVvZn0gPSB0b2tlbml6ZShjb2RlKVxuICBsZXQgYXN0ID0gbmV3IFBhcnNlcih0b2tlbnMsIGNvZGUsIGVvZikucGFyc2UoKVxuICByZXR1cm4ge2FzdCwgY29tbWVudHN9XG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZUFTVCA9IChjb2RlOnN0cmluZyk6IEFTVCA9PiBwYXJzZShjb2RlKS5hc3RcblxuZXhwb3J0IGNvbnN0IGNoaWxkcmVuID0gKG5vZGU6IEFTVCk6IEFTVFtdID0+IHtcbiAgaWYgKG5vZGUuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gWy4uLm5vZGUuY29udGVudC52YXJzLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJhcHBcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQuZm4sIC4uLm5vZGUuY29udGVudC5hcmdzXVxuICBpZiAobm9kZS4kID09PSBcImxldFwiKSByZXR1cm4gW25vZGUuY29udGVudC52YXIsIG5vZGUuY29udGVudC52YWx1ZSwgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwicmVjb3JkXCIpIHJldHVybiBub2RlLmNvbnRlbnQuZmxhdE1hcCgoW2tleSwgdmFsdWVdKSA9PiBba2V5LCB2YWx1ZV0pXG4gIHJldHVybiBbXVxufVxuXG5jb25zdCBzdHJpcFNwYW5zID0gKGFzdDogQVNUKTogdW5rbm93biA9PiB7XG4gIGlmIChhc3QuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyczogYXN0LmNvbnRlbnQudmFycy5tYXAoc3RyaXBTcGFucyksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwiYXBwXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHtmbjogc3RyaXBTcGFucyhhc3QuY29udGVudC5mbiksIGFyZ3M6IGFzdC5jb250ZW50LmFyZ3MubWFwKHN0cmlwU3BhbnMpfX1cbiAgaWYgKGFzdC4kID09PSBcImxldFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7dmFyOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhciksIHZhbHVlOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LnZhbHVlKSwgYm9keTogc3RyaXBTcGFucyhhc3QuY29udGVudC5ib2R5KX19XG4gIGlmIChhc3QuJCA9PT0gXCJyZWNvcmRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnQubWFwKChbbmFtZSwgdmFsdWVdKSA9PiBbc3RyaXBTcGFucyhuYW1lKSwgc3RyaXBTcGFucyh2YWx1ZSldKX1cbiAgaWYgKGFzdC4kID09PSBcImVycm9yXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50fVxuICByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbn1cblxuXG5sZXQgc3RyaW5naWZ5ID0gKHg6IHVua25vd24pID0+IEpTT04uc3RyaW5naWZ5KHgsIG51bGwsIDIpXG5cbmNvbnN0IHRlc3RfcGFyc2UgPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogQVNUKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuXG4gIGlmIChKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpICE9PSBKU09OLnN0cmluZ2lmeShzdHJpcFNwYW5zKGV4cGVjdGVkKSkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiVGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIHN0cmluZ2lmeShzdHJpcFNwYW5zKGFzdCkpKVxuICAgIHRocm93IG5ldyBFcnJvcihgVGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmNvbnN0IHRlc3Rfc3BhbiA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBTcGFuKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuICBpZiAoSlNPTi5zdHJpbmdpZnkoYXN0LnNwYW4pICE9PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZCkpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTpcIiwgY29kZSlcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIGV4cGVjdGVkKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJHb3Q6XCIsIGFzdC5zcGFuKVxuICAgIHRocm93IG5ldyBFcnJvcihgU3BhbiB0ZXN0IGZhaWxlZCBmb3IgY29kZTogJHtjb2RlfWApXG4gIH1cbn1cblxuZXhwb3J0IGxldCBta251bSA9IChuOiBudW1iZXIpID0+IG1rQXN0KFwibnVtYmVyXCIsIG4pXG5leHBvcnQgbGV0IG1rc3RyID0gKHM6IHN0cmluZykgPT4gbWtBc3QoXCJzdHJpbmdcIiwgcylcbmV4cG9ydCBsZXQgbWt2YXIgPSAobmFtZTogc3RyaW5nKSA9PiBta0FzdChcInZhclwiLCB7bmFtZX0pXG5leHBvcnQgbGV0IG1rYXBwID0gKGZuOiBBU1QsIGFyZ3M6IEFTVFtdKSA9PiBta0FzdChcImFwcFwiLCB7Zm4sIGFyZ3N9KVxuZXhwb3J0IGxldCBta2xldCA9ICh2OiBzdHJpbmcgfCBWYXIsIHZhbHVlOiBBU1QsIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJsZXRcIiwge3ZhcjogdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYsIHZhbHVlLCBib2R5fSlcbmV4cG9ydCBsZXQgbWtmdW4gPSAodmFyczogKHN0cmluZyB8IFZhcilbXSwgYm9keTogQVNUKSA9PiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzOiB2YXJzLm1hcCh2ID0+IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2KSwgYm9keX0pIGFzIEZ1bmNcbmV4cG9ydCBsZXQgYW5ub3QgPSAodHlwZTogQVNULCB2YWx1ZTogQVNUKSA9PiBta0FzdChcImFubm90XCIsIHt0eXBlLCB2YWx1ZX0pXG5leHBvcnQgbGV0IG1rcmVjb3JkID0gKGZpZWxkczoge1trZXkgOiBzdHJpbmddIDogQVNUfSkgPT4gbWtBc3QoXCJyZWNvcmRcIiwgT2JqZWN0LmVudHJpZXMoZmllbGRzKS5tYXAoKFtrLHZdKT0+IFtta3ZhcihrKSwgdl0pKVxuXG5PYmplY3QuZW50cmllcyh7XG4gIFwieFwiOiBta3ZhcihcInhcIiksXG4gIFwiMjJcIjogbWtudW0oMjIpLFxuICAnXCJoZWxsb1wiJzogbWtzdHIoXCJoZWxsb1wiKSxcbiAgXCIoZiB4KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIildKSxcbiAgXCIoZiB4IHkpXCI6IG1rYXBwKG1rdmFyKFwiZlwiKSwgW21rdmFyKFwieFwiKSwgbWt2YXIoXCJ5XCIpXSksXG4gIFwibGV0IHggPSAyMiBpbiB4XCI6IG1rbGV0KFwieFwiLCBta251bSgyMiksIG1rdmFyKFwieFwiKSksXG4gIFwie2E6IDIyLCBiOiB4fVwiOiBta3JlY29yZCh7YTogbWtudW0oMjIpLCBiOiBta3ZhcihcInhcIil9KSxcbiAgXCJmbiB4ID0+IHhcIjogbWtmdW4oW1wieFwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiB4IHkgPT4geFwiOiBta2Z1bihbXCJ4XCIsIFwieVwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJsZXQgKG51bWJlciB4KSA9IDIyIGluIHhcIjogbWtsZXQoT2JqZWN0LmFzc2lnbihta3ZhcihcInhcIiksIHt0eXBlOiBta3ZhcihcIm51bWJlclwiKX0pLCBta251bSgyMiksIG1rdmFyKFwieFwiKSksXG4gIFwiZm4gKG51bWJlciB4KSAoc3RyaW5nIHkpID0+IHhcIjogbWtmdW4oW1xuICAgIE9iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KSxcbiAgICBPYmplY3QuYXNzaWduKG1rdmFyKFwieVwiKSwge3R5cGU6IG1rdmFyKFwic3RyaW5nXCIpfSksXG4gIF0sIG1rdmFyKFwieFwiKSksXG4gIFwie2U6MjJ9XCIgOiBta3JlY29yZCh7ZTogbWtudW0oMjIpfSksXG4gIFwie2V9XCI6IG1rcmVjb3JkKHtlOiBta3ZhcihcImVcIil9KSxcbiAgXCIvL2NvbW1lbnRcXG4yMlwiOiBwYXJzZUFTVChcIjIyXCIpLFxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG5PYmplY3QuZW50cmllcyh7XG4gIFwiKFwiOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIlVudGVybWluYXRlZCBwYXJlbnRoZXNpemVkIGV4cHJlc3Npb25cIiwgY29udGVudDogXCIoXCJ9KSxcbiAgXCJsZXQgeCAyMiBpbiB4XCI6IG1rQXN0KFwibGV0XCIsIHtcbiAgICB2YXI6IG1rdmFyKFwieFwiKSxcbiAgICB2YWx1ZTogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiLCBjb250ZW50OiBcIjIyXCJ9KSxcbiAgICBib2R5OiBta3ZhcihcInhcIiksXG4gIH0pLFxuICBcIntlOn1cIjogbWtyZWNvcmQoe2U6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiLCBjb250ZW50OiBcIn1cIn0pfSksXG5cbn0pLmZvckVhY2goKFtjb2RlLCBleHBlY3RlZF0pID0+IHRlc3RfcGFyc2UoY29kZSwgZXhwZWN0ZWQgYXMgQVNUKSlcblxudGVzdF9zcGFuKFwibGV0IHggPSAyMlxcbmluIHhcIiwge1xuICBzdGFydDoge29mZnNldDogMCwgbGluZTogMSwgY29sOiAxfSxcbiAgZW5kOiB7b2Zmc2V0OiAxNSwgbGluZTogMiwgY29sOiA1fSxcbn0pXG4iLAogICAgImltcG9ydCB7IEFTVCwgVmFyIH0gZnJvbSBcIi4vcGFyc2VyXCJcbmltcG9ydCB7Y2hpbGRyZW59IGZyb20gXCIuL3BhcnNlclwiXG5cblxuZXhwb3J0IGNvbnN0IGdldGRlZiA9IChyb290OiBBU1QsIHZhcmk6IFZhcik6IEFTVCB8IHVuZGVmaW5lZCA9PiB7XG4gIGlmIChyb290LnNwYW4uc3RhcnQub2Zmc2V0ID4gdmFyaS5zcGFuLnN0YXJ0Lm9mZnNldCB8fCByb290LnNwYW4uZW5kLm9mZnNldCA8IHZhcmkuc3Bhbi5lbmQub2Zmc2V0KSByZXR1cm4gdW5kZWZpbmVkXG4gIGZvciAobGV0IGNoaWxkIG9mIGNoaWxkcmVuKHJvb3QpKXtcbiAgICBsZXQgcmVzID0gZ2V0ZGVmKGNoaWxkLCB2YXJpKVxuICAgIGlmIChyZXMpIHJldHVybiByZXNcbiAgfVxuXG4gIGlmIChyb290LiQgPT09IFwibGV0XCIgJiYgcm9vdC5jb250ZW50LnZhci5jb250ZW50Lm5hbWUgPT09IHZhcmkuY29udGVudC5uYW1lKVxuICAgIHJldHVybiByb290LmNvbnRlbnQudmFyXG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJmdW5jdGlvblwiKVxuICAgIGZvciAobGV0IHYgb2Ygcm9vdC5jb250ZW50LnZhcnMpXG4gICAgICBpZiAodi5jb250ZW50Lm5hbWUgPT09IHZhcmkuY29udGVudC5uYW1lKVxuICAgICAgICByZXR1cm4gdlxufVxuIiwKICAgICJpbXBvcnQgeyBjb2xvck9mIH0gZnJvbSBcIi4vZWRpdG9yXCJcbmltcG9ydCB7IGJvZHksIGNvbG9yLCBkaXYsIE5PREUsIHByZSwgc3BhbiB9IGZyb20gXCIuL2h0bWxcIlxuaW1wb3J0IHtta251bSwgUHJpbSwgVGFnLCB0eXBlIEFTVCwgdHlwZSBGdW5jLCBwYXJzZSwgbWt2YXIsIG1rYXBwLCBWYXIsIG1rQXN0LCBta2Z1biwgRXJyb3JOb2RlfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5leHBvcnQgbGV0IE5VTUJFUiA9IG1rdmFyKFwibnVtYmVyXCIpXG5leHBvcnQgbGV0IFNUUklORyA9IG1rdmFyKFwic3RyaW5nXCIpXG5leHBvcnQgbGV0IFRZUEUgICA9IG1rdmFyKFwidHlwZVwiKVxuZXhwb3J0IGxldCBUWVBFT0YgPSBta3ZhcihcInR5cGVvZlwiKVxuXG5OVU1CRVIudHlwZSA9IFRZUEVcblNUUklORy50eXBlID0gVFlQRVxuVFlQRS50eXBlID0gVFlQRVxuVFlQRU9GLnR5cGUgPSBwYXJzZShcImZuIGYgPT4gZm4geCA9PiB0eXBlXCIpLmFzdCFcblxuZXhwb3J0IGxldCBBTlkgOiBBU1QgPSBta3ZhcihcImFueVwiKVxuXG5sZXQgcHJpbWl0aXZlVHlwZSA9IChuYW1lOiBzdHJpbmcpID0+ICh7XG4gIHR5cGU6IFRZUEUsXG4gIGltcGw6ICh4OiBWYWx1ZSkgPT4ge1xuICAgIGlmICh4LnR5cGUpIHtcbiAgICAgIGlmICh4LnR5cGUuJCA9PSBcInZhclwiICYmIHgudHlwZS5jb250ZW50Lm5hbWUgPT0gbmFtZSkgcmV0dXJuIHhcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtuYW1lfSwgZ290ICR7KHgudHlwZSl9YClcbiAgICB9XG4gICAgeC50eXBlID0gbWt2YXIobmFtZSlcbiAgICByZXR1cm4geFxuICB9XG59KVxuXG5cblxuY29uc3QgYnVpbHRpbktleXMgPSBbXCJudW1iZXJcIiwgXCJzdHJpbmdcIiwgXCJlcVwiLCBcImFkZFwiLCBcImlmZWxzZVwiLCBcInR5cGVvZlwiLCBcInR5cGVcIl0gYXMgY29uc3RcbnR5cGUgQnVpbHRpbktleSA9IHR5cGVvZiBidWlsdGluS2V5c1tudW1iZXJdXG5cbmxldCBidWlsdGluczogUmVjb3JkPEJ1aWx0aW5LZXksIHsgdHlwZTogQVNULCBpbXBsOiAoLi4uYXJnczpWYWx1ZVtdKSA9PiBWYWx1ZSB9PiA9IHtcbiAgbnVtYmVyOiBwcmltaXRpdmVUeXBlKFwibnVtYmVyXCIpLFxuICBzdHJpbmc6IHByaW1pdGl2ZVR5cGUoXCJzdHJpbmdcIiksXG4gIFwidHlwZVwiOiB7XG4gICAgdHlwZTogVFlQRSxcbiAgICBpbXBsOiAoeDogVmFsdWUpID0+IHtcbiAgICAgIGlmICh4LnR5cGUgPT0gVFlQRSkgcmV0dXJuIHhcbiAgICAgIGlmICh4ID09IE5VTUJFUiB8fCB4ID09IFNUUklORykgcmV0dXJuIHhcbiAgICAgIGlmICh4LiQgIT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkIGEgdHlwZSwgZ290ICR7cHJldHR5QVNUKHgpfWApXG4gICAgICBsZXQge3ZhcnMsIGJvZHl9ID0geC5jb250ZW50XG4gICAgICBpZiAodmFycy5sZW5ndGggIT0gMSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBmdW5jdGlvbiBUeXBlIHdpdGggMSBhcmd1bWVudCwgZ290ICR7dmFycy5sZW5ndGh9YClcbiAgICAgIGlmIChib2R5LiQgIT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGZ1bmN0aW9uIFR5cGUsIGdvdCAke2JvZHkuJH1gKVxuICAgICAgcmV0dXJuIHhcbiAgICB9XG5cbiAgfSxcbiAgZXE6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCB5ID0+IChudW1iZXIgKGYgeCB5KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiBta251bShcbiAgICAgICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fFxuICAgICAgKHguJCA9PSBcInN0cmluZ1wiICYmIHkuJCA9PSBcInN0cmluZ1wiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8ICh4ID09IHkpXG4gICAgICA/IDEgOiAwKVxuICB9LFxuICBhZGQ6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGY9PiBmbiB4IHkgPT4gKG51bWJlciAoZiAobnVtYmVyIHgpIChudW1iZXIgeSkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IHtcbiAgICAgIGlmICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIikgcmV0dXJuIG1rbnVtKHguY29udGVudCArIHkuY29udGVudClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBhZGQ6IGV4cGVjdGVkIG51bWJlcnMsIGdvdCAke3ByZXR0eUFTVCh4KX0gYW5kICR7cHJldHR5QVNUKHkpfWApXG4gICAgfVxuICB9LFxuICBpZmVsc2UgOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIFQgY29uZCB0aGVuIGVsc2UgPT4gKFQgKGYgKG51bWJlciBjb25kKSAoVCB0aGVuKSAoVCBlbHNlKSkpXCIpLmFzdCEsXG4gICAgaW1wbDogKGNvbmQsIHRoZW4sIGVscykgPT4ge1xuICAgICAgbGV0IHZhbCA9IGNvbmQuJCA9PSBcIm51bWJlclwiID8gY29uZC5jb250ZW50IDogY29uZC4kID09IFwic3RyaW5nXCIgPyBjb25kLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgcmV0dXJuIHZhbCA/IHRoZW4gOiBlbHNcbiAgICB9XG4gIH0sXG4gIHR5cGVvZjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+ICh0eXBlIChmIHgpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4IDogVmFsdWUpIDogVmFsdWUgPT4ge1xuICAgICAgaWYgKCF4LnR5cGUpIHJldHVybiBta0FzdChcImFwcFwiLCB7Zm46IFRZUEVPRiwgYXJnczogW3hdfSlcbiAgICAgIHJldHVybiBldmFsdWF0ZSh4LnR5cGUsIHt9KVxuICAgIH1cbiAgfVxufVxuXG5sZXQgREVCVUcgPSAwXG5sZXQgbG9nZ2VyUHJlID0gcHJlKClcbmJvZHkucmVwbGFjZUNoaWxyZW4obG9nZ2VyUHJlKVxuXG5cbnR5cGUgVmlzID0gTk9ERSB8IHN0cmluZyB8IHVuZGVmaW5lZCB8IG51bGwgfCBBU1QgfCBWYWx1ZSB8IFZpc1tdIHwgbnVtYmVyXG5cbmxldCBkZWJ1ZyA9ICguLi5hcmdzOiBWaXNbXSkgPT4ge1xuICBpZiAoIURFQlVHKSByZXR1cm5cbiAgbGV0IHByID0gbG9nZ2VyUHJlXG4gIGZvciAobGV0IGFyZyBvZiBhcmdzKXtcbiAgICBpZiAodHlwZW9mIGFyZyA9PSBcInN0cmluZ1wiIHx8IHR5cGVvZiBhcmcgPT0gXCJudW1iZXJcIikgcHIuYXBwZW5kKFN0cmluZyhhcmcpKVxuICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkgW1wiW1wiLCAuLi5hcmcsIFwiXVwiXS5mb3JFYWNoKGE9PiBkZWJ1ZyhhKSlcbiAgICBlbHNlIGlmIChhcmcgPT09IHVuZGVmaW5lZCB8fCBhcmcgPT09IG51bGwpIHByLmFwcGVuZChzcGFuKFN0cmluZyhhcmcpKS5zdHlsZSh7Y29sb3I6IGNvbG9yLmdyYXl9KSlcbiAgICBlbHNlIGlmIChcIiRcIiBpbiBhcmcpe1xuICAgICAgaWYgKGFyZy4kID09IFwiTk9ERVwiKSBwci5hcHBlbmQoYXJnKVxuICAgICAgZWxzZSBwci5hcHBlbmQoYXN0VmlldyhhcmcpKVxuICAgIH1cbiAgfVxuICBwci5hcHBlbmQoXCJcXG5cIilcbn1cblxubGV0IGRlYnVnQ2FsbCA9IDxBUkdTIGV4dGVuZHMgYW55W10sIFQ+IChmbjogKC4uLmFyZ3M6IEFSR1MpID0+IFQpID0+ICguLi5hcmdzOiBBUkdTKSA6IFQgPT4ge1xuICBpZiAoIURFQlVHKSByZXR1cm4gZm4oLi4uYXJncylcbiAgY29uc29sZS5sb2coXCJERUJVR1wiLCBmbi5uYW1lKVxuICBkZWJ1ZyhcIkAgXCIsIGZuLm5hbWUsIC4uLmFyZ3MpXG4gIGxldCBvbGRwcmUgPSBsb2dnZXJQcmVcbiAgbGV0IGNhbGxwcmUgPSBwcmUoKS5zdHlsZSh7Ym9yZGVyTGVmdDogXCI0cHggc29saWQgXCIrY29sb3IuZ3JheSwgbWFyZ2luTGVmdDogXCI4cHhcIiwgcGFkZGluZ0xlZnQ6IFwiOHB4XCJ9KVxuICBsb2dnZXJQcmUuYXBwZW5kKGNhbGxwcmUpXG4gIGxvZ2dlclByZSA9IGNhbGxwcmVcbiAgbGV0IHJlcyA9IGZuKC4uLmFyZ3MpXG4gIGxvZ2dlclByZSA9IG9sZHByZVxuICBkZWJ1ZyhyZXMgYXMgYW55KVxuICByZXR1cm4gcmVzXG59XG5cblxubGV0IGFzdFZpZXcgPSAoYXN0OiBBU1QgfCBWYWx1ZSk6IE5PREUgPT4ge1xuICBsZXQgX3ZpZXcgPSAoYXN0OiBBU1QgfCBWYWx1ZSk6IE5PREUgPT4ge1xuICAgIGxldCBlbCA9IHNwYW4oKVxuICAgIHN3aXRjaChhc3QuJCl7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICBjYXNlIFwic3RyaW5nXCI6IHJldHVybiBlbC5hcHBlbmQoU3RyaW5nKGFzdC5jb250ZW50KSkuc3R5bGUoe2NvbG9yOiBjb2xvci5ibHVlfSkgIFxuICAgICAgY2FzZSBcInZhclwiOiByZXR1cm4gZWwuYXBwZW5kKGFzdC5jb250ZW50Lm5hbWUpXG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIGVsLmFwcGVuZCggXCJmbiBcIiwuLi5hc3QuY29udGVudC52YXJzLm1hcCh4PT57XG4gICAgICAgIGlmICh4LnR5cGUpIHJldHVybiBnbyhta2FwcCh4LnR5cGUsIFt4XSkpXG4gICAgICAgIHJldHVybiBnbyh4KVxuICAgICAgfSksXCIgPT4gXCIpLmFwcGVuZChnbyhhc3QuY29udGVudC5ib2R5KSlcbiAgICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGVsLmFwcGVuZChcIihcIiwgZ28oYXN0LmNvbnRlbnQuZm4pLCBcIiBcIiwgLi4uYXN0LmNvbnRlbnQuYXJncy5tYXAoYXJnPT5nbyhhcmcpKSwgXCIpXCIpXG4gICAgICBjYXNlIFwibGV0XCI6IHJldHVybiBlbC5hcHBlbmQoXCJsZXQgXCIsIGFzdC5jb250ZW50LnZhci5jb250ZW50Lm5hbWUsIFwiID0gXCIsIGdvKGFzdC5jb250ZW50LnZhbHVlKSwgXCIgaW4gXCIsIGdvKGFzdC5jb250ZW50LmJvZHkpKVxuICAgICAgZGVmYXVsdDogcmV0dXJuIGVsLmFwcGVuZChgWyR7YXN0LiR9XWApXG4gICAgfSAgXG4gIH1cbiAgbGV0IGdvID0gKGFzdDpBU1R8VmFsdWUpOiBOT0RFID0+IHtcbiAgICBsZXQgZWwgPSBzcGFuKF92aWV3KGFzdCkpLnN0eWxlKHtjb2xvcjogY29sb3JPZihhc3QpLCBjdXJzb3I6IFwicG9pbnRlclwifSlcbiAgICAub25jbGljayhlPT57XG4gICAgICBlbC5yZXBsYWNlQ2hpbHJlbihcbiAgICAgICAgc3BhbihcIlRZUEU6XCIpLnN0eWxlKHtjb2xvcjogY29sb3IuZ3JheX0pXG4gICAgICAgIC5vbmNsaWNrKGU9PntcbiAgICAgICAgICBlbC5yZXBsYWNlQ2hpbHJlbihfdmlldyhhc3QpKVxuICAgICAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgICAgfSksXG4gICAgICAgIGFzdC50eXBlID8gYXN0Vmlldyhhc3QudHlwZSkgOiBcIipcIixcbiAgICAgICAgZ28oYXN0KVxuICAgICAgKVxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgIH0pXG4gICAgcmV0dXJuIGVsXG4gIH1cbiAgcmV0dXJuIGRpdihnbyhhc3QpKS5zdHlsZSh7cGFkZGluZzpcIi40ZW1cIiwgYm9yZGVyOiBcIjFweCBzb2xpZCBcIitjb2xvci5ncmF5LCBib3JkZXJSYWRpdXM6IFwiLjRlbVwiLCBtYXJnaW46XCIuNGVtIDBcIn0pXG59XG5cbmNvbnN0IGhhc1Nob3duVHlwZSA9ICh2OiBWYXIpID0+IHYudHlwZSAmJiAhKHYudHlwZS4kID09PSBcInZhclwiICYmIHYudHlwZS5jb250ZW50Lm5hbWUgPT09IFwiYW55XCIpXG5jb25zdCBwcmV0dHlCaW5kZXIgPSAodjogVmFyKTogc3RyaW5nID0+IGhhc1Nob3duVHlwZSh2KSA/IGAoJHtwcmV0dHlBU1Qodi50eXBlISl9ICR7di5jb250ZW50Lm5hbWV9KWAgOiB2LmNvbnRlbnQubmFtZVxuXG5cbmV4cG9ydCBjb25zdCBwcmV0dHlBU1QgPSAobm9kZTogQVNUKTogc3RyaW5nID0+e1xuICBzd2l0Y2gobm9kZS4kKXtcbiAgICBjYXNlIFwibnVtYmVyXCIgOiByZXR1cm4gbm9kZS5jb250ZW50LnRvU3RyaW5nKClcbiAgICBjYXNlIFwic3RyaW5nXCIgOiByZXR1cm4gSlNPTi5zdHJpbmdpZnkobm9kZS5jb250ZW50KVxuICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIG5vZGUuY29udGVudC5uYW1lXG4gICAgY2FzZSBcImxldFwiOiByZXR1cm4gYGxldCAke3ByZXR0eUJpbmRlcihub2RlLmNvbnRlbnQudmFyKX0gPSAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQudmFsdWUpfSBpblxcbiR7cHJldHR5QVNUKG5vZGUuY29udGVudC5ib2R5KX1gXG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBgZm4gJHtub2RlLmNvbnRlbnQudmFycy5tYXAocHJldHR5QmluZGVyKS5qb2luKFwiIFwiKX0gPT4gJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBgKCR7cHJldHR5QVNUKG5vZGUuY29udGVudC5mbil9ICR7bm9kZS5jb250ZW50LmFyZ3MubWFwKHByZXR0eUFTVCkuam9pbihcIiBcIil9KWBcbiAgICBjYXNlIFwicmVjb3JkXCI6IHJldHVybiBgeyR7bm9kZS5jb250ZW50Lm1hcCgoW2ssIHZdKSA9PiBgJHtrLmNvbnRlbnQubmFtZX06ICR7cHJldHR5QVNUKHYpfWApLmpvaW4oXCIsIFwiKX19YFxuICAgIGNhc2UgXCJlcnJvclwiOiByZXR1cm4gYFtFUlJPUjogJHtub2RlLmNvbnRlbnQubWVzc2FnZX1dYFxuICB9XG59XG5cbnR5cGUgTmV1dHJhbCA9IFZhciB8IFByaW0gfCBUYWc8XCJhcHBcIiwge2ZuOiBOZXV0cmFsLCBhcmdzOiBWYWx1ZVtdfT4gfCBFcnJvck5vZGVcbnR5cGUgVmFsdWUgPSBUYWc8XCJmdW5jdGlvblwiLCB7ZW52OiBFbnYsIHZhcnM6IFZhcltdLCBib2R5OiBBU1R9PiB8IE5ldXRyYWxcbnR5cGUgRW52ID0gUmVjb3JkPHN0cmluZywge2JpbmRlcjogVmFyLCB2YWw6VmFsdWV9PlxuXG5sZXQgYW5ub3QgPSAgPFQgZXh0ZW5kcyBWYWx1ZSB8IEFTVD4gKHRlcm06VCwgdHlwZTogQVNUIHwgdW5kZWZpbmVkKSA6VCA9PiB7XG4gIGlmICh0eXBlID09PSB1bmRlZmluZWQpIHJldHVybiB0ZXJtXG4gIGlmICh0ZXJtLnR5cGUgIT09IHVuZGVmaW5lZCAmJiBwcmV0dHlBU1QodGVybS50eXBlKSAhPT0gcHJldHR5QVNUKHR5cGUpKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7cHJldHR5QVNUKHR5cGUpfSwgZ290ICR7cHJldHR5QVNUKHRlcm0udHlwZSl9YClcbiAgdGVybS50eXBlID0gdHlwZVxuICByZXR1cm4gdGVybVxufVxuXG5cblxuXG5sZXQgZXZhbHVhdGUgPSAodGVybTpBU1QsIGVudjogRW52ID0ge30pOlZhbHVlID0+IHtcblxuICBsZXQgZ28gPSAodGVybTpBU1QsIGVudjogRW52KTogVmFsdWUgPT4ge1xuICAgIHN3aXRjaCAodGVybS4kKSB7XG4gICAgICBjYXNlIFwidmFyXCI6IHtcbiAgICAgICAgaWYgKGVudlt0ZXJtLmNvbnRlbnQubmFtZV0pIHJldHVybiBlbnZbdGVybS5jb250ZW50Lm5hbWVdLnZhbFxuICAgICAgICByZXR1cm4gdGVybVxuICAgICAgfVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHtcbiAgICAgICAgdmFyczogdGVybS5jb250ZW50LnZhcnMsXG4gICAgICAgIGJvZHk6IHRlcm0uY29udGVudC5ib2R5LFxuICAgICAgICBlbnZcbiAgICAgIH0pIFxuICAgICAgY2FzZSBcImFwcFwiOiByZXR1cm4gYXBwbHkoXG4gICAgICAgIGV2YWx1YXRlKHRlcm0uY29udGVudC5mbiwgZW52KSxcbiAgICAgICAgdGVybS5jb250ZW50LmFyZ3MubWFwKGFyZyA9PiBldmFsdWF0ZShhcmcsIGVudikpXG4gICAgICApXG4gICAgICBjYXNlIFwibGV0XCI6e1xuICAgICAgICBsZXQgdmFsOiBWYWx1ZTtcbiAgICAgICAgdHJ5e1xuICAgICAgICAgIHZhbCA9IGV2YWx1YXRlKHRlcm0uY29udGVudC52YWx1ZSwgZW52KTtcbiAgICAgICAgfWNhdGNoKGUpe1xuICAgICAgICAgIHZhbCA9IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IGUgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSwgY29udGVudDogXCJcIn0pXG4gICAgICAgICAgdmFsLnNwYW4gPSB0ZXJtLmNvbnRlbnQudmFsdWUuc3BhblxuICAgICAgICAgIHRlcm0uY29udGVudC52YWx1ZSA9IHZhbFxuICAgICAgICAgIHJldHVybiBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQuYm9keSwgZW52KVxuICAgICAgICB9XG4gICAgICAgIGFubm90KHRlcm0uY29udGVudC52YXIsIHZhbC50eXBlKVxuICAgICAgICByZXR1cm4gZXZhbHVhdGUodGVybS5jb250ZW50LmJvZHksIHsuLi5lbnYsIFt0ZXJtLmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZV06IHtiaW5kZXI6IHRlcm0uY29udGVudC52YXIsIHZhbCx9fSlcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJudW1iZXJcIjogcmV0dXJuIGFubm90KHRlcm0sIE5VTUJFUilcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjogcmV0dXJuIHRlcm1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgZXZhbHVhdGUgdGVybSBvZiB0eXBlICR7dGVybS4kfWApXG4gIH1cblxuICBsZXQgcmVzID0gZ28odGVybSwgZW52KVxuICBhbm5vdCh0ZXJtLCByZXMudHlwZSlcbiAgcmV0dXJuIHJlc1xuXG5cbn1cbmV2YWx1YXRlID0gZGVidWdDYWxsKGV2YWx1YXRlKVxuXG5jb25zdCBhcHBseSA9IChmbjogVmFsdWUsIGFyZ3M6IFZhbHVlW10pOiBWYWx1ZSA9PiB7XG4gIGlmIChmbi4kID09IFwiZnVuY3Rpb25cIil7XG4gICAgaWYgKGZuLmNvbnRlbnQudmFycy5sZW5ndGggIT0gYXJncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtmbi5jb250ZW50LnZhcnMubGVuZ3RofSBhcmd1bWVudHMsIGdvdCAke2FyZ3MubGVuZ3RofWApXG4gICAgbGV0IGVudiA9IHsuLi5mbi5jb250ZW50LmVudn1cbiAgICBmbi5jb250ZW50LnZhcnMuZm9yRWFjaCgoYmluZGVyLGkpPT4gZW52W2JpbmRlci5jb250ZW50Lm5hbWVdID0geyBiaW5kZXIsIHZhbDogYXJnc1tpXX0pXG4gICAgcmV0dXJuIGV2YWx1YXRlKGZuLmNvbnRlbnQuYm9keSwgZW52KVxuICB9XG4gIFxuICBpZiAoZm4uJCA9PSBcInZhclwiKXtcbiAgICBsZXQgbmFtZSA9IGZuLmNvbnRlbnQubmFtZVxuICAgIGlmIChidWlsdGluc1tuYW1lIGFzIEJ1aWx0aW5LZXldKSByZXR1cm4gYnVpbHRpbnNbbmFtZSBhcyBCdWlsdGluS2V5XS5pbXBsKC4uLmFyZ3MpXG4gIH1cblxuICBsZXQgcmVzIDogVmFsdWUgPSBta0FzdChcImFwcFwiLCB7Zm4sIGFyZ3N9KVxuICByZXR1cm4gcmVzXG59XG5cbmxldCBjb3VudGVyID0gMDtcblxubGV0IHJlYWRiYWNrID0gKHZhbDogVmFsdWUpOiBBU1QgPT4ge1xuICBpZiAodmFsLiQgPT0gXCJmdW5jdGlvblwiKXtcbiAgICBsZXQgdmFycyA9IHZhbC5jb250ZW50LnZhcnMubWFwKHg9PiBhbm5vdChta3Zhcih4LmNvbnRlbnQubmFtZSArIFwiX1wiICsgY291bnRlcisrKSwgeC50eXBlKSlcbiAgICByZXR1cm4gbWtmdW4odmFycywgcmVhZGJhY2soYXBwbHkodmFsLCB2YXJzKSkpXG4gIH1cbiAgaWYgKHZhbC4kID09IFwiYXBwXCIpIHJldHVybiBta2FwcChyZWFkYmFjayh2YWwuY29udGVudC5mbiksIHZhbC5jb250ZW50LmFyZ3MubWFwKHJlYWRiYWNrKSlcbiAgcmV0dXJuIHZhbFxufVxuXG5yZWFkYmFjayA9IGRlYnVnQ2FsbChyZWFkYmFjaylcblxuZXhwb3J0IGNvbnN0IHJ1biA9IChhc3Q6IEFTVCkgPT4ge1xuICBjb3VudGVyID0wXG4gIHJldHVybiByZWFkYmFjayhldmFsdWF0ZShhc3QsIHt9KSlcbn1cblxuIiwKICAgICJcblxuXG5cbmltcG9ydCB7IGJvZHksIGh0bWwsIHNwYW4gLCBmcm9tSFRNTCwgaDIsIGRpdn0gZnJvbSBcIi4vaHRtbFwiO1xuaW1wb3J0IHsgZWRpdG9yIH0gZnJvbSBcIi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBidWlsZEFzdE1hcCwgcGFyc2UsIHR5cGUgQVNULCB0eXBlIFNwYW4sIHR5cGUgU3ludGF4Tm9kZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgZ2V0ZGVmIH0gZnJvbSBcIi4vbHNwXCJcbmltcG9ydCB7IEFOWSwgcHJldHR5QVNULCBydW4gfSBmcm9tIFwiLi9ydW50aW1lXCJcbmltcG9ydCB7IGNvbG9yIH0gZnJvbSBcIi4vaHRtbFwiO1xuXG5cblxuY29uc3QgYWJvdXRfdGV4dCA6IHN0cmluZyA9IGBcblxuLy8gVGhpcyBpcyBhIHRveSBjb2RlIGVkaXRvciBzdGlsbCBpbiBkZXZlbG9wbWVudC5cblxuLy8gdGhlIGdvYWwgaXMgdG8gYnVpbGQgYSBsYW5ndWFnZSB3aXRoOlxuXG4vLyBleHRyZW1lbHkgbWluaW1hbCBzeW50YXhcbi8vIGZpcnN0IGNsYXNzIHN1cHBvcnQgZm9yIHR5cGVzIGFzIHZhbHVlc1xuLy8gZmlyc3QgY2FzcyBMU1AgcHJvZ3JhbW5nIGluIGEgc3RyYWlnaHRmb3J3YXJkIHdheS5cblxuLy8gaG92ZXIgb3ZlciB4IHRvIHNlZSBpdHMgaW5mZXJyZWQgdHlwZVxubGV0IG4gPSAyMiBpblxuXG4vLyB0aGlzIGlzIGhvdyB0eXBlcyBhcmUgYW5ub3RhdGVkLiB0eXBlcyBhcmUgZXNzZW50aWFsbHkganVzdCBmdW5jdGlvbnMgb3ZlciB2YWx1ZXMuXG5sZXQgayA9IChudW1iZXIgMzMpIGluXG5sZXQgdSA9IChzdHJpbmcgXCJobGxvXCIpIGluXG5cbi8vIHVudHlwZWQgaWRcbmxldCBpZCA9IGZuIHggPT4geCBpblxuXG4vLyBudW1iZXIgdHlwZWQgaWRcbmxldCBpZG4gPSBmbiB4ID0+IChudW1iZXIgeCkgaW5cblxuLy8gdHlwZSBvZiBudW1iZXIgLT4gbnVtYmVyXG5sZXQgVCA9IGZuIGYgPT4gZm4gKG51bWJlciB4KSA9PiAobnVtYmVyIChmIHgpKSBpblxuXG5sZXQgX2lkID0gKFQgaWQpIGluXG5cbi8vbGV0IGJhZCA9IChfaWQgXCJlXCIpIGluXG5cbmxldCByID0gKGlkIFwiMlwiKSBpblxuXG4vLyB0aGlzIGlzIHdpbGwgcmVzdWx0IGluIHR5cGUgZXJyb3IuXG4vLyBsZXQgQkFEID0gKGlkbl8gXCIyXCIpIGluXG5cbihudW1iZXIgc3QpXG5gO1xuXG5cblxuXG5sZXQgb3V0dmlldyA9IGh0bWwoJ3ByZScpKCkuc3R5bGUoe1xuICBib3JkZXJUb3A6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICBwYWRkaW5nVG9wOiBcIjE2cHhcIixcbn0pXG5cbmxldCBhc3Q6IEFTVCB8IHVuZGVmaW5lZFxubGV0IGN1cnJlbnRBc3RNYXA6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gW11cblxuXG5sZXQgY29kZTpzdHJpbmcgPSAnJ1xuXG5sZXQgRWRpdCA9IGVkaXRvcihcbiAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJsaW5lc1wiKSA/PyBhYm91dF90ZXh0LFxuICAoY29kZSk9PiB7XG4gICAgdHJ5e1xuXG4gICAgICBsZXQgcGFyc2VkID0gcGFyc2UoY29kZSlcbiAgICAgIGFzdCA9IHBhcnNlZC5hc3RcbiAgICAgIGNvZGUgPSBjb2RlXG4gICAgICBcbiAgICAgIGxldCByZXMgPSBydW4oYXN0KVxuXG4gICAgICBjdXJyZW50QXN0TWFwID0gYnVpbGRBc3RNYXAoYXN0LCBwYXJzZWQuY29tbWVudHMpXG5cbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBwcmV0dHlBU1QocmVzKVxuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJsaW5lc1wiLCBjb2RlKVxuXG4gICAgfWNhdGNoKGUpe1xuICAgICAgYXN0ID0gdW5kZWZpbmVkXG4gICAgICBjdXJyZW50QXN0TWFwID0gW11cbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSlcbiAgICB9XG4gIH0sXG4gICgpPT4gY3VycmVudEFzdE1hcCxcbiAgKHJlcSkgPT4ge1xuICAgIGxldCBkZWYgPSByZXEuJCA9PSBcInZhclwiID8gZ2V0ZGVmKGFzdCEsIHJlcSkgOiB1bmRlZmluZWRcbiAgICBpZiAoZGVmKSBFZGl0LnNldEN1cnNvcih7cm93OiBkZWYuc3Bhbi5zdGFydC5saW5lLTEsIGNvbDogZGVmLnNwYW4uc3RhcnQuY29sLTF9KVxuICB9LFxuICAobm9kZSkgPT4ge1xuICAgIGlmIChub2RlLiQgPT09IFwiY29tbWVudFwiKSByZXR1cm4gWycnLCBbXV1cblxuICAgIGxldCBzdHIgPSAobm9kZS4kICsgXCI6IFwiKVxuICAgIGxldCBtYXAgOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IHN0ci5zcGxpdCgnJykubWFwKGM9PiB1bmRlZmluZWQpXG5cbiAgICBsZXQgYXN0OkFTVCA9IG5vZGUudHlwZSA/IG5vZGUudHlwZSA6IEFOWVxuXG4gICAgbGV0IGNvID0gcHJldHR5QVNUKGFzdClcbiAgICAvLyBtYXAucHVzaCguLi5wYXJzZShjbykuYXN0bWFwKVxuICAgIHN0ciArPSBjb1xuXG4gICAgcmV0dXJuIFtzdHIsIG1hcF1cbiAgfVxuKVxuXG5cblxuXG5ib2R5LnN0eWxlKHtwYWRkaW5nOiBcIjQ0cHhcIixmb250RmFtaWx5OiBcInNhbnMtc2VyaWZcIix9KVxuXG5cbmxldCBidXR0biA9ICh0OnN0cmluZywgb25DbGljazooKSA9PiB2b2lkKSA9PiBzcGFuKHQsIG9uQ2xpY2spLnN0eWxlKHtjb2xvcjogXCJncmF5XCIsIGJvcmRlcjogXCIxcHggc29saWQgZ3JheVwiLCBib3JkZXJSYWRpdXM6IFwiNHB4XCIsIHBhZGRpbmc6IFwiMnB4IDRweFwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pXG5cbmJvZHkuYXBwZW5kKFxuICBkaXYoXG4gICAgc3Bhbign4pyI77iOJykuc3R5bGUoe2ZvbnRTaXplOiBcIjNlbVwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pLFxuICAgIHNwYW4oXCJNaUdcIikuc3R5bGUoe2ZvbnRTaXplOiBcIjEuNWVtXCIsIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLCBmb250RmFtaWx5OiBcIm1vbm9zcGFjZVwifSlcbiAgKS5zdHlsZSh7ZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIxNnB4XCIsIGNvbG9yOiBcImdyYXlcIn0pLFxuXG4gIEVkaXQuZWwsXG4gIG91dHZpZXcsXG4gIGJ1dHRuKFwiYWJvdXRcIiwgKCkgPT4gRWRpdC5zZXRUZXh0KGFib3V0X3RleHQpKSxcbiAgYnV0dG4oXCJnaXRodWJcIiwgKCkgPT4gd2luZG93Lm9wZW4oXCJodHRwczovL2dpdGh1Yi5jb20vZGtvcm1hbm4vbXllZGl0b3JcIikpXG4pXG5cblxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQWNPLElBQU0sT0FBTyxDQUF5QyxRQUFVLElBQUksYUFBb0Q7QUFBQSxFQUM3SCxJQUFJLFVBQVUsU0FBUyxLQUFLLE9BQUssT0FBTyxNQUFNLFVBQVU7QUFBQSxFQUN4RCxJQUFJLEtBQUssU0FBVSxTQUFTLGNBQWMsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFJLFNBQVMsT0FBTyxPQUFLLE9BQU8sTUFBTSxVQUFVLENBQXNCO0FBQUEsRUFDN0gsSUFBSTtBQUFBLElBQVMsR0FBRyxHQUFJLFVBQVc7QUFBQSxFQUUvQixPQUFPO0FBQUE7QUFJRixJQUFNLFdBQVksQ0FBMEIsT0FBbUI7QUFBQSxFQUVwRSxJQUFJLE9BQWlCO0FBQUEsSUFDbkIsR0FBRztBQUFBLElBQ0g7QUFBQSxJQUNBLFFBQVEsSUFBSSxhQUE4QjtBQUFBLE1BQ3hDLFNBQVMsUUFBUSxXQUFTO0FBQUEsUUFDeEIsSUFBSSxPQUFPLFVBQVU7QUFBQSxVQUFVLEdBQUcsWUFBWSxTQUFTLGVBQWUsS0FBSyxDQUFDO0FB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QUMsSUFBSSxDQUFDLENBQUM7QUFBQSxFQUV4QyxJQUFJLE1BQU8sS0FBSyxJQUFJO0FBQUEsRUFDcEIsSUFBSSxNQUFtQyxJQUFJLE1BQU0sRUFBRSxFQUFFLElBQUksT0FBQztBQUFBLElBQUc7QUFBQSxHQUFTO0FBQUEsRUFFdEUsSUFBSSxPQUFVLEtBQUssT0FBTyxLQUFLLE9BQU87QUFBQSxFQUV0QyxJQUFJLEtBQUssVUFBVSxJQUFHO0FBQUEsRUFFdEIsT0FBTztBQUFBLEVBRVAsT0FBTyxDQUFDLEtBQUssR0FBRztBQUFBLENBRXBCO0FBS0EsS0FBSyxNQUFNLEVBQUMsU0FBUyxRQUFPLFlBQVksYUFBYSxDQUFDO0FBR3RELElBQUksUUFBUSxDQUFDLEdBQVUsWUFBdUIsS0FBSyxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUMsT0FBTyxRQUFRLFFBQVEsa0JBQWtCLGNBQWMsT0FBTyxTQUFTLFdBQVcsYUFBYSxNQUFLLENBQUM7QUFFM0ssS0FBSyxPQUNILElBQ0UsS0FBSyxJQUFHLEVBQUUsTUFBTSxFQUFDLFVBQVUsT0FBTyxhQUFhLE1BQUssQ0FBQyxHQUNyRCxLQUFLLEtBQUssRUFBRSxNQUFNLEVBQUMsVUFBVSxTQUFTLFlBQVksUUFBUSxZQUFZLFlBQVcsQ0FBQyxDQUNwRixFQUFFLE1BQU0sRUFBQyxTQUFTLFFBQVEsWUFBWSxVQUFVLGNBQWMsUUFBUSxPQUFPLE9BQU0sQ0FBQyxHQUVwRixLQUFLLElBQ0wsU0FDQSxNQUFNLFNBQVMsTUFBTSxLQUFLLFFBQVEsVUFBVSxDQUFDLEdBQzdDLE1BQU0sVUFBVSxNQUFNLE9BQU8sS0FBSyxzQ0FBc0MsQ0FBQyxDQUMzRTsiLAogICJkZWJ1Z0lkIjogIjQ1OThBMjk3MEExQkVFMTM2NDc1NkUyMTY0NzU2RTIxIiwKICAibmFtZXMiOiBbXQp9
