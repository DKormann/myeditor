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
        return mkAst("function", { ...term2.content, env: env2 });
      case "app":
        return apply(evaluate(term2.content.fn, env2), term2.content.args.map((arg) => evaluate(arg, env2)));
      case "let": {
        let val = evaluate(term2.content.value, env2);
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
  return mkAst("app", { fn, args });
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
DEBUG = 1;
{
  let ast = run(parse("fn (number x)=> x").ast);
}
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
var ast;
var currentAstMap = [];
var Edit = editor(localStorage.getItem("lines") ?? about_text, (code) => {
  try {
    let parsed = parse(code);
    ast = parsed.ast;
    currentAstMap = parsed.astmap;
    code = code;
    let res = run(ast);
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
  map.push(...parse(co).astmap);
  str += co;
  return [str, map];
});
body.style({ padding: "44px", fontFamily: "sans-serif" });
var buttn = (t, onClick) => span(t, onClick).style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", marginRight: "8px" });
body.append(div(span("✈︎").style({ fontSize: "3em", marginRight: "8px" }), span("MiG").style({ fontSize: "1.5em", fontWeight: "bold", fontFamily: "monospace" })).style({ display: "flex", alignItems: "center", marginBottom: "16px", color: "gray" }), Edit.el, outview, buttn("about", () => Edit.setText(about_text)), buttn("github", () => window.open("https://github.com/dkormann/myeditor")));

//# debugId=EC446723FC2E121064756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCk9PiBOT0RFLFxuICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IE5PREU8SD4sXG4gIGFzc2lnbjogKGh0bWxQcm9wczogUGFydGlhbDxIVE1MRWxlbWVudD4pID0+IE5PREVcbn1cblxuZXhwb3J0IHR5cGUgQVJHID0gTk9ERSB8IHN0cmluZyB8ICgoZTpNb3VzZUV2ZW50KT0+dm9pZClcblxuZXhwb3J0IGNvbnN0IGh0bWwgPSA8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4gKHRhZzpLKSA9PiAoLi4uY2hpbGRyZW46QVJHW10pOiBOT0RFIDxIVE1MRWxlbWVudFRhZ05hbWVNYXBbS10+ID0+IHtcbiAgbGV0IG9uY2xpY2sgPSBjaGlsZHJlbi5maW5kKGMgPT4gdHlwZW9mIGMgPT09IFwiZnVuY3Rpb25cIikgYXMgRnVuY3Rpb25cbiAgbGV0IGVsID0gZnJvbUhUTUwgKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSkuYXBwZW5kKC4uLiBjaGlsZHJlbi5maWx0ZXIoYyA9PiB0eXBlb2YgYyAhPT0gXCJmdW5jdGlvblwiKSBhcyAoTk9ERSB8IHN0cmluZylbXSkgYXMgTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPjtcbiAgaWYgKG9uY2xpY2spIGVsLmVsLiBvbmNsaWNrID0gKG9uY2xpY2sgYXMgKGU6TW91c2VFdmVudCk9PnZvaWQpXG4gIFxuICByZXR1cm4gZWxcbn1cblxuXG5leHBvcnQgY29uc3QgZnJvbUhUTUwgID0gPEggZXh0ZW5kcyBIVE1MRWxlbWVudD4gIChlbDpIKTogTk9ERSA8SD4gPT4ge1xuXG4gIGxldCBub2RlIDogTk9ERTxIPiA9IHtcbiAgICAkOiBcIk5PREVcIixcbiAgICBlbCxcbiAgICBhcHBlbmQ6ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBjaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gXCJzdHJpbmdcIikgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpKTtcbiAgICAgICAgZWxzZSBlbC5hcHBlbmRDaGlsZChjaGlsZC5lbCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG4gICAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCkgPT4ge1xuICAgICAgZWwub25jbGljayA9IGZcbiAgICAgIHJldHVybiBub2RlXG4gICAgfSxcbiAgICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGVsLnJlcGxhY2VDaGlsZHJlbigpXG4gICAgICByZXR1cm4gbm9kZS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gICAgfSxcbiAgICBzdHlsZTogKHN0eWxlczogUGFydGlhbDxDU1NTdHlsZURlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgc3R5bGVzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfSxcbiAgICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiB7XG4gICAgICBPYmplY3QuYXNzaWduKGVsLCBodG1sUHJvcHMpO1xuICAgICAgcmV0dXJuIGZyb21IVE1MKGVsKTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBub2RlXG59XG5cblxuZXhwb3J0IGNvbnN0IGRpdiA9IGh0bWwoXCJkaXZcIik7XG5leHBvcnQgY29uc3Qgc3BhbiA9IGh0bWwoXCJzcGFuXCIpO1xuZXhwb3J0IGNvbnN0IHAgPSBodG1sKFwicFwiKTtcbmV4cG9ydCBjb25zdCBib2R5ID0gZnJvbUhUTUwoZG9jdW1lbnQuYm9keSk7XG5leHBvcnQgY29uc3QgaDEgPSBodG1sKFwiaDFcIik7XG5leHBvcnQgY29uc3QgaDIgPSBodG1sKFwiaDJcIik7XG5leHBvcnQgY29uc3QgaDMgPSBodG1sKFwiaDNcIik7XG5leHBvcnQgY29uc3QgaDQgPSBodG1sKFwiaDRcIik7XG5leHBvcnQgY29uc3QgdGFibGUgPSBodG1sKFwidGFibGVcIik7XG5leHBvcnQgY29uc3QgdHIgPSBodG1sKFwidHJcIik7XG5leHBvcnQgY29uc3QgdGQgPSBodG1sKFwidGRcIik7XG5leHBvcnQgY29uc3QgcHJlID0gaHRtbChcInByZVwiKVxuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNmVlZWZmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMjIyMTIyO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZjEwZjIyO1xuICAgICAgLS1ncmVlbjogIzU0YzgwMTtcbiAgICAgIC0tYmx1ZTogIzFmMzJmZjtcbiAgICAgIC0teWVsbG93OiAjZDM5ZTNkO1xuICAgICAgLS1icm93bjogI2M1NWQwMDtcbiAgICAgIC0tcHVycGxlOiAjYTYxZmQwO1xuICAgICAgLS1jeWFuOiAjMGJhZWJjO1xuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuZXhwb3J0IGNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IGFueSk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJcblxuXG5leHBvcnQgdHlwZSBQb3MgPSB7b2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXJ9XG5leHBvcnQgdHlwZSBTcGFuID0ge3N0YXJ0OiBQb3MsIGVuZDogUG9zfVxuXG5leHBvcnQgdHlwZSBUYWcgPFQgZXh0ZW5kcyBzdHJpbmcsIEM+ID0geyQ6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4sIHR5cGU/OiBBU1R9XG5cbmV4cG9ydCB0eXBlIFZhciA9IFRhZzxcInZhclwiLCB7bmFtZTogc3RyaW5nfT5cbmV4cG9ydCB0eXBlIENvbW1lbnQgPSBUYWc8XCJjb21tZW50XCIsIHN0cmluZz5cbmV4cG9ydCB0eXBlIEZ1bmMgPSBUYWc8XCJmdW5jdGlvblwiLCB7dmFyczogVmFyW10sIGJvZHk6IEFTVH0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIFByaW0gPSBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPiB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFByaW1cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSwgYXN0bWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXX1cblxuXG5cbmNvbnN0IHplcm9Qb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9KVxuY29uc3QgemVyb1NwYW4gPSAoKTogU3BhbiA9PiAoe3N0YXJ0OiB6ZXJvUG9zKCksIGVuZDogemVyb1BvcygpfSlcblxuZXhwb3J0IGNvbnN0IG1rQXN0ID0gPFQgZXh0ZW5kcyBzdHJpbmcsIEM+KHRhZzogVCwgY29udGVudDogQywgc3BhbjogU3BhbiA9IHplcm9TcGFuKCkpOiBUYWc8VCwgQz4gPT4gKHskOiB0YWcsIGNvbnRlbnQsIHNwYW59KVxuXG50eXBlIFRva2VuQmFzZSA9IHtzcGFuOiBTcGFufVxuXG50eXBlIFRva2VuID1cbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiaWRlbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogbnVtYmVyfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiYXJyb3dcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImNvbW1lbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30pXG5cbnR5cGUgVG9rZW5Ob1NwYW4gPSBUb2tlbiBleHRlbmRzIGluZmVyIFQgPyBUIGV4dGVuZHMge3NwYW46IFNwYW59ID8gT21pdDxULCBcInNwYW5cIj4gOiBuZXZlciA6IG5ldmVyXG5cbmNvbnN0IHRva2VuaXplID0gKGNvZGU6IHN0cmluZyk6IHt0b2tlbnM6IFRva2VuW10sIGNvbW1lbnRzOiBDb21tZW50W10sIGVvZjogUG9zfSA9PiB7XG4gIGxldCB0b2tlbnM6IFRva2VuW10gPSBbXVxuICBsZXQgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdXG4gIGxldCBpID0gMFxuICBsZXQgbGluZSA9IDFcbiAgbGV0IGNvbCA9IDFcblxuICBsZXQgaXNBbHBoYSA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16X10vLnRlc3QoY2hhcilcbiAgbGV0IGlzRGlnaXQgPSAoY2hhcjogc3RyaW5nKSA9PiAvWzAtOV0vLnRlc3QoY2hhcilcbiAgbGV0IGlzSWRlbnQgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtejAtOV9dLy50ZXN0KGNoYXIpXG4gIGxldCBwb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiBpLCBsaW5lLCBjb2x9KVxuICBsZXQgYWR2YW5jZSA9ICgpID0+IHtcbiAgICBpZiAoY29kZVtpXSA9PT0gXCJcXG5cIikge1xuICAgICAgaSsrXG4gICAgICBsaW5lKytcbiAgICAgIGNvbCA9IDFcbiAgICB9IGVsc2Uge1xuICAgICAgaSsrXG4gICAgICBjb2wrK1xuICAgIH1cbiAgfVxuICBsZXQgcHVzaCA9ICh0b2tlbjogVG9rZW5Ob1NwYW4sIHN0YXJ0OiBQb3MpID0+IHtcbiAgICB0b2tlbnMucHVzaCh7Li4udG9rZW4sIHNwYW46IHtzdGFydCwgZW5kOiBwb3MoKX19IGFzIFRva2VuKVxuICB9XG5cbiAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgIGxldCBjaGFyID0gY29kZVtpXVxuXG4gICAgaWYgKC9cXHMvLnRlc3QoY2hhcikpIHtcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCIvXCIgJiYgY29kZVtpICsgMV0gPT09IFwiL1wiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgY29kZVtpXSAhPT0gXCJcXG5cIikgYWR2YW5jZSgpXG4gICAgICBjb21tZW50cy5wdXNoKG1rQXN0KFwiY29tbWVudFwiLCBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSksIHtzdGFydCwgZW5kOiBwb3MoKX0pKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCI9XCIgJiYgY29kZVtpICsgMV0gPT09IFwiPlwiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwiYXJyb3dcIn0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoXCIoKXt9PSw6XCIuaW5jbHVkZXMoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWUgPSBjaGFyIGFzIFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBcIlwiXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gY29kZVtpXVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICBsZXQgbmV4dCA9IGNvZGVbaSArIDFdXG4gICAgICAgICAgaWYgKG5leHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBlc2NhcGVcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBlc2NhcGVkID0gKHtuOiBcIlxcblwiLCByOiBcIlxcclwiLCB0OiBcIlxcdFwiLCAnXCInOiAnXCInLCBcIlxcXFxcIjogXCJcXFxcXCJ9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pW25leHRdXG4gICAgICAgICAgdmFsdWUgKz0gZXNjYXBlZCA/PyBuZXh0XG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gJ1wiJykgYnJlYWtcbiAgICAgICAgdmFsdWUgKz0gY3VycmVudFxuICAgICAgICBhZHZhbmNlKClcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlW2ldICE9PSAnXCInKSB7XG4gICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGxpdGVyYWxcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgIH1cbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzRGlnaXQoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNEaWdpdChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogTnVtYmVyKGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSkpfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0FscGhhKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzSWRlbnQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKVxuICAgICAgaWYgKHZhbHVlID09PSBcImxldFwiIHx8IHZhbHVlID09PSBcImluXCIgfHwgdmFsdWUgPT09IFwiZm5cIikgcHVzaCh7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBlbHNlIHB1c2goe3R5cGU6IFwiaWRlbnRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICBhZHZhbmNlKClcbiAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IGBVbmV4cGVjdGVkIGNoYXJhY3RlcjogJHtjaGFyfWAsIGNvbnRlbnQ6IGNoYXJ9LCBzdGFydClcbiAgfVxuXG4gIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbn1cblxuY2xhc3MgUGFyc2VyIHtcbiAgcHJpdmF0ZSBpID0gMFxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdG9rZW5zOiBUb2tlbltdLCBwcml2YXRlIHNvdXJjZTogc3RyaW5nLCBwcml2YXRlIGVvZjogUG9zKSB7fVxuXG4gIHBhcnNlKCk6IEFTVCB7XG4gICAgbGV0IGFzdCA9IHRoaXMucGFyc2VFeHByKClcbiAgICBpZiAodGhpcy5wZWVrKCkpIHtcbiAgICAgIGxldCBzdGFydCA9IHRoaXMucGVlaygpIS5zcGFuLnN0YXJ0XG4gICAgICBsZXQgZW5kID0gdGhpcy50b2tlbnNbdGhpcy50b2tlbnMubGVuZ3RoIC0gMV0/LnNwYW4uZW5kID8/IHN0YXJ0XG4gICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbmV4cGVjdGVkIGV4dHJhIGlucHV0IGFmdGVyIGV4cHJlc3Npb25cIiwge3N0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICByZXR1cm4gYXN0XG4gIH1cblxuICBwcml2YXRlIHBhcnNlRXhwcigpOiBBU1Qge1xuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImxldFwiKSkgcmV0dXJuIHRoaXMucGFyc2VMZXQoKVxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImZuXCIpKSByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKClcbiAgICByZXR1cm4gdGhpcy5wYXJzZUF0b20oKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldCgpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImxldFwiKS5zcGFuLnN0YXJ0XG4gICAgbGV0IHZhcmlhYmxlID0gdGhpcy5wYXJzZUxldEJpbmRlcigpXG4gICAgaWYgKHZhcmlhYmxlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIHZhcmlhYmxlXG5cbiAgICBsZXQgdmFsdWU6IEFTVFxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiPVwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCI9XCIpXG4gICAgICB2YWx1ZSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIpXG4gICAgfVxuXG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImluXCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdEtleXdvcmQoXCJpblwiKVxuICAgICAgYm9keSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIpXG4gICAgfVxuXG4gICAgcmV0dXJuIG1rQXN0KFwibGV0XCIsIHt2YXI6IHZhcmlhYmxlLCB2YWx1ZSwgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VGdW5jdGlvbigpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImZuXCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyczogVmFyW10gPSBbXVxuICAgIHdoaWxlICh0aGlzLnBlZWsoKT8udHlwZSA9PT0gXCJpZGVudFwiIHx8IHRoaXMuaXNTeW1ib2woXCIoXCIpKSB7XG4gICAgICBsZXQgYmluZGVyID0gdGhpcy5wYXJzZUJpbmRlcigpXG4gICAgICBpZiAoYmluZGVyLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHk6IGJpbmRlcn0sIHtzdGFydCwgZW5kOiBiaW5kZXIuc3Bhbi5lbmR9KVxuICAgICAgdmFycy5wdXNoKGJpbmRlcilcbiAgICB9XG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh2YXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKHRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSBib2R5ID0gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpXG4gICAgICBlbHNlIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCBzdGFydClcbiAgICB9IGVsc2UgaWYgKCF0aGlzLm1hdGNoVG9rZW4oXCJhcnJvd1wiKSkge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPT4nIGFmdGVyIGZ1bmN0aW9uIHBhcmFtZXRlcnNcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH1cbiAgICByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBdG9tKCk6IEFTVCB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dFwiKVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiaWRlbnRcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInZhclwiLCB7bmFtZTogdG9rZW4udmFsdWV9LCB0b2tlbi5zcGFuKVxuICAgIH1cblxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJudW1iZXJcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJzdHJpbmdcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogdG9rZW4ubWVzc2FnZSwgY29udGVudDogdG9rZW4uY29udGVudH0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCIoXCIpKSByZXR1cm4gdGhpcy5wYXJzZVBhcmVucygpXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCJ7XCIpKSByZXR1cm4gdGhpcy5wYXJzZVJlY29yZCgpXG5cbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShgVW5leHBlY3RlZCB0b2tlbjogJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB0b2tlbi5zcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVBhcmVucygpOiBBU1Qge1xuICAgIGxldCBvcGVuID0gdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgbGV0IGl0ZW1zOiBBU1RbXSA9IFtdXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gaXRlbXMubGVuZ3RoID4gMCA/IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGl0ZW1zLnB1c2godGhpcy5wYXJzZUV4cHIoKSlcbiAgICB9XG4gICAgbGV0IGNsb3NlID0gdGhpcy5leHBlY3RTeW1ib2woXCIpXCIpXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiRW1wdHkgcGFyZW50aGVzZXMgYXJlIG5vdCBhbGxvd2VkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgY2xvc2Uuc3Bhbi5lbmQub2Zmc2V0KSlcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAxKSByZXR1cm4gaXRlbXNbMF1cbiAgICByZXR1cm4gbWtBc3QoXCJhcHBcIiwge2ZuOiBpdGVtc1swXSwgYXJnczogaXRlbXMuc2xpY2UoMSl9LCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVjb3JkKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIntcIilcbiAgICBsZXQgZmllbGRzOiBbVmFyLCBBU1RdW10gPSBbXVxuXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcmVjb3JkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkge1xuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKSFcbiAgICAgICAgdGhpcy5pKytcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBFeHBlY3RlZCByZWNvcmQgZmllbGQgbmFtZSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YCwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogdG9rZW4uc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCB0b2tlbi5zcGFuLmVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IGtleSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgbGV0IHZhbHVlID0gdGhpcy5pc1N5bWJvbChcIjpcIilcbiAgICAgICAgPyAodGhpcy5leHBlY3RTeW1ib2woXCI6XCIpLCB0aGlzLmlzU3ltYm9sKFwifVwiKSA/IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiKSA6IHRoaXMucGFyc2VFeHByKCkpXG4gICAgICAgIDoga2V5XG4gICAgICBmaWVsZHMucHVzaChba2V5LCB2YWx1ZV0pXG4gICAgICBpZiAodGhpcy5pc1N5bWJvbChcIixcIikpIHRoaXMuaSsrXG4gICAgICBlbHNlIGJyZWFrXG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgbGV0IGVuZCA9IGZpZWxkcy5sZW5ndGggPiAwID8gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXVsxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIn1cIilcbiAgICByZXR1cm4gbWtBc3QoXCJyZWNvcmRcIiwgZmllbGRzLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlQmluZGVyKCk6IFZhciB8IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+IHtcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKFwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgaWRlbnRpZmllciBpbiBiaW5kZXIgcGF0dGVyblwiKVxuICAgICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJyknIGFmdGVyIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICAgIHZhcmlhYmxlLnR5cGUgPSBkZWNsYXJlZFR5cGVcbiAgICAgIHJldHVybiB2YXJpYWJsZVxuICAgIH1cbiAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyXCIpXG4gICAgbGV0IHZhcmlhYmxlID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI6XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIjpcIilcbiAgICAgIGxldCBkZWNsYXJlZFR5cGUgPSB0aGlzLnBhcnNlQXRvbSgpXG4gICAgICBpZiAoZGVjbGFyZWRUeXBlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGRlY2xhcmVkVHlwZVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgIH1cbiAgICByZXR1cm4gdmFyaWFibGVcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VMZXRCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQmluZGVyKClcbiAgfVxuXG4gIHByaXZhdGUgcGVlaygpOiBUb2tlbiB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMuaV1cbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKTogYm9vbGVhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICByZXR1cm4gdG9rZW4/LnR5cGUgPT09IFwia2V5d29yZFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBpc1N5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJzeW1ib2xcIiAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWVcbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0VG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7dHlwZX0sIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaFRva2VuPEsgZXh0ZW5kcyBUb2tlbltcInR5cGVcIl0+KHR5cGU6IEspOiBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+IHwgdW5kZWZpbmVkIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4gfHwgdG9rZW4udHlwZSAhPT0gdHlwZSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuIGFzIEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT5cbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0S2V5d29yZCh2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIikge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuPy50eXBlICE9PSBcImtleXdvcmRcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQga2V5d29yZCAke3ZhbHVlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RTeW1ib2wodmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwic3ltYm9sXCIgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcke3ZhbHVlfScsIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW5cbiAgfVxuXG4gIHByaXZhdGUgZGVzY3JpYmUodG9rZW46IFRva2VuIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gXCJlbmQgb2YgaW5wdXRcIlxuICAgIGlmIChcInZhbHVlXCIgaW4gdG9rZW4pIHJldHVybiBgJHt0b2tlbi50eXBlfSgke1N0cmluZyh0b2tlbi52YWx1ZSl9KWBcbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJlcnJvclwiKSByZXR1cm4gYGVycm9yKCR7dG9rZW4ubWVzc2FnZX0pYFxuICAgIHJldHVybiB0b2tlbi50eXBlXG4gIH1cblxuICBwcml2YXRlIGVycm9yTm9kZShtZXNzYWdlOiBzdHJpbmcsIHNwYW4/OiBTcGFuLCBjb250ZW50Pzogc3RyaW5nKTogRXJyb3JOb2RlIHtcbiAgICBsZXQgZmluYWxTcGFuID0gc3BhbiA/PyB0aGlzLnBvaW50U3BhbigpXG4gICAgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2UsIGNvbnRlbnQ6IGNvbnRlbnQgPz8gdGhpcy5zb3VyY2Uuc2xpY2UoZmluYWxTcGFuLnN0YXJ0Lm9mZnNldCwgZmluYWxTcGFuLmVuZC5vZmZzZXQpfSwgZmluYWxTcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvckhlcmUobWVzc2FnZTogc3RyaW5nLCBzdGFydD86IFBvcyk6RXJyb3JOb2RlIHtcbiAgICBsZXQgc3BhbiA9IHRoaXMucGVlaygpPy5zcGFuID8/IHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIHtzdGFydDogc3RhcnQgPz8gc3Bhbi5zdGFydCwgZW5kOiBzcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHdyYXBFcnJvcihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEFTVCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIG5vZGUuc3BhbiwgdGhpcy5zb3VyY2Uuc2xpY2Uobm9kZS5zcGFuLnN0YXJ0Lm9mZnNldCwgbm9kZS5zcGFuLmVuZC5vZmZzZXQpKVxuICB9XG5cbiAgcHJpdmF0ZSBwb2ludFNwYW4oKTogU3BhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4pIHJldHVybiB0b2tlbi5zcGFuXG4gICAgcmV0dXJuIHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGJ1aWxkQXN0TWFwID0gKGFzdDogQVNULCBjb21tZW50czogQ29tbWVudFtdID0gW10pOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9PiB7XG4gIGxldCBtYXhFbmQgPSBjb21tZW50cy5yZWR1Y2UoKG0sIGMpID0+IGMuc3Bhbi5lbmQub2Zmc2V0ID4gbSA/IGMuc3Bhbi5lbmQub2Zmc2V0IDogbSwgYXN0LnNwYW4uZW5kLm9mZnNldClcbiAgbGV0IHJlczogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBBcnJheS5mcm9tKHtsZW5ndGg6IG1heEVuZH0sICgpPT51bmRlZmluZWQpXG4gIGNvbnN0IHdhbGsgPSAobm9kZTogQVNUKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IG5vZGUuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBub2RlLnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBub2RlXG4gICAgY2hpbGRyZW4obm9kZSkuZm9yRWFjaCh3YWxrKVxuICB9XG4gIHdhbGsoYXN0KVxuICBjb21tZW50cy5mb3JFYWNoKGNvbW1lbnQgPT4ge1xuICAgIGZvciAobGV0IGkgPSBjb21tZW50LnNwYW4uc3RhcnQub2Zmc2V0OyBpIDwgY29tbWVudC5zcGFuLmVuZC5vZmZzZXQ7IGkrKykgcmVzW2ldID0gY29tbWVudFxuICB9KVxuICByZXR1cm4gcmVzXG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZSA9IChjb2RlOnN0cmluZyk6IFBhcnNlUmVzdWx0ID0+IHtcbiAgbGV0IHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Z9ID0gdG9rZW5pemUoY29kZSlcbiAgbGV0IGFzdCA9IG5ldyBQYXJzZXIodG9rZW5zLCBjb2RlLCBlb2YpLnBhcnNlKClcbiAgcmV0dXJuIHthc3QsIGNvbW1lbnRzLCBhc3RtYXA6IGJ1aWxkQXN0TWFwKGFzdCwgY29tbWVudHMpfVxufVxuXG5leHBvcnQgY29uc3QgcGFyc2VBU1QgPSAoY29kZTpzdHJpbmcpOiBBU1QgPT4gcGFyc2UoY29kZSkuYXN0XG5cbmV4cG9ydCBjb25zdCBjaGlsZHJlbiA9IChub2RlOiBBU1QpOiBBU1RbXSA9PiB7XG4gIGlmIChub2RlLiQgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFsuLi5ub2RlLmNvbnRlbnQudmFycywgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwiYXBwXCIpIHJldHVybiBbbm9kZS5jb250ZW50LmZuLCAuLi5ub2RlLmNvbnRlbnQuYXJnc11cbiAgaWYgKG5vZGUuJCA9PT0gXCJsZXRcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQudmFyLCBub2RlLmNvbnRlbnQudmFsdWUsIG5vZGUuY29udGVudC5ib2R5XVxuICBpZiAobm9kZS4kID09PSBcInJlY29yZFwiKSByZXR1cm4gbm9kZS5jb250ZW50LmZsYXRNYXAoKFtrZXksIHZhbHVlXSkgPT4gW2tleSwgdmFsdWVdKVxuICByZXR1cm4gW11cbn1cblxuY29uc3Qgc3RyaXBTcGFucyA9IChhc3Q6IEFTVCk6IHVua25vd24gPT4ge1xuICBpZiAoYXN0LiQgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge3ZhcnM6IGFzdC5jb250ZW50LnZhcnMubWFwKHN0cmlwU3BhbnMpLCBib2R5OiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmJvZHkpfX1cbiAgaWYgKGFzdC4kID09PSBcImFwcFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7Zm46IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuZm4pLCBhcmdzOiBhc3QuY29udGVudC5hcmdzLm1hcChzdHJpcFNwYW5zKX19XG4gIGlmIChhc3QuJCA9PT0gXCJsZXRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge3Zhcjogc3RyaXBTcGFucyhhc3QuY29udGVudC52YXIpLCB2YWx1ZTogc3RyaXBTcGFucyhhc3QuY29udGVudC52YWx1ZSksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwicmVjb3JkXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50Lm1hcCgoW25hbWUsIHZhbHVlXSkgPT4gW3N0cmlwU3BhbnMobmFtZSksIHN0cmlwU3BhbnModmFsdWUpXSl9XG4gIGlmIChhc3QuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbiAgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnR9XG59XG5cblxubGV0IHN0cmluZ2lmeSA9ICh4OiB1bmtub3duKSA9PiBKU09OLnN0cmluZ2lmeSh4LCBudWxsLCAyKVxuXG5jb25zdCB0ZXN0X3BhcnNlID0gKGNvZGU6IHN0cmluZywgZXhwZWN0ZWQ6IEFTVCkgPT4ge1xuICBsZXQgYXN0ID0gcGFyc2VBU1QoY29kZSlcblxuICBpZiAoSlNPTi5zdHJpbmdpZnkoc3RyaXBTcGFucyhhc3QpKSAhPT0gSlNPTi5zdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlRlc3QgZmFpbGVkIGZvciBjb2RlOlwiLCBjb2RlKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJFeHBlY3RlZDpcIiwgc3RyaW5naWZ5KHN0cmlwU3BhbnMoZXhwZWN0ZWQpKSlcbiAgICBjb25zb2xlLmVycm9yKFwiR290OlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhhc3QpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRlc3QgZmFpbGVkIGZvciBjb2RlOiAke2NvZGV9YClcbiAgfVxufVxuXG5jb25zdCB0ZXN0X3NwYW4gPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogU3BhbikgPT4ge1xuICBsZXQgYXN0ID0gcGFyc2VBU1QoY29kZSlcbiAgaWYgKEpTT04uc3RyaW5naWZ5KGFzdC5zcGFuKSAhPT0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWQpKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBleHBlY3RlZClcbiAgICBjb25zb2xlLmVycm9yKFwiR290OlwiLCBhc3Quc3BhbilcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmV4cG9ydCBsZXQgbWtudW0gPSAobjogbnVtYmVyKSA9PiBta0FzdChcIm51bWJlclwiLCBuKVxuZXhwb3J0IGxldCBta3N0ciA9IChzOiBzdHJpbmcpID0+IG1rQXN0KFwic3RyaW5nXCIsIHMpXG5leHBvcnQgbGV0IG1rdmFyID0gKG5hbWU6IHN0cmluZykgPT4gbWtBc3QoXCJ2YXJcIiwge25hbWV9KVxuZXhwb3J0IGxldCBta2FwcCA9IChmbjogQVNULCBhcmdzOiBBU1RbXSkgPT4gbWtBc3QoXCJhcHBcIiwge2ZuLCBhcmdzfSlcbmV4cG9ydCBsZXQgbWtsZXQgPSAodjogc3RyaW5nIHwgVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1QpID0+IG1rQXN0KFwibGV0XCIsIHt2YXI6IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2LCB2YWx1ZSwgYm9keX0pXG5leHBvcnQgbGV0IG1rZnVuID0gKHZhcnM6IChzdHJpbmcgfCBWYXIpW10sIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFyczogdmFycy5tYXAodiA9PiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IG1rdmFyKHYpIDogdiksIGJvZHl9KSBhcyBGdW5jXG5leHBvcnQgbGV0IGFubm90ID0gKHR5cGU6IEFTVCwgdmFsdWU6IEFTVCkgPT4gbWtBc3QoXCJhbm5vdFwiLCB7dHlwZSwgdmFsdWV9KVxuZXhwb3J0IGxldCBta3JlY29yZCA9IChmaWVsZHM6IHtba2V5IDogc3RyaW5nXSA6IEFTVH0pID0+IG1rQXN0KFwicmVjb3JkXCIsIE9iamVjdC5lbnRyaWVzKGZpZWxkcykubWFwKChbayx2XSk9PiBbbWt2YXIoayksIHZdKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcInhcIjogbWt2YXIoXCJ4XCIpLFxuICBcIjIyXCI6IG1rbnVtKDIyKSxcbiAgJ1wiaGVsbG9cIic6IG1rc3RyKFwiaGVsbG9cIiksXG4gIFwiKGYgeClcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpXSksXG4gIFwiKGYgeCB5KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIiksIG1rdmFyKFwieVwiKV0pLFxuICBcImxldCB4ID0gMjIgaW4geFwiOiBta2xldChcInhcIiwgbWtudW0oMjIpLCBta3ZhcihcInhcIikpLFxuICBcInthOiAyMiwgYjogeH1cIjogbWtyZWNvcmQoe2E6IG1rbnVtKDIyKSwgYjogbWt2YXIoXCJ4XCIpfSksXG4gIFwiZm4geCA9PiB4XCI6IG1rZnVuKFtcInhcIl0sIG1rdmFyKFwieFwiKSksXG4gIFwiZm4geCB5ID0+IHhcIjogbWtmdW4oW1wieFwiLCBcInlcIl0sIG1rdmFyKFwieFwiKSksXG4gIFwibGV0IChudW1iZXIgeCkgPSAyMiBpbiB4XCI6IG1rbGV0KE9iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KSwgbWtudW0oMjIpLCBta3ZhcihcInhcIikpLFxuICBcImZuIChudW1iZXIgeCkgKHN0cmluZyB5KSA9PiB4XCI6IG1rZnVuKFtcbiAgICBPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksXG4gICAgT2JqZWN0LmFzc2lnbihta3ZhcihcInlcIiksIHt0eXBlOiBta3ZhcihcInN0cmluZ1wiKX0pLFxuICBdLCBta3ZhcihcInhcIikpLFxuICBcIntlOjIyfVwiIDogbWtyZWNvcmQoe2U6IG1rbnVtKDIyKX0pLFxuICBcIntlfVwiOiBta3JlY29yZCh7ZTogbWt2YXIoXCJlXCIpfSksXG4gIFwiLy9jb21tZW50XFxuMjJcIjogcGFyc2VBU1QoXCIyMlwiKSxcbn0pLmZvckVhY2goKFtjb2RlLCBleHBlY3RlZF0pID0+IHRlc3RfcGFyc2UoY29kZSwgZXhwZWN0ZWQgYXMgQVNUKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcIihcIjogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIGNvbnRlbnQ6IFwiKFwifSksXG4gIFwibGV0IHggMjIgaW4geFwiOiBta0FzdChcImxldFwiLCB7XG4gICAgdmFyOiBta3ZhcihcInhcIiksXG4gICAgdmFsdWU6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgY29udGVudDogXCIyMlwifSksXG4gICAgYm9keTogbWt2YXIoXCJ4XCIpLFxuICB9KSxcbiAgXCJ7ZTp9XCI6IG1rcmVjb3JkKHtlOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkIHJlY29yZCBmaWVsZCB2YWx1ZSBhZnRlciAnOidcIiwgY29udGVudDogXCJ9XCJ9KX0pLFxuXG59KS5mb3JFYWNoKChbY29kZSwgZXhwZWN0ZWRdKSA9PiB0ZXN0X3BhcnNlKGNvZGUsIGV4cGVjdGVkIGFzIEFTVCkpXG5cbnRlc3Rfc3BhbihcImxldCB4ID0gMjJcXG5pbiB4XCIsIHtcbiAgc3RhcnQ6IHtvZmZzZXQ6IDAsIGxpbmU6IDEsIGNvbDogMX0sXG4gIGVuZDoge29mZnNldDogMTUsIGxpbmU6IDIsIGNvbDogNX0sXG59KVxuIiwKICAgICJpbXBvcnQgeyBBU1QsIFZhciB9IGZyb20gXCIuL3BhcnNlclwiXG5pbXBvcnQge2NoaWxkcmVufSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5cbmV4cG9ydCBjb25zdCBnZXRkZWYgPSAocm9vdDogQVNULCB2YXJpOiBWYXIpOiBBU1QgfCB1bmRlZmluZWQgPT4ge1xuICBpZiAocm9vdC5zcGFuLnN0YXJ0Lm9mZnNldCA+IHZhcmkuc3Bhbi5zdGFydC5vZmZzZXQgfHwgcm9vdC5zcGFuLmVuZC5vZmZzZXQgPCB2YXJpLnNwYW4uZW5kLm9mZnNldCkgcmV0dXJuIHVuZGVmaW5lZFxuICBmb3IgKGxldCBjaGlsZCBvZiBjaGlsZHJlbihyb290KSl7XG4gICAgbGV0IHJlcyA9IGdldGRlZihjaGlsZCwgdmFyaSlcbiAgICBpZiAocmVzKSByZXR1cm4gcmVzXG4gIH1cblxuICBpZiAocm9vdC4kID09PSBcImxldFwiICYmIHJvb3QuY29udGVudC52YXIuY29udGVudC5uYW1lID09PSB2YXJpLmNvbnRlbnQubmFtZSlcbiAgICByZXR1cm4gcm9vdC5jb250ZW50LnZhclxuXG4gIGlmIChyb290LiQgPT09IFwiZnVuY3Rpb25cIilcbiAgICBmb3IgKGxldCB2IG9mIHJvb3QuY29udGVudC52YXJzKVxuICAgICAgaWYgKHYuY29udGVudC5uYW1lID09PSB2YXJpLmNvbnRlbnQubmFtZSlcbiAgICAgICAgcmV0dXJuIHZcbn1cbiIsCiAgICAiaW1wb3J0IHsgY29sb3JPZiB9IGZyb20gXCIuL2VkaXRvclwiXG5pbXBvcnQgeyBib2R5LCBjb2xvciwgZGl2LCBOT0RFLCBwcmUsIHNwYW4gfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7bWtudW0sIFByaW0sIFRhZywgdHlwZSBBU1QsIHR5cGUgRnVuYywgcGFyc2UsIG1rdmFyLCBta2FwcCwgVmFyLCBta0FzdCwgbWtmdW59IGZyb20gXCIuL3BhcnNlclwiXG5cbmV4cG9ydCBsZXQgTlVNQkVSID0gbWt2YXIoXCJudW1iZXJcIilcbmV4cG9ydCBsZXQgU1RSSU5HID0gbWt2YXIoXCJzdHJpbmdcIilcbmV4cG9ydCBsZXQgVFlQRSAgID0gbWt2YXIoXCJ0eXBlXCIpXG5leHBvcnQgbGV0IFRZUEVPRiA9IG1rdmFyKFwidHlwZW9mXCIpXG5cbk5VTUJFUi50eXBlID0gVFlQRVxuU1RSSU5HLnR5cGUgPSBUWVBFXG5UWVBFLnR5cGUgPSBUWVBFXG5UWVBFT0YudHlwZSA9IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0IVxuXG5leHBvcnQgbGV0IEFOWSA6IEFTVCA9IG1rdmFyKFwiYW55XCIpXG5cbmxldCBwcmltaXRpdmVUeXBlID0gKG5hbWU6IHN0cmluZykgPT4gKHtcbiAgdHlwZTogVFlQRSxcbiAgaW1wbDogKHg6IFZhbHVlKSA9PiB7XG4gICAgaWYgKHgudHlwZSkge1xuICAgICAgaWYgKHgudHlwZS4kID09IFwidmFyXCIgJiYgeC50eXBlLmNvbnRlbnQubmFtZSA9PSBuYW1lKSByZXR1cm4geFxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yOiBleHBlY3RlZCAke25hbWV9LCBnb3QgJHsoeC50eXBlKX1gKVxuICAgIH1cbiAgICB4LnR5cGUgPSBta3ZhcihuYW1lKVxuICAgIHJldHVybiB4XG4gIH1cbn0pXG5cbmNvbnN0IGJ1aWx0aW5LZXlzID0gW1wibnVtYmVyXCIsIFwic3RyaW5nXCIsIFwiZXFcIiwgXCJhZGRcIiwgXCJpZmVsc2VcIiwgXCJ0eXBlb2ZcIl0gYXMgY29uc3RcbnR5cGUgQnVpbHRpbktleSA9IHR5cGVvZiBidWlsdGluS2V5c1tudW1iZXJdXG5cbmxldCBidWlsdGluczogUmVjb3JkPEJ1aWx0aW5LZXksIHsgdHlwZTogQVNULCBpbXBsOiAoLi4uYXJnczpWYWx1ZVtdKSA9PiBWYWx1ZSB9PiA9IHtcbiAgbnVtYmVyOiBwcmltaXRpdmVUeXBlKFwibnVtYmVyXCIpLFxuICBzdHJpbmc6IHByaW1pdGl2ZVR5cGUoXCJzdHJpbmdcIiksXG4gIGVxOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIHggeSA9PiAobnVtYmVyIChmIHggeSkpXCIpLmFzdCEsXG4gICAgaW1wbDogKHgseSkgPT4gbWtudW0oXG4gICAgICAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIgJiYgeC5jb250ZW50ID09IHkuY29udGVudCkgfHxcbiAgICAgICh4LiQgPT0gXCJzdHJpbmdcIiAmJiB5LiQgPT0gXCJzdHJpbmdcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fCAoeCA9PSB5KVxuICAgICAgPyAxIDogMClcbiAgfSxcbiAgYWRkOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmPT4gZm4geCB5ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSAobnVtYmVyIHkpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiB7XG4gICAgICBpZiAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIpIHJldHVybiBta251bSh4LmNvbnRlbnQgKyB5LmNvbnRlbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gYWRkOiBleHBlY3RlZCBudW1iZXJzLCBnb3QgJHtwcmV0dHlBU1QoeCl9IGFuZCAke3ByZXR0eUFTVCh5KX1gKVxuICAgIH1cbiAgfSxcbiAgaWZlbHNlIDoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiBUIGNvbmQgdGhlbiBlbHNlID0+IChUIChmIChudW1iZXIgY29uZCkgKFQgdGhlbikgKFQgZWxzZSkpKVwiKS5hc3QhLFxuICAgIGltcGw6IChjb25kLCB0aGVuLCBlbHMpID0+IHtcbiAgICAgIGxldCB2YWwgPSBjb25kLiQgPT0gXCJudW1iZXJcIiA/IGNvbmQuY29udGVudCA6IGNvbmQuJCA9PSBcInN0cmluZ1wiID8gY29uZC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgIHJldHVybiB2YWwgPyB0aGVuIDogZWxzXG4gICAgfVxuICB9LFxuICB0eXBlb2Y6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCA9PiB0eXBlXCIpLmFzdCEsXG4gICAgaW1wbDogKHggOiBWYWx1ZSkgOiBWYWx1ZSA9PiB7XG4gICAgICBpZiAoIXgudHlwZSkgcmV0dXJuIG1rQXN0KFwiYXBwXCIsIHtmbjogVFlQRU9GLCBhcmdzOiBbeF19KVxuICAgICAgcmV0dXJuIGV2YWx1YXRlKHgudHlwZSwge30pXG4gICAgfVxuICB9XG59XG5cbmxldCBERUJVRyA9IDBcbmxldCBsb2dnZXJQcmUgPSBwcmUoKVxuYm9keS5yZXBsYWNlQ2hpbHJlbihsb2dnZXJQcmUpXG5cblxudHlwZSBWaXMgPSBOT0RFIHwgc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCB8IEFTVCB8IFZhbHVlIHwgVmlzW10gfCBudW1iZXJcblxubGV0IGRlYnVnID0gKC4uLmFyZ3M6IFZpc1tdKSA9PiB7XG4gIGlmICghREVCVUcpIHJldHVyblxuICBsZXQgcHIgPSBsb2dnZXJQcmVcbiAgZm9yIChsZXQgYXJnIG9mIGFyZ3Mpe1xuICAgIGlmICh0eXBlb2YgYXJnID09IFwic3RyaW5nXCIgfHwgdHlwZW9mIGFyZyA9PSBcIm51bWJlclwiKSBwci5hcHBlbmQoU3RyaW5nKGFyZykpXG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSBbXCJbXCIsIC4uLmFyZywgXCJdXCJdLmZvckVhY2goYT0+IGRlYnVnKGEpKVxuICAgIGVsc2UgaWYgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IGFyZyA9PT0gbnVsbCkgcHIuYXBwZW5kKHNwYW4oU3RyaW5nKGFyZykpLnN0eWxlKHtjb2xvcjogY29sb3IuZ3JheX0pKVxuICAgIGVsc2UgaWYgKFwiJFwiIGluIGFyZyl7XG4gICAgICBpZiAoYXJnLiQgPT0gXCJOT0RFXCIpIHByLmFwcGVuZChhcmcpXG4gICAgICBlbHNlIHByLmFwcGVuZChhc3RWaWV3KGFyZykpXG4gICAgfVxuICB9XG4gIHByLmFwcGVuZChcIlxcblwiKVxufVxuXG5sZXQgZGVidWdDYWxsID0gPEFSR1MgZXh0ZW5kcyBhbnlbXSwgVD4gKGZuOiAoLi4uYXJnczogQVJHUykgPT4gVCkgPT4gKC4uLmFyZ3M6IEFSR1MpIDogVCA9PiB7XG4gIGlmICghREVCVUcpIHJldHVybiBmbiguLi5hcmdzKVxuICBjb25zb2xlLmxvZyhcIkRFQlVHXCIsIGZuLm5hbWUpXG4gIGRlYnVnKFwiQCBcIiwgZm4ubmFtZSwgLi4uYXJncylcbiAgbGV0IG9sZHByZSA9IGxvZ2dlclByZVxuICBsZXQgY2FsbHByZSA9IHByZSgpLnN0eWxlKHtib3JkZXJMZWZ0OiBcIjRweCBzb2xpZCBcIitjb2xvci5ncmF5LCBtYXJnaW5MZWZ0OiBcIjhweFwiLCBwYWRkaW5nTGVmdDogXCI4cHhcIn0pXG4gIGxvZ2dlclByZS5hcHBlbmQoY2FsbHByZSlcbiAgbG9nZ2VyUHJlID0gY2FsbHByZVxuICBsZXQgcmVzID0gZm4oLi4uYXJncylcbiAgbG9nZ2VyUHJlID0gb2xkcHJlXG4gIGRlYnVnKHJlcyBhcyBhbnkpXG4gIHJldHVybiByZXNcbn1cblxuXG5sZXQgYXN0VmlldyA9IChhc3Q6IEFTVCB8IFZhbHVlKTogTk9ERSA9PiB7XG4gIGxldCBfdmlldyA9IChhc3Q6IEFTVCB8IFZhbHVlKTogTk9ERSA9PiB7XG4gICAgbGV0IGVsID0gc3BhbigpXG4gICAgc3dpdGNoKGFzdC4kKXtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjogcmV0dXJuIGVsLmFwcGVuZChTdHJpbmcoYXN0LmNvbnRlbnQpKS5zdHlsZSh7Y29sb3I6IGNvbG9yLmJsdWV9KSAgXG4gICAgICBjYXNlIFwidmFyXCI6IHJldHVybiBlbC5hcHBlbmQoYXN0LmNvbnRlbnQubmFtZSlcbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOiByZXR1cm4gZWwuYXBwZW5kKCBcImZuIFwiLC4uLmFzdC5jb250ZW50LnZhcnMubWFwKHg9PntcbiAgICAgICAgaWYgKHgudHlwZSkgcmV0dXJuIGdvKG1rYXBwKHgudHlwZSwgW3hdKSlcbiAgICAgICAgcmV0dXJuIGdvKHgpXG4gICAgICB9KSxcIiA9PiBcIikuYXBwZW5kKGdvKGFzdC5jb250ZW50LmJvZHkpKVxuICAgICAgY2FzZSBcImFwcFwiOiByZXR1cm4gZWwuYXBwZW5kKFwiKFwiLCBnbyhhc3QuY29udGVudC5mbiksIFwiIFwiLCAuLi5hc3QuY29udGVudC5hcmdzLm1hcChhcmc9PmdvKGFyZykpLCBcIilcIilcbiAgICAgIGNhc2UgXCJsZXRcIjogcmV0dXJuIGVsLmFwcGVuZChcImxldCBcIiwgYXN0LmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZSwgXCIgPSBcIiwgZ28oYXN0LmNvbnRlbnQudmFsdWUpLCBcIiBpbiBcIiwgZ28oYXN0LmNvbnRlbnQuYm9keSkpXG4gICAgICBkZWZhdWx0OiByZXR1cm4gZWwuYXBwZW5kKGBbJHthc3QuJH1dYClcbiAgICB9ICBcbiAgfVxuICBsZXQgZ28gPSAoYXN0OkFTVHxWYWx1ZSk6IE5PREUgPT4ge1xuICAgIGxldCBlbCA9IHNwYW4oX3ZpZXcoYXN0KSkuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdCksIGN1cnNvcjogXCJwb2ludGVyXCJ9KVxuICAgIC5vbmNsaWNrKGU9PntcbiAgICAgIGVsLnJlcGxhY2VDaGlscmVuKFxuICAgICAgICBzcGFuKFwiVFlQRTpcIikuc3R5bGUoe2NvbG9yOiBjb2xvci5ncmF5fSlcbiAgICAgICAgLm9uY2xpY2soZT0+e1xuICAgICAgICAgIGVsLnJlcGxhY2VDaGlscmVuKF92aWV3KGFzdCkpXG4gICAgICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgICB9KSxcbiAgICAgICAgYXN0LnR5cGUgPyBhc3RWaWV3KGFzdC50eXBlKSA6IFwiKlwiLFxuICAgICAgICBnbyhhc3QpXG4gICAgICApXG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgfSlcbiAgICByZXR1cm4gZWxcbiAgfVxuICByZXR1cm4gZGl2KGdvKGFzdCkpLnN0eWxlKHtwYWRkaW5nOlwiLjRlbVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmdyYXksIGJvcmRlclJhZGl1czogXCIuNGVtXCIsIG1hcmdpbjpcIi40ZW0gMFwifSlcbn1cblxuY29uc3QgaGFzU2hvd25UeXBlID0gKHY6IFZhcikgPT4gdi50eXBlICYmICEodi50eXBlLiQgPT09IFwidmFyXCIgJiYgdi50eXBlLmNvbnRlbnQubmFtZSA9PT0gXCJhbnlcIilcbmNvbnN0IHByZXR0eUJpbmRlciA9ICh2OiBWYXIpOiBzdHJpbmcgPT4gaGFzU2hvd25UeXBlKHYpID8gYCgke3ByZXR0eUFTVCh2LnR5cGUhKX0gJHt2LmNvbnRlbnQubmFtZX0pYCA6IHYuY29udGVudC5uYW1lXG5cblxuZXhwb3J0IGNvbnN0IHByZXR0eUFTVCA9IChub2RlOiBBU1QpOiBzdHJpbmcgPT57XG4gIHN3aXRjaChub2RlLiQpe1xuICAgIGNhc2UgXCJudW1iZXJcIiA6IHJldHVybiBub2RlLmNvbnRlbnQudG9TdHJpbmcoKVxuICAgIGNhc2UgXCJzdHJpbmdcIiA6IHJldHVybiBKU09OLnN0cmluZ2lmeShub2RlLmNvbnRlbnQpXG4gICAgY2FzZSBcInZhclwiOiByZXR1cm4gbm9kZS5jb250ZW50Lm5hbWVcbiAgICBjYXNlIFwibGV0XCI6IHJldHVybiBgbGV0ICR7cHJldHR5QmluZGVyKG5vZGUuY29udGVudC52YXIpfSA9ICR7cHJldHR5QVNUKG5vZGUuY29udGVudC52YWx1ZSl9IGluXFxuJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIGBmbiAke25vZGUuY29udGVudC52YXJzLm1hcChwcmV0dHlCaW5kZXIpLmpvaW4oXCIgXCIpfSA9PiAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQuYm9keSl9YFxuICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGAoJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmZuKX0gJHtub2RlLmNvbnRlbnQuYXJncy5tYXAocHJldHR5QVNUKS5qb2luKFwiIFwiKX0pYFxuICAgIGNhc2UgXCJyZWNvcmRcIjogcmV0dXJuIGB7JHtub2RlLmNvbnRlbnQubWFwKChbaywgdl0pID0+IGAke2suY29udGVudC5uYW1lfTogJHtwcmV0dHlBU1Qodil9YCkuam9pbihcIiwgXCIpfX1gXG4gICAgY2FzZSBcImVycm9yXCI6IHJldHVybiBgW0VSUk9SOiAke25vZGUuY29udGVudC5tZXNzYWdlfV1gXG4gIH1cbn1cblxudHlwZSBOZXV0cmFsID0gVmFyIHwgUHJpbSB8IFRhZzxcImFwcFwiLCB7Zm46IE5ldXRyYWwsIGFyZ3M6IFZhbHVlW119PlxudHlwZSBWYWx1ZSA9IFRhZzxcImZ1bmN0aW9uXCIsIHtlbnY6IEVudiwgdmFyczogVmFyW10sIGJvZHk6IEFTVH0+IHwgTmV1dHJhbFxudHlwZSBFbnYgPSBSZWNvcmQ8c3RyaW5nLCB7YmluZGVyOiBWYXIsIHZhbDpWYWx1ZX0+XG5cbmxldCBhbm5vdCA9ICA8VCBleHRlbmRzIFZhbHVlIHwgQVNUPiAodGVybTpULCB0eXBlOiBBU1QgfCB1bmRlZmluZWQpIDpUID0+IHtcbiAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHRlcm1cbiAgaWYgKHRlcm0udHlwZSAhPT0gdW5kZWZpbmVkICYmIHByZXR0eUFTVCh0ZXJtLnR5cGUpICE9PSBwcmV0dHlBU1QodHlwZSkpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtwcmV0dHlBU1QodHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QodGVybS50eXBlKX1gKVxuICB0ZXJtLnR5cGUgPSB0eXBlXG4gIHJldHVybiB0ZXJtXG59XG5cbmxldCBldmFsdWF0ZSA9ICh0ZXJtOkFTVCwgZW52OiBFbnYgPSB7fSk6VmFsdWUgPT4ge1xuXG4gIGxldCBnbyA9ICh0ZXJtOkFTVCwgZW52OiBFbnYpOiBWYWx1ZSA9PiB7XG4gICAgc3dpdGNoICh0ZXJtLiQpIHtcbiAgICAgIGNhc2UgXCJ2YXJcIjoge1xuICAgICAgICBpZiAoZW52W3Rlcm0uY29udGVudC5uYW1lXSkgcmV0dXJuIGVudlt0ZXJtLmNvbnRlbnQubmFtZV0udmFsXG4gICAgICAgIHJldHVybiB0ZXJtXG4gICAgICB9XG4gICAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwgey4uLnRlcm0uY29udGVudCwgZW52fSkgXG4gICAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBhcHBseShcbiAgICAgICAgZXZhbHVhdGUodGVybS5jb250ZW50LmZuLCBlbnYpLFxuICAgICAgICB0ZXJtLmNvbnRlbnQuYXJncy5tYXAoYXJnID0+IGV2YWx1YXRlKGFyZywgZW52KSlcbiAgICAgIClcbiAgICAgIGNhc2UgXCJsZXRcIjp7XG4gICAgICAgIGxldCB2YWwgPSBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQudmFsdWUsIGVudik7XG4gICAgICAgIGFubm90KHRlcm0uY29udGVudC52YXIsIHZhbC50eXBlKVxuICAgICAgICByZXR1cm4gZXZhbHVhdGUodGVybS5jb250ZW50LmJvZHksIHsuLi5lbnYsIFt0ZXJtLmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZV06IHtiaW5kZXI6IHRlcm0uY29udGVudC52YXIsIHZhbCx9fSlcbiAgICAgIH1cbiAgICAgIGNhc2UgXCJudW1iZXJcIjogcmV0dXJuIGFubm90KHRlcm0sIE5VTUJFUilcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjogcmV0dXJuIHRlcm1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgZXZhbHVhdGUgdGVybSBvZiB0eXBlICR7dGVybS4kfWApXG4gIH1cblxuICBsZXQgcmVzID0gZ28odGVybSwgZW52KVxuICBhbm5vdCh0ZXJtLCByZXMudHlwZSlcbiAgcmV0dXJuIHJlc1xuXG5cbn1cbmV2YWx1YXRlID0gZGVidWdDYWxsKGV2YWx1YXRlKVxuXG5jb25zdCBhcHBseSA9IChmbjogVmFsdWUsIGFyZ3M6IFZhbHVlW10pOiBWYWx1ZSA9PiB7XG4gIGlmIChmbi4kID09IFwiZnVuY3Rpb25cIil7XG4gICAgaWYgKGZuLmNvbnRlbnQudmFycy5sZW5ndGggIT0gYXJncy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtmbi5jb250ZW50LnZhcnMubGVuZ3RofSBhcmd1bWVudHMsIGdvdCAke2FyZ3MubGVuZ3RofWApXG4gICAgbGV0IGVudiA9IHsuLi5mbi5jb250ZW50LmVudn1cbiAgICBmbi5jb250ZW50LnZhcnMuZm9yRWFjaCgoYmluZGVyLGkpPT4gZW52W2JpbmRlci5jb250ZW50Lm5hbWVdID0geyBiaW5kZXIsIHZhbDogYXJnc1tpXX0pXG4gICAgcmV0dXJuIGV2YWx1YXRlKGZuLmNvbnRlbnQuYm9keSwgZW52KVxuICB9XG4gIFxuICBpZiAoZm4uJCA9PSBcInZhclwiKXtcbiAgICBsZXQgbmFtZSA9IGZuLmNvbnRlbnQubmFtZVxuICAgIGlmIChidWlsdGluc1tuYW1lIGFzIEJ1aWx0aW5LZXldKSByZXR1cm4gYnVpbHRpbnNbbmFtZSBhcyBCdWlsdGluS2V5XS5pbXBsKC4uLmFyZ3MpXG4gIH1cbiAgcmV0dXJuIG1rQXN0KFwiYXBwXCIsIHtmbiwgYXJnc30pXG59XG5cbmxldCBjb3VudGVyID0gMDtcblxubGV0IHJlYWRiYWNrID0gKHZhbDogVmFsdWUpOiBBU1QgPT4ge1xuICBpZiAodmFsLiQgPT0gXCJmdW5jdGlvblwiKXtcbiAgICBsZXQgdmFycyA9IHZhbC5jb250ZW50LnZhcnMubWFwKHg9PiBhbm5vdChta3Zhcih4LmNvbnRlbnQubmFtZSArIFwiX1wiICsgY291bnRlcisrKSwgeC50eXBlKSlcbiAgICByZXR1cm4gbWtmdW4odmFycywgcmVhZGJhY2soYXBwbHkodmFsLCB2YXJzKSkpXG4gIH1cbiAgaWYgKHZhbC4kID09IFwiYXBwXCIpIHJldHVybiBta2FwcChyZWFkYmFjayh2YWwuY29udGVudC5mbiksIHZhbC5jb250ZW50LmFyZ3MubWFwKHJlYWRiYWNrKSlcbiAgcmV0dXJuIHZhbFxufVxuXG5yZWFkYmFjayA9IGRlYnVnQ2FsbChyZWFkYmFjaylcblxuZXhwb3J0IGNvbnN0IHJ1biA9IChhc3Q6IEFTVCkgPT4ge1xuICBjb3VudGVyID0wXG4gIHJldHVybiByZWFkYmFjayhldmFsdWF0ZShhc3QsIHt9KSlcbn1cblxuREVCVUcgPSAxXG5cbntcbiAgbGV0IGFzdCA9IHJ1bihwYXJzZShcImZuIChudW1iZXIgeCk9PiB4XCIpLmFzdClcblxufVxuXG5cbkRFQlVHID0gMFxuIiwKICAgICJcblxuXG5cbmltcG9ydCB7IGJvZHksIGh0bWwsIHNwYW4gLCBmcm9tSFRNTCwgaDIsIGRpdn0gZnJvbSBcIi4vaHRtbFwiO1xuaW1wb3J0IHsgZWRpdG9yIH0gZnJvbSBcIi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBwYXJzZSwgdHlwZSBBU1QsIHR5cGUgU3BhbiwgdHlwZSBTeW50YXhOb2RlIH0gZnJvbSBcIi4vcGFyc2VyXCI7XG5pbXBvcnQgeyBnZXRkZWYgfSBmcm9tIFwiLi9sc3BcIlxuaW1wb3J0IHsgQU5ZLCBwcmV0dHlBU1QsIHJ1biB9IGZyb20gXCIuL3J1bnRpbWVcIlxuaW1wb3J0IHsgY29sb3IgfSBmcm9tIFwiLi9odG1sXCI7XG5cblxuXG5jb25zdCBhYm91dF90ZXh0IDogc3RyaW5nID0gYFxuXG4vLyBUaGlzIGlzIGEgdG95IGNvZGUgZWRpdG9yIHN0aWxsIGluIGRldmVsb3BtZW50LlxuXG4vLyB0aGUgZ29hbCBpcyB0byBidWlsZCBhIGxhbmd1YWdlIHdpdGg6XG5cbi8vIGV4dHJlbWVseSBtaW5pbWFsIHN5bnRheFxuLy8gZmlyc3QgY2xhc3Mgc3VwcG9ydCBmb3IgdHlwZXMgYXMgdmFsdWVzXG4vLyBmaXJzdCBjYXNzIExTUCBwcm9ncmFtbmcgaW4gYSBzdHJhaWdodGZvcndhcmQgd2F5LlxuXG4vLyBob3ZlciBvdmVyIHggdG8gc2VlIGl0cyBpbmZlcnJlZCB0eXBlXG5sZXQgbiA9IDIyIGluXG5cbi8vIHRoaXMgaXMgaG93IHR5cGVzIGFyZSBhbm5vdGF0ZWQuIHR5cGVzIGFyZSBlc3NlbnRpYWxseSBqdXN0IGZ1bmN0aW9ucyBvdmVyIHZhbHVlcy5cbmxldCBrID0gKG51bWJlciAzMykgaW5cbmxldCB1ID0gKHN0cmluZyBcImhsbG9cIikgaW5cblxuLy8gdW50eXBlZCBpZFxubGV0IGlkID0gZm4geCA9PiB4IGluXG5cbi8vIG51bWJlciB0eXBlZCBpZFxubGV0IGlkbiA9IGZuIHggPT4gKG51bWJlciB4KSBpblxuXG4vLyB0eXBlIG9mIG51bWJlciAtPiBudW1iZXJcbmxldCBUID0gZm4gZiA9PiBmbiAobnVtYmVyIHgpID0+IChudW1iZXIgKGYgeCkpIGluXG5cbmxldCBfaWQgPSAoVCBpZCkgaW5cblxuLy9sZXQgYmFkID0gKF9pZCBcImVcIikgaW5cblxubGV0IHIgPSAoaWQgXCIyXCIpIGluXG5cbi8vIHRoaXMgaXMgd2lsbCByZXN1bHQgaW4gdHlwZSBlcnJvci5cbi8vIGxldCBCQUQgPSAoaWRuXyBcIjJcIikgaW5cblxuKG51bWJlciBzdClcbmA7XG5cblxuXG5cbmxldCBvdXR2aWV3ID0gaHRtbCgncHJlJykoKS5zdHlsZSh7XG4gIGJvcmRlclRvcDogXCIxcHggc29saWQgXCIrY29sb3IuY29sb3IsXG4gIHBhZGRpbmdUb3A6IFwiMTZweFwiLFxufSlcblxubGV0IGFzdDogQVNUIHwgdW5kZWZpbmVkXG5sZXQgY3VycmVudEFzdE1hcDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBbXVxuXG5cbmxldCBjb2RlOnN0cmluZyA9ICcnXG5cbmxldCBFZGl0ID0gZWRpdG9yKFxuICBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImxpbmVzXCIpID8/IGFib3V0X3RleHQsXG4gIChjb2RlKT0+IHtcbiAgICB0cnl7XG5cbiAgICAgIGxldCBwYXJzZWQgPSBwYXJzZShjb2RlKVxuICAgICAgYXN0ID0gcGFyc2VkLmFzdFxuICAgICAgY3VycmVudEFzdE1hcCA9IHBhcnNlZC5hc3RtYXBcbiAgICAgIGNvZGUgPSBjb2RlXG4gICAgICBsZXQgcmVzID0gcnVuKGFzdClcbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBwcmV0dHlBU1QocmVzKVxuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJsaW5lc1wiLCBjb2RlKVxuXG4gICAgfWNhdGNoKGUpe1xuICAgICAgYXN0ID0gdW5kZWZpbmVkXG4gICAgICBjdXJyZW50QXN0TWFwID0gW11cbiAgICAgIG91dHZpZXcuZWwudGV4dENvbnRlbnQgPSBlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSlcbiAgICB9XG4gIH0sXG4gICgpPT4gY3VycmVudEFzdE1hcCxcbiAgKHJlcSkgPT4ge1xuICAgIGxldCBkZWYgPSByZXEuJCA9PSBcInZhclwiID8gZ2V0ZGVmKGFzdCEsIHJlcSkgOiB1bmRlZmluZWRcbiAgICBpZiAoZGVmKSBFZGl0LnNldEN1cnNvcih7cm93OiBkZWYuc3Bhbi5zdGFydC5saW5lLTEsIGNvbDogZGVmLnNwYW4uc3RhcnQuY29sLTF9KVxuICB9LFxuICAobm9kZSkgPT4ge1xuICAgIGlmIChub2RlLiQgPT09IFwiY29tbWVudFwiKSByZXR1cm4gWycnLCBbXV1cblxuICAgIGxldCBzdHIgPSAobm9kZS4kICsgXCI6IFwiKVxuICAgIGxldCBtYXAgOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IHN0ci5zcGxpdCgnJykubWFwKGM9PiB1bmRlZmluZWQpXG5cbiAgICBsZXQgYXN0OkFTVCA9IG5vZGUudHlwZSA/IG5vZGUudHlwZSA6IEFOWVxuXG4gICAgbGV0IGNvID0gcHJldHR5QVNUKGFzdClcbiAgICBtYXAucHVzaCguLi5wYXJzZShjbykuYXN0bWFwKVxuICAgIHN0ciArPSBjb1xuXG4gICAgcmV0dXJuIFtzdHIsIG1hcF1cbiAgfVxuKVxuXG5cblxuXG5ib2R5LnN0eWxlKHtwYWRkaW5nOiBcIjQ0cHhcIixmb250RmFtaWx5OiBcInNhbnMtc2VyaWZcIix9KVxuXG5cbmxldCBidXR0biA9ICh0OnN0cmluZywgb25DbGljazooKSA9PiB2b2lkKSA9PiBzcGFuKHQsIG9uQ2xpY2spLnN0eWxlKHtjb2xvcjogXCJncmF5XCIsIGJvcmRlcjogXCIxcHggc29saWQgZ3JheVwiLCBib3JkZXJSYWRpdXM6IFwiNHB4XCIsIHBhZGRpbmc6IFwiMnB4IDRweFwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pXG5cbmJvZHkuYXBwZW5kKFxuICBkaXYoXG4gICAgc3Bhbign4pyI77iOJykuc3R5bGUoe2ZvbnRTaXplOiBcIjNlbVwiLCBtYXJnaW5SaWdodDogXCI4cHhcIn0pLFxuICAgIHNwYW4oXCJNaUdcIikuc3R5bGUoe2ZvbnRTaXplOiBcIjEuNWVtXCIsIGZvbnRXZWlnaHQ6IFwiYm9sZFwiLCBmb250RmFtaWx5OiBcIm1vbm9zcGFjZVwifSlcbiAgKS5zdHlsZSh7ZGlzcGxheTogXCJmbGV4XCIsIGFsaWduSXRlbXM6IFwiY2VudGVyXCIsIG1hcmdpbkJvdHRvbTogXCIxNnB4XCIsIGNvbG9yOiBcImdyYXlcIn0pLFxuXG4gIEVkaXQuZWwsXG4gIG91dHZpZXcsXG4gIGJ1dHRuKFwiYWJvdXRcIiwgKCkgPT4gRWRpdC5zZXRUZXh0KGFib3V0X3RleHQpKSxcbiAgYnV0dG4oXCJnaXRodWJcIiwgKCkgPT4gd2luZG93Lm9wZW4oXCJodHRwczovL2dpdGh1Yi5jb20vZGtvcm1hbm4vbXllZGl0b3JcIikpXG4pXG5cblxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQWNPLElBQU0sT0FBTyxDQUF5QyxRQUFVLElBQUksYUFBb0Q7QUFBQSxFQUM3SCxJQUFJLFVBQVUsU0FBUyxLQUFLLE9BQUssT0FBTyxNQUFNLFVBQVU7QUFBQSxFQUN4RCxJQUFJLEtBQUssU0FBVSxTQUFTLGNBQWMsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFJLFNBQVMsT0FBTyxPQUFLLE9BQU8sTUFBTSxVQUFVLENBQXNCO0FBQUEsRUFDN0gsSUFBSTtBQUFBLElBQVMsR0FBRyxHQUFJLFVBQVc7QUFBQSxFQUUvQixPQUFPO0FBQUE7QUFJRixJQUFNLFdBQVksQ0FBMEIsT0FBbUI7QUFBQSxFQUVwRSxJQUFJLE9BQWlCO0FBQUEsSUFDbkIsR0FBRztBQUFBLElBQ0g7QUFBQSxJQUNBLFFBQVEsSUFBSSxhQUE4QjtBQUFBLE1BQ3hDLFNBQVMsUUFBUSxXQUFTO0FBQUEsUUFDeEIsSUFBSSxPQUFPLFVBQVU7QUFBQSxVQUFVLEdB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QU8sQ0FBQztBQUFBO0FBQUEsR0FHdEUsTUFBSyxlQUNMLENBQUMsUUFBUTtBQUFBLEVBQ1AsSUFBSSxNQUFNLElBQUksS0FBSyxRQUFRLE9BQU8sS0FBTSxHQUFHLElBQUk7QUFBQSxFQUMvQyxJQUFJO0FBQUEsSUFBSyxLQUFLLFVBQVUsRUFBQyxLQUFLLElBQUksS0FBSyxNQUFNLE9BQUssR0FBRyxLQUFLLElBQUksS0FBSyxNQUFNLE1BQUksRUFBQyxDQUFDO0FBQUEsR0FFakYsQ0FBQyxTQUFTO0FBQUEsRUFDUixJQUFJLEtBQUssTUFBTTtBQUFBLElBQVcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQUEsRUFFeEMsSUFBSSxNQUFPLEtBQUssSUFBSTtBQUFBLEVBQ3BCLElBQUksTUFBbUMsSUFBSSxNQUFNLEVBQUUsRUFBRSxJQUFJLE9BQUM7QUFBQSxJQUFHO0FBQUEsR0FBUztBQUFBLEVBRXRFLElBQUksT0FBVSxLQUFLLE9BQU8sS0FBSyxPQUFPO0FBQUEsRUFFdEMsSUFBSSxLQUFLLFVBQVUsSUFBRztBQUFBLEVBQ3RCLElBQUksS0FBSyxHQUFHLE1BQU0sRUFBRSxFQUFFLE1BQU07QUFBQSxFQUM1QixPQUFPO0FBQUEsRUFFUCxPQUFPLENBQUMsS0FBSyxHQUFHO0FBQUEsQ0FFcEI7QUFLQSxLQUFLLE1BQU0sRUFBQyxTQUFTLFFBQU8sWUFBWSxhQUFhLENBQUM7QUFHdEQsSUFBSSxRQUFRLENBQUMsR0FBVSxZQUF1QixLQUFLLEdBQUcsT0FBTyxFQUFFLE1BQU0sRUFBQyxPQUFPLFFBQVEsUUFBUSxrQkFBa0IsY0FBYyxPQUFPLFNBQVMsV0FBVyxhQUFhLE1BQUssQ0FBQztBQUUzSyxLQUFLLE9BQ0gsSUFDRSxLQUFLLElBQUcsRUFBRSxNQUFNLEVBQUMsVUFBVSxPQUFPLGFBQWEsTUFBSyxDQUFDLEdBQ3JELEtBQUssS0FBSyxFQUFFLE1BQU0sRUFBQyxVQUFVLFNBQVMsWUFBWSxRQUFRLFlBQVksWUFBVyxDQUFDLENBQ3BGLEVBQUUsTUFBTSxFQUFDLFNBQVMsUUFBUSxZQUFZLFVBQVUsY0FBYyxRQUFRLE9BQU8sT0FBTSxDQUFDLEdBRXBGLEtBQUssSUFDTCxTQUNBLE1BQU0sU0FBUyxNQUFNLEtBQUssUUFBUSxVQUFVLENBQUMsR0FDN0MsTUFBTSxVQUFVLE1BQU0sT0FBTyxLQUFLLHNDQUFzQyxDQUFDLENBQzNFOyIsCiAgImRlYnVnSWQiOiAiRUM0NDY3MjNGQzJFMTIxMDY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
