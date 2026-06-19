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
    case "Napp":
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
  term.type == type;
  return term;
};
annot = debugCall(annot);
var evaluate = (term, env) => {
  switch (term.$) {
    case "var": {
      if (env[term.content.name])
        return env[term.content.name].val;
      return term;
    }
    case "function":
      return mkAst("function", { ...term.content, env });
    case "app":
      return apply(evaluate(term.content.fn, env), term.content.args.map((arg) => evaluate(arg, env)));
    case "let": {
      let val = evaluate(term.content.value, env);
      debug("VAL:", val, val.type, `
`);
      annot(term.content.var, val.type);
      return evaluate(term.content.body, { ...env, [term.content.var.content.name]: { binder: term.content.var, val } });
    }
    case "number":
      return annot(term, NUMBER);
    case "string":
      return term;
  }
  throw new Error(`Cannot evaluate term of type ${term.$}`);
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
  return mkAst("Napp", { fn, args });
};
var counter = 0;
var readback = (val) => {
  if (val.$ == "function") {
    let vars = val.content.vars.map((x) => mkvar(x.content.name + "_" + counter++));
    return mkfun(vars, readback(apply(val, vars)));
  }
  if (val.$ == "Napp")
    return mkapp(readback(val.content.fn), val.content.args.map(readback));
  return val;
};
var run = (ast) => {
  counter = 0;
  return readback(evaluate(ast, {}));
};
DEBUG = 1;
{
  let ast = evaluate(parse("2").ast, {});
  ast.type = NUMBER;
  debug(ast, ast.type);
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

//# debugId=AD816AA36906062964756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCk9PiBOT0RFLFxuICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IE5PREU8SD4sXG4gIGFzc2lnbjogKGh0bWxQcm9wczogUGFydGlhbDxIVE1MRWxlbWVudD4pID0+IE5PREVcbn1cblxuZXhwb3J0IHR5cGUgQVJHID0gTk9ERSB8IHN0cmluZyB8ICgoZTpNb3VzZUV2ZW50KT0+dm9pZClcblxuZXhwb3J0IGNvbnN0IGh0bWwgPSA8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4gKHRhZzpLKSA9PiAoLi4uY2hpbGRyZW46QVJHW10pOiBOT0RFIDxIVE1MRWxlbWVudFRhZ05hbWVNYXBbS10+ID0+IHtcbiAgbGV0IG9uY2xpY2sgPSBjaGlsZHJlbi5maW5kKGMgPT4gdHlwZW9mIGMgPT09IFwiZnVuY3Rpb25cIikgYXMgRnVuY3Rpb25cbiAgbGV0IGVsID0gZnJvbUhUTUwgKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSkuYXBwZW5kKC4uLiBjaGlsZHJlbi5maWx0ZXIoYyA9PiB0eXBlb2YgYyAhPT0gXCJmdW5jdGlvblwiKSBhcyAoTk9ERSB8IHN0cmluZylbXSkgYXMgTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPjtcbiAgaWYgKG9uY2xpY2spIGVsLmVsLiBvbmNsaWNrID0gKG9uY2xpY2sgYXMgKGU6TW91c2VFdmVudCk9PnZvaWQpXG4gIFxuICByZXR1cm4gZWxcbn1cblxuXG5leHBvcnQgY29uc3QgZnJvbUhUTUwgID0gPEggZXh0ZW5kcyBIVE1MRWxlbWVudD4gIChlbDpIKTogTk9ERSA8SD4gPT4ge1xuXG4gIGxldCBub2RlIDogTk9ERTxIPiA9IHtcbiAgICAkOiBcIk5PREVcIixcbiAgICBlbCxcbiAgICBhcHBlbmQ6ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBjaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gXCJzdHJpbmdcIikgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpKTtcbiAgICAgICAgZWxzZSBlbC5hcHBlbmRDaGlsZChjaGlsZC5lbCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG4gICAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCkgPT4ge1xuICAgICAgZWwub25jbGljayA9IGZcbiAgICAgIHJldHVybiBub2RlXG4gICAgfSxcbiAgICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGVsLnJlcGxhY2VDaGlsZHJlbigpXG4gICAgICByZXR1cm4gbm9kZS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gICAgfSxcbiAgICBzdHlsZTogKHN0eWxlczogUGFydGlhbDxDU1NTdHlsZURlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgc3R5bGVzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfSxcbiAgICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiB7XG4gICAgICBPYmplY3QuYXNzaWduKGVsLCBodG1sUHJvcHMpO1xuICAgICAgcmV0dXJuIGZyb21IVE1MKGVsKTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBub2RlXG59XG5cblxuZXhwb3J0IGNvbnN0IGRpdiA9IGh0bWwoXCJkaXZcIik7XG5leHBvcnQgY29uc3Qgc3BhbiA9IGh0bWwoXCJzcGFuXCIpO1xuZXhwb3J0IGNvbnN0IHAgPSBodG1sKFwicFwiKTtcbmV4cG9ydCBjb25zdCBib2R5ID0gZnJvbUhUTUwoZG9jdW1lbnQuYm9keSk7XG5leHBvcnQgY29uc3QgaDEgPSBodG1sKFwiaDFcIik7XG5leHBvcnQgY29uc3QgaDIgPSBodG1sKFwiaDJcIik7XG5leHBvcnQgY29uc3QgaDMgPSBodG1sKFwiaDNcIik7XG5leHBvcnQgY29uc3QgaDQgPSBodG1sKFwiaDRcIik7XG5leHBvcnQgY29uc3QgdGFibGUgPSBodG1sKFwidGFibGVcIik7XG5leHBvcnQgY29uc3QgdHIgPSBodG1sKFwidHJcIik7XG5leHBvcnQgY29uc3QgdGQgPSBodG1sKFwidGRcIik7XG5leHBvcnQgY29uc3QgcHJlID0gaHRtbChcInByZVwiKVxuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNmVlZWZmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMjIyMTIyO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZjEwZjIyO1xuICAgICAgLS1ncmVlbjogIzU0YzgwMTtcbiAgICAgIC0tYmx1ZTogIzFmMzJmZjtcbiAgICAgIC0teWVsbG93OiAjZDM5ZTNkO1xuICAgICAgLS1icm93bjogI2M1NWQwMDtcbiAgICAgIC0tcHVycGxlOiAjYTYxZmQwO1xuICAgICAgLS1jeWFuOiAjMGJhZWJjO1xuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuZXhwb3J0IGNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IGFueSk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJcblxuXG5leHBvcnQgdHlwZSBQb3MgPSB7b2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXJ9XG5leHBvcnQgdHlwZSBTcGFuID0ge3N0YXJ0OiBQb3MsIGVuZDogUG9zfVxuXG5leHBvcnQgdHlwZSBUYWcgPFQgZXh0ZW5kcyBzdHJpbmcsIEM+ID0geyQ6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4sIHR5cGU/OiBBU1R9XG5cbmV4cG9ydCB0eXBlIFZhciA9IFRhZzxcInZhclwiLCB7bmFtZTogc3RyaW5nfT5cbmV4cG9ydCB0eXBlIENvbW1lbnQgPSBUYWc8XCJjb21tZW50XCIsIHN0cmluZz5cbmV4cG9ydCB0eXBlIEZ1bmMgPSBUYWc8XCJmdW5jdGlvblwiLCB7dmFyczogVmFyW10sIGJvZHk6IEFTVH0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIFByaW0gPSBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPiB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFByaW1cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSwgYXN0bWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXX1cblxuXG5cbmNvbnN0IHplcm9Qb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9KVxuY29uc3QgemVyb1NwYW4gPSAoKTogU3BhbiA9PiAoe3N0YXJ0OiB6ZXJvUG9zKCksIGVuZDogemVyb1BvcygpfSlcblxuZXhwb3J0IGNvbnN0IG1rQXN0ID0gPFQgZXh0ZW5kcyBzdHJpbmcsIEM+KHRhZzogVCwgY29udGVudDogQywgc3BhbjogU3BhbiA9IHplcm9TcGFuKCkpOiBUYWc8VCwgQz4gPT4gKHskOiB0YWcsIGNvbnRlbnQsIHNwYW59KVxuXG50eXBlIFRva2VuQmFzZSA9IHtzcGFuOiBTcGFufVxuXG50eXBlIFRva2VuID1cbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiaWRlbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogbnVtYmVyfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiYXJyb3dcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImNvbW1lbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30pXG5cbnR5cGUgVG9rZW5Ob1NwYW4gPSBUb2tlbiBleHRlbmRzIGluZmVyIFQgPyBUIGV4dGVuZHMge3NwYW46IFNwYW59ID8gT21pdDxULCBcInNwYW5cIj4gOiBuZXZlciA6IG5ldmVyXG5cbmNvbnN0IHRva2VuaXplID0gKGNvZGU6IHN0cmluZyk6IHt0b2tlbnM6IFRva2VuW10sIGNvbW1lbnRzOiBDb21tZW50W10sIGVvZjogUG9zfSA9PiB7XG4gIGxldCB0b2tlbnM6IFRva2VuW10gPSBbXVxuICBsZXQgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdXG4gIGxldCBpID0gMFxuICBsZXQgbGluZSA9IDFcbiAgbGV0IGNvbCA9IDFcblxuICBsZXQgaXNBbHBoYSA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16X10vLnRlc3QoY2hhcilcbiAgbGV0IGlzRGlnaXQgPSAoY2hhcjogc3RyaW5nKSA9PiAvWzAtOV0vLnRlc3QoY2hhcilcbiAgbGV0IGlzSWRlbnQgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtejAtOV9dLy50ZXN0KGNoYXIpXG4gIGxldCBwb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiBpLCBsaW5lLCBjb2x9KVxuICBsZXQgYWR2YW5jZSA9ICgpID0+IHtcbiAgICBpZiAoY29kZVtpXSA9PT0gXCJcXG5cIikge1xuICAgICAgaSsrXG4gICAgICBsaW5lKytcbiAgICAgIGNvbCA9IDFcbiAgICB9IGVsc2Uge1xuICAgICAgaSsrXG4gICAgICBjb2wrK1xuICAgIH1cbiAgfVxuICBsZXQgcHVzaCA9ICh0b2tlbjogVG9rZW5Ob1NwYW4sIHN0YXJ0OiBQb3MpID0+IHtcbiAgICB0b2tlbnMucHVzaCh7Li4udG9rZW4sIHNwYW46IHtzdGFydCwgZW5kOiBwb3MoKX19IGFzIFRva2VuKVxuICB9XG5cbiAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgIGxldCBjaGFyID0gY29kZVtpXVxuXG4gICAgaWYgKC9cXHMvLnRlc3QoY2hhcikpIHtcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCIvXCIgJiYgY29kZVtpICsgMV0gPT09IFwiL1wiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgY29kZVtpXSAhPT0gXCJcXG5cIikgYWR2YW5jZSgpXG4gICAgICBjb21tZW50cy5wdXNoKG1rQXN0KFwiY29tbWVudFwiLCBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSksIHtzdGFydCwgZW5kOiBwb3MoKX0pKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCI9XCIgJiYgY29kZVtpICsgMV0gPT09IFwiPlwiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwiYXJyb3dcIn0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoXCIoKXt9PSw6XCIuaW5jbHVkZXMoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWUgPSBjaGFyIGFzIFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBcIlwiXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gY29kZVtpXVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICBsZXQgbmV4dCA9IGNvZGVbaSArIDFdXG4gICAgICAgICAgaWYgKG5leHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBlc2NhcGVcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBlc2NhcGVkID0gKHtuOiBcIlxcblwiLCByOiBcIlxcclwiLCB0OiBcIlxcdFwiLCAnXCInOiAnXCInLCBcIlxcXFxcIjogXCJcXFxcXCJ9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pW25leHRdXG4gICAgICAgICAgdmFsdWUgKz0gZXNjYXBlZCA/PyBuZXh0XG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gJ1wiJykgYnJlYWtcbiAgICAgICAgdmFsdWUgKz0gY3VycmVudFxuICAgICAgICBhZHZhbmNlKClcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlW2ldICE9PSAnXCInKSB7XG4gICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGxpdGVyYWxcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgIH1cbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzRGlnaXQoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNEaWdpdChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogTnVtYmVyKGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSkpfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0FscGhhKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzSWRlbnQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKVxuICAgICAgaWYgKHZhbHVlID09PSBcImxldFwiIHx8IHZhbHVlID09PSBcImluXCIgfHwgdmFsdWUgPT09IFwiZm5cIikgcHVzaCh7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBlbHNlIHB1c2goe3R5cGU6IFwiaWRlbnRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICBhZHZhbmNlKClcbiAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IGBVbmV4cGVjdGVkIGNoYXJhY3RlcjogJHtjaGFyfWAsIGNvbnRlbnQ6IGNoYXJ9LCBzdGFydClcbiAgfVxuXG4gIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbn1cblxuY2xhc3MgUGFyc2VyIHtcbiAgcHJpdmF0ZSBpID0gMFxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdG9rZW5zOiBUb2tlbltdLCBwcml2YXRlIHNvdXJjZTogc3RyaW5nLCBwcml2YXRlIGVvZjogUG9zKSB7fVxuXG4gIHBhcnNlKCk6IEFTVCB7XG4gICAgbGV0IGFzdCA9IHRoaXMucGFyc2VFeHByKClcbiAgICBpZiAodGhpcy5wZWVrKCkpIHtcbiAgICAgIGxldCBzdGFydCA9IHRoaXMucGVlaygpIS5zcGFuLnN0YXJ0XG4gICAgICBsZXQgZW5kID0gdGhpcy50b2tlbnNbdGhpcy50b2tlbnMubGVuZ3RoIC0gMV0/LnNwYW4uZW5kID8/IHN0YXJ0XG4gICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbmV4cGVjdGVkIGV4dHJhIGlucHV0IGFmdGVyIGV4cHJlc3Npb25cIiwge3N0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShzdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICByZXR1cm4gYXN0XG4gIH1cblxuICBwcml2YXRlIHBhcnNlRXhwcigpOiBBU1Qge1xuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImxldFwiKSkgcmV0dXJuIHRoaXMucGFyc2VMZXQoKVxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImZuXCIpKSByZXR1cm4gdGhpcy5wYXJzZUZ1bmN0aW9uKClcbiAgICByZXR1cm4gdGhpcy5wYXJzZUF0b20oKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUxldCgpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImxldFwiKS5zcGFuLnN0YXJ0XG4gICAgbGV0IHZhcmlhYmxlID0gdGhpcy5wYXJzZUxldEJpbmRlcigpXG4gICAgaWYgKHZhcmlhYmxlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIHZhcmlhYmxlXG5cbiAgICBsZXQgdmFsdWU6IEFTVFxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiPVwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCI9XCIpXG4gICAgICB2YWx1ZSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIpXG4gICAgfVxuXG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh0aGlzLmlzS2V5d29yZChcImluXCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdEtleXdvcmQoXCJpblwiKVxuICAgICAgYm9keSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBrZXl3b3JkIGluIGFmdGVyIGxldCBiaW5kaW5nXCIpXG4gICAgfVxuXG4gICAgcmV0dXJuIG1rQXN0KFwibGV0XCIsIHt2YXI6IHZhcmlhYmxlLCB2YWx1ZSwgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VGdW5jdGlvbigpOiBBU1Qge1xuICAgIGxldCBzdGFydCA9IHRoaXMuZXhwZWN0S2V5d29yZChcImZuXCIpLnNwYW4uc3RhcnRcbiAgICBsZXQgdmFyczogVmFyW10gPSBbXVxuICAgIHdoaWxlICh0aGlzLnBlZWsoKT8udHlwZSA9PT0gXCJpZGVudFwiIHx8IHRoaXMuaXNTeW1ib2woXCIoXCIpKSB7XG4gICAgICBsZXQgYmluZGVyID0gdGhpcy5wYXJzZUJpbmRlcigpXG4gICAgICBpZiAoYmluZGVyLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHk6IGJpbmRlcn0sIHtzdGFydCwgZW5kOiBiaW5kZXIuc3Bhbi5lbmR9KVxuICAgICAgdmFycy5wdXNoKGJpbmRlcilcbiAgICB9XG4gICAgbGV0IGJvZHk6IEFTVFxuICAgIGlmICh2YXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKHRoaXMubWF0Y2hUb2tlbihcImFycm93XCIpKSBib2R5ID0gdGhpcy53cmFwRXJyb3IoXCJGdW5jdGlvbiByZXF1aXJlcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyXCIsIHRoaXMucGFyc2VFeHByKCkpXG4gICAgICBlbHNlIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCBzdGFydClcbiAgICB9IGVsc2UgaWYgKCF0aGlzLm1hdGNoVG9rZW4oXCJhcnJvd1wiKSkge1xuICAgICAgYm9keSA9IHRoaXMucGVlaygpID8gdGhpcy53cmFwRXJyb3IoXCJFeHBlY3RlZCAnPT4nIGFmdGVyIGZ1bmN0aW9uIHBhcmFtZXRlcnNcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICc9PicgYWZ0ZXIgZnVuY3Rpb24gcGFyYW1ldGVyc1wiKVxuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5wYXJzZUV4cHIoKVxuICAgIH1cbiAgICByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFycywgYm9keX0sIHtzdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VBdG9tKCk6IEFTVCB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dFwiKVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiaWRlbnRcIikge1xuICAgICAgdGhpcy5pKytcbiAgICAgIHJldHVybiBta0FzdChcInZhclwiLCB7bmFtZTogdG9rZW4udmFsdWV9LCB0b2tlbi5zcGFuKVxuICAgIH1cblxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJudW1iZXJcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJzdHJpbmdcIiwgdG9rZW4udmFsdWUsIHRva2VuLnNwYW4pXG4gICAgfVxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImVycm9yXCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogdG9rZW4ubWVzc2FnZSwgY29udGVudDogdG9rZW4uY29udGVudH0sIHRva2VuLnNwYW4pXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCIoXCIpKSByZXR1cm4gdGhpcy5wYXJzZVBhcmVucygpXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCJ7XCIpKSByZXR1cm4gdGhpcy5wYXJzZVJlY29yZCgpXG5cbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShgVW5leHBlY3RlZCB0b2tlbjogJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gLCB0b2tlbi5zcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVBhcmVucygpOiBBU1Qge1xuICAgIGxldCBvcGVuID0gdGhpcy5leHBlY3RTeW1ib2woXCIoXCIpXG4gICAgbGV0IGl0ZW1zOiBBU1RbXSA9IFtdXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gaXRlbXMubGVuZ3RoID4gMCA/IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGl0ZW1zLnB1c2godGhpcy5wYXJzZUV4cHIoKSlcbiAgICB9XG4gICAgbGV0IGNsb3NlID0gdGhpcy5leHBlY3RTeW1ib2woXCIpXCIpXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiRW1wdHkgcGFyZW50aGVzZXMgYXJlIG5vdCBhbGxvd2VkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgY2xvc2Uuc3Bhbi5lbmQub2Zmc2V0KSlcbiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAxKSByZXR1cm4gaXRlbXNbMF1cbiAgICByZXR1cm4gbWtBc3QoXCJhcHBcIiwge2ZuOiBpdGVtc1swXSwgYXJnczogaXRlbXMuc2xpY2UoMSl9LCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlUmVjb3JkKCk6IEFTVCB7XG4gICAgbGV0IG9wZW4gPSB0aGlzLmV4cGVjdFN5bWJvbChcIntcIilcbiAgICBsZXQgZmllbGRzOiBbVmFyLCBBU1RdW10gPSBbXVxuXG4gICAgd2hpbGUgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgaWYgKCF0aGlzLnBlZWsoKSkge1xuICAgICAgICBsZXQgZW5kID0gZmllbGRzLmxlbmd0aCA+IDAgPyBmaWVsZHNbZmllbGRzLmxlbmd0aCAtIDFdWzFdLnNwYW4uZW5kIDogb3Blbi5zcGFuLmVuZFxuICAgICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcmVjb3JkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkge1xuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKSFcbiAgICAgICAgdGhpcy5pKytcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKGBFeHBlY3RlZCByZWNvcmQgZmllbGQgbmFtZSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YCwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogdG9rZW4uc3Bhbi5lbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCB0b2tlbi5zcGFuLmVuZC5vZmZzZXQpKVxuICAgICAgfVxuICAgICAgbGV0IGtleSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgICAgbGV0IHZhbHVlID0gdGhpcy5pc1N5bWJvbChcIjpcIilcbiAgICAgICAgPyAodGhpcy5leHBlY3RTeW1ib2woXCI6XCIpLCB0aGlzLmlzU3ltYm9sKFwifVwiKSA/IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIHZhbHVlIGFmdGVyICc6J1wiKSA6IHRoaXMucGFyc2VFeHByKCkpXG4gICAgICAgIDoga2V5XG4gICAgICBmaWVsZHMucHVzaChba2V5LCB2YWx1ZV0pXG4gICAgICBpZiAodGhpcy5pc1N5bWJvbChcIixcIikpIHRoaXMuaSsrXG4gICAgICBlbHNlIGJyZWFrXG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwifVwiKSkge1xuICAgICAgbGV0IGVuZCA9IGZpZWxkcy5sZW5ndGggPiAwID8gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXVsxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShcIlVudGVybWluYXRlZCByZWNvcmRcIiwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGVuZC5vZmZzZXQpKVxuICAgIH1cbiAgICBsZXQgY2xvc2UgPSB0aGlzLmV4cGVjdFN5bWJvbChcIn1cIilcbiAgICByZXR1cm4gbWtBc3QoXCJyZWNvcmRcIiwgZmllbGRzLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlQmluZGVyKCk6IFZhciB8IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+IHtcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIihcIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiKFwiKVxuICAgICAgbGV0IGRlY2xhcmVkVHlwZSA9IHRoaXMucGFyc2VBdG9tKClcbiAgICAgIGxldCBuYW1lID0gdGhpcy5tYXRjaFRva2VuKFwiaWRlbnRcIilcbiAgICAgIGlmICghbmFtZSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgaWRlbnRpZmllciBpbiBiaW5kZXIgcGF0dGVyblwiKVxuICAgICAgaWYgKCF0aGlzLmlzU3ltYm9sKFwiKVwiKSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgJyknIGFmdGVyIGJpbmRlciBwYXR0ZXJuXCIpXG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIilcIilcbiAgICAgIGlmIChkZWNsYXJlZFR5cGUuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4gZGVjbGFyZWRUeXBlXG4gICAgICBsZXQgdmFyaWFibGUgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICAgIHZhcmlhYmxlLnR5cGUgPSBkZWNsYXJlZFR5cGVcbiAgICAgIHJldHVybiB2YXJpYWJsZVxuICAgIH1cbiAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCBpZGVudGlmaWVyXCIpXG4gICAgbGV0IHZhcmlhYmxlID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCI6XCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIjpcIilcbiAgICAgIGxldCBkZWNsYXJlZFR5cGUgPSB0aGlzLnBhcnNlQXRvbSgpXG4gICAgICBpZiAoZGVjbGFyZWRUeXBlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGRlY2xhcmVkVHlwZVxuICAgICAgdmFyaWFibGUudHlwZSA9IGRlY2xhcmVkVHlwZVxuICAgIH1cbiAgICByZXR1cm4gdmFyaWFibGVcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VMZXRCaW5kZXIoKTogVmFyIHwgVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT4ge1xuICAgIHJldHVybiB0aGlzLnBhcnNlQmluZGVyKClcbiAgfVxuXG4gIHByaXZhdGUgcGVlaygpOiBUb2tlbiB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMuaV1cbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwiKTogYm9vbGVhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICByZXR1cm4gdG9rZW4/LnR5cGUgPT09IFwia2V5d29yZFwiICYmIHRva2VuLnZhbHVlID09PSB2YWx1ZVxuICB9XG5cbiAgcHJpdmF0ZSBpc1N5bWJvbCh2YWx1ZTogXCIoXCIgfCBcIilcIiB8IFwie1wiIHwgXCJ9XCIgfCBcIixcIiB8IFwiPVwiIHwgXCI6XCIpOiBib29sZWFuIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIHJldHVybiB0b2tlbj8udHlwZSA9PT0gXCJzeW1ib2xcIiAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWVcbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0VG9rZW48SyBleHRlbmRzIFRva2VuW1widHlwZVwiXT4odHlwZTogSyk6IEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7dHlwZX0sIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW4gYXMgRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PlxuICB9XG5cbiAgcHJpdmF0ZSBtYXRjaFRva2VuPEsgZXh0ZW5kcyBUb2tlbltcInR5cGVcIl0+KHR5cGU6IEspOiBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+IHwgdW5kZWZpbmVkIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4gfHwgdG9rZW4udHlwZSAhPT0gdHlwZSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuIGFzIEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT5cbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0S2V5d29yZCh2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIikge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuPy50eXBlICE9PSBcImtleXdvcmRcIiB8fCB0b2tlbi52YWx1ZSAhPT0gdmFsdWUpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQga2V5d29yZCAke3ZhbHVlfSwgZ290ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YClcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlblxuICB9XG5cbiAgcHJpdmF0ZSBleHBlY3RTeW1ib2wodmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiKSB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4/LnR5cGUgIT09IFwic3ltYm9sXCIgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcke3ZhbHVlfScsIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW5cbiAgfVxuXG4gIHByaXZhdGUgZGVzY3JpYmUodG9rZW46IFRva2VuIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgICBpZiAoIXRva2VuKSByZXR1cm4gXCJlbmQgb2YgaW5wdXRcIlxuICAgIGlmIChcInZhbHVlXCIgaW4gdG9rZW4pIHJldHVybiBgJHt0b2tlbi50eXBlfSgke1N0cmluZyh0b2tlbi52YWx1ZSl9KWBcbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJlcnJvclwiKSByZXR1cm4gYGVycm9yKCR7dG9rZW4ubWVzc2FnZX0pYFxuICAgIHJldHVybiB0b2tlbi50eXBlXG4gIH1cblxuICBwcml2YXRlIGVycm9yTm9kZShtZXNzYWdlOiBzdHJpbmcsIHNwYW4/OiBTcGFuLCBjb250ZW50Pzogc3RyaW5nKTogRXJyb3JOb2RlIHtcbiAgICBsZXQgZmluYWxTcGFuID0gc3BhbiA/PyB0aGlzLnBvaW50U3BhbigpXG4gICAgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2UsIGNvbnRlbnQ6IGNvbnRlbnQgPz8gdGhpcy5zb3VyY2Uuc2xpY2UoZmluYWxTcGFuLnN0YXJ0Lm9mZnNldCwgZmluYWxTcGFuLmVuZC5vZmZzZXQpfSwgZmluYWxTcGFuKVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvckhlcmUobWVzc2FnZTogc3RyaW5nLCBzdGFydD86IFBvcyk6RXJyb3JOb2RlIHtcbiAgICBsZXQgc3BhbiA9IHRoaXMucGVlaygpPy5zcGFuID8/IHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIHtzdGFydDogc3RhcnQgPz8gc3Bhbi5zdGFydCwgZW5kOiBzcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHdyYXBFcnJvcihtZXNzYWdlOiBzdHJpbmcsIG5vZGU6IEFTVCk6IEFTVCB7XG4gICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKG1lc3NhZ2UsIG5vZGUuc3BhbiwgdGhpcy5zb3VyY2Uuc2xpY2Uobm9kZS5zcGFuLnN0YXJ0Lm9mZnNldCwgbm9kZS5zcGFuLmVuZC5vZmZzZXQpKVxuICB9XG5cbiAgcHJpdmF0ZSBwb2ludFNwYW4oKTogU3BhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAodG9rZW4pIHJldHVybiB0b2tlbi5zcGFuXG4gICAgcmV0dXJuIHtzdGFydDogdGhpcy5lb2YsIGVuZDogdGhpcy5lb2Z9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGJ1aWxkQXN0TWFwID0gKGFzdDogQVNULCBjb21tZW50czogQ29tbWVudFtdID0gW10pOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9PiB7XG4gIGxldCBtYXhFbmQgPSBjb21tZW50cy5yZWR1Y2UoKG0sIGMpID0+IGMuc3Bhbi5lbmQub2Zmc2V0ID4gbSA/IGMuc3Bhbi5lbmQub2Zmc2V0IDogbSwgYXN0LnNwYW4uZW5kLm9mZnNldClcbiAgbGV0IHJlczogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBBcnJheS5mcm9tKHtsZW5ndGg6IG1heEVuZH0sICgpPT51bmRlZmluZWQpXG4gIGNvbnN0IHdhbGsgPSAobm9kZTogQVNUKSA9PiB7XG4gICAgZm9yIChsZXQgaSA9IG5vZGUuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBub2RlLnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBub2RlXG4gICAgY2hpbGRyZW4obm9kZSkuZm9yRWFjaCh3YWxrKVxuICB9XG4gIHdhbGsoYXN0KVxuICBjb21tZW50cy5mb3JFYWNoKGNvbW1lbnQgPT4ge1xuICAgIGZvciAobGV0IGkgPSBjb21tZW50LnNwYW4uc3RhcnQub2Zmc2V0OyBpIDwgY29tbWVudC5zcGFuLmVuZC5vZmZzZXQ7IGkrKykgcmVzW2ldID0gY29tbWVudFxuICB9KVxuICByZXR1cm4gcmVzXG59XG5cbmV4cG9ydCBjb25zdCBwYXJzZSA9IChjb2RlOnN0cmluZyk6IFBhcnNlUmVzdWx0ID0+IHtcbiAgbGV0IHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Z9ID0gdG9rZW5pemUoY29kZSlcbiAgbGV0IGFzdCA9IG5ldyBQYXJzZXIodG9rZW5zLCBjb2RlLCBlb2YpLnBhcnNlKClcbiAgcmV0dXJuIHthc3QsIGNvbW1lbnRzLCBhc3RtYXA6IGJ1aWxkQXN0TWFwKGFzdCwgY29tbWVudHMpfVxufVxuXG5leHBvcnQgY29uc3QgcGFyc2VBU1QgPSAoY29kZTpzdHJpbmcpOiBBU1QgPT4gcGFyc2UoY29kZSkuYXN0XG5cbmV4cG9ydCBjb25zdCBjaGlsZHJlbiA9IChub2RlOiBBU1QpOiBBU1RbXSA9PiB7XG4gIGlmIChub2RlLiQgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFsuLi5ub2RlLmNvbnRlbnQudmFycywgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwiYXBwXCIpIHJldHVybiBbbm9kZS5jb250ZW50LmZuLCAuLi5ub2RlLmNvbnRlbnQuYXJnc11cbiAgaWYgKG5vZGUuJCA9PT0gXCJsZXRcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQudmFyLCBub2RlLmNvbnRlbnQudmFsdWUsIG5vZGUuY29udGVudC5ib2R5XVxuICBpZiAobm9kZS4kID09PSBcInJlY29yZFwiKSByZXR1cm4gbm9kZS5jb250ZW50LmZsYXRNYXAoKFtrZXksIHZhbHVlXSkgPT4gW2tleSwgdmFsdWVdKVxuICByZXR1cm4gW11cbn1cblxuY29uc3Qgc3RyaXBTcGFucyA9IChhc3Q6IEFTVCk6IHVua25vd24gPT4ge1xuICBpZiAoYXN0LiQgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge3ZhcnM6IGFzdC5jb250ZW50LnZhcnMubWFwKHN0cmlwU3BhbnMpLCBib2R5OiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmJvZHkpfX1cbiAgaWYgKGFzdC4kID09PSBcImFwcFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiB7Zm46IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuZm4pLCBhcmdzOiBhc3QuY29udGVudC5hcmdzLm1hcChzdHJpcFNwYW5zKX19XG4gIGlmIChhc3QuJCA9PT0gXCJsZXRcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge3Zhcjogc3RyaXBTcGFucyhhc3QuY29udGVudC52YXIpLCB2YWx1ZTogc3RyaXBTcGFucyhhc3QuY29udGVudC52YWx1ZSksIGJvZHk6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQuYm9keSl9fVxuICBpZiAoYXN0LiQgPT09IFwicmVjb3JkXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50Lm1hcCgoW25hbWUsIHZhbHVlXSkgPT4gW3N0cmlwU3BhbnMobmFtZSksIHN0cmlwU3BhbnModmFsdWUpXSl9XG4gIGlmIChhc3QuJCA9PT0gXCJlcnJvclwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudH1cbiAgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnR9XG59XG5cblxubGV0IHN0cmluZ2lmeSA9ICh4OiB1bmtub3duKSA9PiBKU09OLnN0cmluZ2lmeSh4LCBudWxsLCAyKVxuXG5jb25zdCB0ZXN0X3BhcnNlID0gKGNvZGU6IHN0cmluZywgZXhwZWN0ZWQ6IEFTVCkgPT4ge1xuICBsZXQgYXN0ID0gcGFyc2VBU1QoY29kZSlcblxuICBpZiAoSlNPTi5zdHJpbmdpZnkoc3RyaXBTcGFucyhhc3QpKSAhPT0gSlNPTi5zdHJpbmdpZnkoc3RyaXBTcGFucyhleHBlY3RlZCkpKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlRlc3QgZmFpbGVkIGZvciBjb2RlOlwiLCBjb2RlKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJFeHBlY3RlZDpcIiwgc3RyaW5naWZ5KHN0cmlwU3BhbnMoZXhwZWN0ZWQpKSlcbiAgICBjb25zb2xlLmVycm9yKFwiR290OlwiLCBzdHJpbmdpZnkoc3RyaXBTcGFucyhhc3QpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRlc3QgZmFpbGVkIGZvciBjb2RlOiAke2NvZGV9YClcbiAgfVxufVxuXG5jb25zdCB0ZXN0X3NwYW4gPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogU3BhbikgPT4ge1xuICBsZXQgYXN0ID0gcGFyc2VBU1QoY29kZSlcbiAgaWYgKEpTT04uc3RyaW5naWZ5KGFzdC5zcGFuKSAhPT0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWQpKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6XCIsIGNvZGUpXG4gICAgY29uc29sZS5lcnJvcihcIkV4cGVjdGVkOlwiLCBleHBlY3RlZClcbiAgICBjb25zb2xlLmVycm9yKFwiR290OlwiLCBhc3Quc3BhbilcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmV4cG9ydCBsZXQgbWtudW0gPSAobjogbnVtYmVyKSA9PiBta0FzdChcIm51bWJlclwiLCBuKVxuZXhwb3J0IGxldCBta3N0ciA9IChzOiBzdHJpbmcpID0+IG1rQXN0KFwic3RyaW5nXCIsIHMpXG5leHBvcnQgbGV0IG1rdmFyID0gKG5hbWU6IHN0cmluZykgPT4gbWtBc3QoXCJ2YXJcIiwge25hbWV9KVxuZXhwb3J0IGxldCBta2FwcCA9IChmbjogQVNULCBhcmdzOiBBU1RbXSkgPT4gbWtBc3QoXCJhcHBcIiwge2ZuLCBhcmdzfSlcbmV4cG9ydCBsZXQgbWtsZXQgPSAodjogc3RyaW5nIHwgVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1QpID0+IG1rQXN0KFwibGV0XCIsIHt2YXI6IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2LCB2YWx1ZSwgYm9keX0pXG5leHBvcnQgbGV0IG1rZnVuID0gKHZhcnM6IChzdHJpbmcgfCBWYXIpW10sIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFyczogdmFycy5tYXAodiA9PiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IG1rdmFyKHYpIDogdiksIGJvZHl9KSBhcyBGdW5jXG5leHBvcnQgbGV0IGFubm90ID0gKHR5cGU6IEFTVCwgdmFsdWU6IEFTVCkgPT4gbWtBc3QoXCJhbm5vdFwiLCB7dHlwZSwgdmFsdWV9KVxuZXhwb3J0IGxldCBta3JlY29yZCA9IChmaWVsZHM6IHtba2V5IDogc3RyaW5nXSA6IEFTVH0pID0+IG1rQXN0KFwicmVjb3JkXCIsIE9iamVjdC5lbnRyaWVzKGZpZWxkcykubWFwKChbayx2XSk9PiBbbWt2YXIoayksIHZdKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcInhcIjogbWt2YXIoXCJ4XCIpLFxuICBcIjIyXCI6IG1rbnVtKDIyKSxcbiAgJ1wiaGVsbG9cIic6IG1rc3RyKFwiaGVsbG9cIiksXG4gIFwiKGYgeClcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpXSksXG4gIFwiKGYgeCB5KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIiksIG1rdmFyKFwieVwiKV0pLFxuICBcImxldCB4ID0gMjIgaW4geFwiOiBta2xldChcInhcIiwgbWtudW0oMjIpLCBta3ZhcihcInhcIikpLFxuICBcInthOiAyMiwgYjogeH1cIjogbWtyZWNvcmQoe2E6IG1rbnVtKDIyKSwgYjogbWt2YXIoXCJ4XCIpfSksXG4gIFwiZm4geCA9PiB4XCI6IG1rZnVuKFtcInhcIl0sIG1rdmFyKFwieFwiKSksXG4gIFwiZm4geCB5ID0+IHhcIjogbWtmdW4oW1wieFwiLCBcInlcIl0sIG1rdmFyKFwieFwiKSksXG4gIFwibGV0IChudW1iZXIgeCkgPSAyMiBpbiB4XCI6IG1rbGV0KE9iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KSwgbWtudW0oMjIpLCBta3ZhcihcInhcIikpLFxuICBcImZuIChudW1iZXIgeCkgKHN0cmluZyB5KSA9PiB4XCI6IG1rZnVuKFtcbiAgICBPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksXG4gICAgT2JqZWN0LmFzc2lnbihta3ZhcihcInlcIiksIHt0eXBlOiBta3ZhcihcInN0cmluZ1wiKX0pLFxuICBdLCBta3ZhcihcInhcIikpLFxuICBcIntlOjIyfVwiIDogbWtyZWNvcmQoe2U6IG1rbnVtKDIyKX0pLFxuICBcIntlfVwiOiBta3JlY29yZCh7ZTogbWt2YXIoXCJlXCIpfSksXG4gIFwiLy9jb21tZW50XFxuMjJcIjogcGFyc2VBU1QoXCIyMlwiKSxcbn0pLmZvckVhY2goKFtjb2RlLCBleHBlY3RlZF0pID0+IHRlc3RfcGFyc2UoY29kZSwgZXhwZWN0ZWQgYXMgQVNUKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcIihcIjogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgcGFyZW50aGVzaXplZCBleHByZXNzaW9uXCIsIGNvbnRlbnQ6IFwiKFwifSksXG4gIFwibGV0IHggMjIgaW4geFwiOiBta0FzdChcImxldFwiLCB7XG4gICAgdmFyOiBta3ZhcihcInhcIiksXG4gICAgdmFsdWU6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRXhwZWN0ZWQgJz0nIGFmdGVyIGxldCBiaW5kaW5nIG5hbWVcIiwgY29udGVudDogXCIyMlwifSksXG4gICAgYm9keTogbWt2YXIoXCJ4XCIpLFxuICB9KSxcbiAgXCJ7ZTp9XCI6IG1rcmVjb3JkKHtlOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkIHJlY29yZCBmaWVsZCB2YWx1ZSBhZnRlciAnOidcIiwgY29udGVudDogXCJ9XCJ9KX0pLFxuXG59KS5mb3JFYWNoKChbY29kZSwgZXhwZWN0ZWRdKSA9PiB0ZXN0X3BhcnNlKGNvZGUsIGV4cGVjdGVkIGFzIEFTVCkpXG5cbnRlc3Rfc3BhbihcImxldCB4ID0gMjJcXG5pbiB4XCIsIHtcbiAgc3RhcnQ6IHtvZmZzZXQ6IDAsIGxpbmU6IDEsIGNvbDogMX0sXG4gIGVuZDoge29mZnNldDogMTUsIGxpbmU6IDIsIGNvbDogNX0sXG59KVxuIiwKICAgICJpbXBvcnQgeyBBU1QsIFZhciB9IGZyb20gXCIuL3BhcnNlclwiXG5pbXBvcnQge2NoaWxkcmVufSBmcm9tIFwiLi9wYXJzZXJcIlxuXG5cbmV4cG9ydCBjb25zdCBnZXRkZWYgPSAocm9vdDogQVNULCB2YXJpOiBWYXIpOiBBU1QgfCB1bmRlZmluZWQgPT4ge1xuICBpZiAocm9vdC5zcGFuLnN0YXJ0Lm9mZnNldCA+IHZhcmkuc3Bhbi5zdGFydC5vZmZzZXQgfHwgcm9vdC5zcGFuLmVuZC5vZmZzZXQgPCB2YXJpLnNwYW4uZW5kLm9mZnNldCkgcmV0dXJuIHVuZGVmaW5lZFxuICBmb3IgKGxldCBjaGlsZCBvZiBjaGlsZHJlbihyb290KSl7XG4gICAgbGV0IHJlcyA9IGdldGRlZihjaGlsZCwgdmFyaSlcbiAgICBpZiAocmVzKSByZXR1cm4gcmVzXG4gIH1cblxuICBpZiAocm9vdC4kID09PSBcImxldFwiICYmIHJvb3QuY29udGVudC52YXIuY29udGVudC5uYW1lID09PSB2YXJpLmNvbnRlbnQubmFtZSlcbiAgICByZXR1cm4gcm9vdC5jb250ZW50LnZhclxuXG4gIGlmIChyb290LiQgPT09IFwiZnVuY3Rpb25cIilcbiAgICBmb3IgKGxldCB2IG9mIHJvb3QuY29udGVudC52YXJzKVxuICAgICAgaWYgKHYuY29udGVudC5uYW1lID09PSB2YXJpLmNvbnRlbnQubmFtZSlcbiAgICAgICAgcmV0dXJuIHZcbn1cbiIsCiAgICAiaW1wb3J0IHsgY29sb3JPZiB9IGZyb20gXCIuL2VkaXRvclwiXG5pbXBvcnQgeyBib2R5LCBjb2xvciwgZGl2LCBOT0RFLCBwcmUsIHNwYW4gfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7bWtudW0sIFByaW0sIFRhZywgdHlwZSBBU1QsIHR5cGUgRnVuYywgcGFyc2UsIG1rdmFyLCBta2FwcCwgVmFyLCBta0FzdCwgbWtmdW59IGZyb20gXCIuL3BhcnNlclwiXG5cbmV4cG9ydCBsZXQgTlVNQkVSID0gbWt2YXIoXCJudW1iZXJcIilcbmV4cG9ydCBsZXQgU1RSSU5HID0gbWt2YXIoXCJzdHJpbmdcIilcbmV4cG9ydCBsZXQgVFlQRSAgID0gbWt2YXIoXCJ0eXBlXCIpXG5leHBvcnQgbGV0IFRZUEVPRiA9IG1rdmFyKFwidHlwZW9mXCIpXG5cbk5VTUJFUi50eXBlID0gVFlQRVxuU1RSSU5HLnR5cGUgPSBUWVBFXG5UWVBFLnR5cGUgPSBUWVBFXG5UWVBFT0YudHlwZSA9IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0IVxuXG5leHBvcnQgbGV0IEFOWSA6IEFTVCA9IG1rdmFyKFwiYW55XCIpXG5cbmxldCBwcmltaXRpdmVUeXBlID0gKG5hbWU6IHN0cmluZykgPT4gKHtcbiAgdHlwZTogVFlQRSxcbiAgaW1wbDogKHg6IEFTVCkgPT4ge1xuICAgIGlmICh4LnR5cGUpIHtcbiAgICAgIGlmICh4LnR5cGUuJCA9PSBcInZhclwiICYmIHgudHlwZS5jb250ZW50Lm5hbWUgPT0gbmFtZSkgcmV0dXJuIHhcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtuYW1lfSwgZ290ICR7KHgudHlwZSl9YClcbiAgICB9XG4gICAgeC50eXBlID0gbWt2YXIobmFtZSlcbiAgICByZXR1cm4geFxuICB9XG59KVxuXG5cbmNvbnN0IGJ1aWx0aW5LZXlzID0gW1wibnVtYmVyXCIsIFwic3RyaW5nXCIsIFwiZXFcIiwgXCJhZGRcIiwgXCJpZmVsc2VcIiwgXCJ0eXBlb2ZcIl0gYXMgY29uc3RcbnR5cGUgQnVpbHRpbktleSA9IHR5cGVvZiBidWlsdGluS2V5c1tudW1iZXJdXG5cbmxldCBidWlsdGluczogUmVjb3JkPEJ1aWx0aW5LZXksIHsgdHlwZTogQVNULCBpbXBsOiAoLi4uYXJnczpBU1RbXSkgPT4gQVNUIH0+ID0ge1xuICBudW1iZXI6IHByaW1pdGl2ZVR5cGUoXCJudW1iZXJcIiksXG4gIHN0cmluZzogcHJpbWl0aXZlVHlwZShcInN0cmluZ1wiKSxcbiAgZXE6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCB5ID0+IChudW1iZXIgKGYgeCB5KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiBta251bShcbiAgICAgICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fFxuICAgICAgKHguJCA9PSBcInN0cmluZ1wiICYmIHkuJCA9PSBcInN0cmluZ1wiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8ICh4ID09IHkpXG4gICAgICA/IDEgOiAwKVxuICB9LFxuICBhZGQ6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGY9PiBmbiB4IHkgPT4gKG51bWJlciAoZiAobnVtYmVyIHgpIChudW1iZXIgeSkpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4LHkpID0+IHtcbiAgICAgIGlmICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIikgcmV0dXJuIG1rbnVtKHguY29udGVudCArIHkuY29udGVudClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvciBpbiBhZGQ6IGV4cGVjdGVkIG51bWJlcnMsIGdvdCAke3ByZXR0eUFTVCh4KX0gYW5kICR7cHJldHR5QVNUKHkpfWApXG4gICAgfVxuICB9LFxuICBpZmVsc2UgOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIFQgY29uZCB0aGVuIGVsc2UgPT4gKFQgKGYgKG51bWJlciBjb25kKSAoVCB0aGVuKSAoVCBlbHNlKSkpXCIpLmFzdCEsXG4gICAgaW1wbDogKGNvbmQsIHRoZW4sIGVscykgPT4ge1xuICAgICAgbGV0IHZhbCA9IGNvbmQuJCA9PSBcIm51bWJlclwiID8gY29uZC5jb250ZW50IDogY29uZC4kID09IFwic3RyaW5nXCIgPyBjb25kLmNvbnRlbnQubGVuZ3RoIDogMVxuICAgICAgcmV0dXJuIHZhbCA/IHRoZW4gOiBlbHNcbiAgICB9XG4gIH0sXG4gIHR5cGVvZjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+IHR5cGVcIikuYXN0ISxcbiAgICBpbXBsOiAoeCkgPT4ge1xuICAgICAgaWYgKCF4LnR5cGUpIHJldHVybiBta2FwcChUWVBFT0YsIFt4XSlcbiAgICAgIHJldHVybiB4LnR5cGVcbiAgICB9XG4gIH1cbn1cblxuXG5cbmxldCBERUJVRyA9IDBcbmxldCBsb2dnZXJQcmUgPSBwcmUoKVxuYm9keS5yZXBsYWNlQ2hpbHJlbihsb2dnZXJQcmUpXG5cblxudHlwZSBWaXMgPSBOT0RFIHwgc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCB8IEFTVCB8IFZhbHVlIHwgVmlzW10gfCBudW1iZXJcblxubGV0IGRlYnVnID0gKC4uLmFyZ3M6IFZpc1tdKSA9PiB7XG4gIGlmICghREVCVUcpIHJldHVyblxuICBsZXQgcHIgPSBsb2dnZXJQcmVcbiAgZm9yIChsZXQgYXJnIG9mIGFyZ3Mpe1xuICAgIGlmICh0eXBlb2YgYXJnID09IFwic3RyaW5nXCIgfHwgdHlwZW9mIGFyZyA9PSBcIm51bWJlclwiKSBwci5hcHBlbmQoU3RyaW5nKGFyZykpXG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSBbXCJbXCIsIC4uLmFyZywgXCJdXCJdLmZvckVhY2goYT0+IGRlYnVnKGEpKVxuICAgIGVsc2UgaWYgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IGFyZyA9PT0gbnVsbCkgcHIuYXBwZW5kKHNwYW4oU3RyaW5nKGFyZykpLnN0eWxlKHtjb2xvcjogY29sb3IuZ3JheX0pKVxuICAgIGVsc2UgaWYgKFwiJFwiIGluIGFyZyl7XG4gICAgICBpZiAoYXJnLiQgPT0gXCJOT0RFXCIpIHByLmFwcGVuZChhcmcpXG4gICAgICBlbHNlIHByLmFwcGVuZChhc3RWaWV3KGFyZykpXG4gICAgfVxuICB9XG4gIHByLmFwcGVuZChcIlxcblwiKVxufVxuXG5sZXQgZGVidWdDYWxsID0gPEFSR1MgZXh0ZW5kcyBhbnlbXSwgVD4gKGZuOiAoLi4uYXJnczogQVJHUykgPT4gVCkgPT4gKC4uLmFyZ3M6IEFSR1MpIDogVCA9PiB7XG4gIGlmICghREVCVUcpIHJldHVybiBmbiguLi5hcmdzKVxuICBjb25zb2xlLmxvZyhcIkRFQlVHXCIsIGZuLm5hbWUpXG4gIGRlYnVnKFwiQCBcIiwgZm4ubmFtZSwgLi4uYXJncylcbiAgbGV0IG9sZHByZSA9IGxvZ2dlclByZVxuICBsZXQgY2FsbHByZSA9IHByZSgpLnN0eWxlKHtib3JkZXJMZWZ0OiBcIjRweCBzb2xpZCBcIitjb2xvci5ncmF5LCBtYXJnaW5MZWZ0OiBcIjhweFwiLCBwYWRkaW5nTGVmdDogXCI4cHhcIn0pXG4gIGxvZ2dlclByZS5hcHBlbmQoY2FsbHByZSlcbiAgbG9nZ2VyUHJlID0gY2FsbHByZVxuICBsZXQgcmVzID0gZm4oLi4uYXJncylcbiAgbG9nZ2VyUHJlID0gb2xkcHJlXG4gIGRlYnVnKHJlcyBhcyBhbnkpXG4gIHJldHVybiByZXNcbn1cblxuXG5sZXQgYXN0VmlldyA9IChhc3Q6IEFTVCB8IFZhbHVlKTogTk9ERSA9PiB7XG4gIGxldCBfdmlldyA9IChhc3Q6IEFTVCB8IFZhbHVlKTogTk9ERSA9PiB7XG4gICAgbGV0IGVsID0gc3BhbigpXG4gICAgc3dpdGNoKGFzdC4kKXtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIGNhc2UgXCJzdHJpbmdcIjogcmV0dXJuIGVsLmFwcGVuZChTdHJpbmcoYXN0LmNvbnRlbnQpKS5zdHlsZSh7Y29sb3I6IGNvbG9yLmJsdWV9KSAgXG4gICAgICBjYXNlIFwidmFyXCI6IHJldHVybiBlbC5hcHBlbmQoYXN0LmNvbnRlbnQubmFtZSlcbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOiByZXR1cm4gZWwuYXBwZW5kKCBcImZuIChcIiwuLi5hc3QuY29udGVudC52YXJzLm1hcChnbyksXCIpID0+IFwiKS5hcHBlbmQoZ28oYXN0LmNvbnRlbnQuYm9keSkpXG4gICAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBlbC5hcHBlbmQoXCIoXCIsIGdvKGFzdC5jb250ZW50LmZuKSwgXCIgXCIsIC4uLmFzdC5jb250ZW50LmFyZ3MubWFwKGFyZz0+Z28oYXJnKSksIFwiKVwiKVxuICAgICAgY2FzZSBcImxldFwiOiByZXR1cm4gZWwuYXBwZW5kKFwibGV0IFwiLCBhc3QuY29udGVudC52YXIuY29udGVudC5uYW1lLCBcIiA9IFwiLCBnbyhhc3QuY29udGVudC52YWx1ZSksIFwiIGluIFwiLCBnbyhhc3QuY29udGVudC5ib2R5KSlcbiAgICAgIGRlZmF1bHQ6IHJldHVybiBlbC5hcHBlbmQoYFske2FzdC4kfV1gKVxuICAgIH0gIFxuICB9XG4gIGxldCBnbyA9IChhc3Q6QVNUfFZhbHVlKTogTk9ERSA9PiB7XG4gICAgbGV0IGVsID0gc3Bhbihfdmlldyhhc3QpKS5zdHlsZSh7Y29sb3I6IGNvbG9yT2YoYXN0KSwgY3Vyc29yOiBcInBvaW50ZXJcIn0pXG4gICAgLm9uY2xpY2soZT0+e1xuICAgICAgZWwucmVwbGFjZUNoaWxyZW4oXG4gICAgICAgIHNwYW4oXCJUWVBFOlwiKS5zdHlsZSh7Y29sb3I6IGNvbG9yLmdyYXl9KVxuICAgICAgICAub25jbGljayhlPT57XG4gICAgICAgICAgZWwucmVwbGFjZUNoaWxyZW4oX3ZpZXcoYXN0KSlcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG4gICAgICAgIH0pLFxuICAgICAgICBhc3QudHlwZSA/IGFzdFZpZXcoYXN0LnR5cGUpIDogXCIqXCIsXG4gICAgICAgIGdvKGFzdClcbiAgICAgIClcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICB9KVxuICAgIHJldHVybiBlbFxuICB9XG4gIHJldHVybiBkaXYoZ28oYXN0KSkuc3R5bGUoe3BhZGRpbmc6XCIuNGVtXCIsIGJvcmRlcjogXCIxcHggc29saWQgXCIrY29sb3IuZ3JheSwgYm9yZGVyUmFkaXVzOiBcIi40ZW1cIiwgbWFyZ2luOlwiLjRlbSAwXCJ9KVxufVxuXG5jb25zdCBoYXNTaG93blR5cGUgPSAodjogVmFyKSA9PiB2LnR5cGUgJiYgISh2LnR5cGUuJCA9PT0gXCJ2YXJcIiAmJiB2LnR5cGUuY29udGVudC5uYW1lID09PSBcImFueVwiKVxuY29uc3QgcHJldHR5QmluZGVyID0gKHY6IFZhcik6IHN0cmluZyA9PiBoYXNTaG93blR5cGUodikgPyBgKCR7cHJldHR5QVNUKHYudHlwZSEpfSAke3YuY29udGVudC5uYW1lfSlgIDogdi5jb250ZW50Lm5hbWVcblxuXG5leHBvcnQgY29uc3QgcHJldHR5QVNUID0gKG5vZGU6IEFTVCB8IFZhbHVlKTogc3RyaW5nID0+e1xuICBzd2l0Y2gobm9kZS4kKXtcbiAgICBjYXNlIFwibnVtYmVyXCIgOiByZXR1cm4gbm9kZS5jb250ZW50LnRvU3RyaW5nKClcbiAgICBjYXNlIFwic3RyaW5nXCIgOiByZXR1cm4gSlNPTi5zdHJpbmdpZnkobm9kZS5jb250ZW50KVxuICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIG5vZGUuY29udGVudC5uYW1lXG4gICAgY2FzZSBcImxldFwiOiByZXR1cm4gYGxldCAke3ByZXR0eUJpbmRlcihub2RlLmNvbnRlbnQudmFyKX0gPSAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQudmFsdWUpfSBpblxcbiR7cHJldHR5QVNUKG5vZGUuY29udGVudC5ib2R5KX1gXG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBgZm4gJHtub2RlLmNvbnRlbnQudmFycy5tYXAocHJldHR5QmluZGVyKS5qb2luKFwiIFwiKX0gPT4gJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiTmFwcFwiOlxuICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGAoJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmZuKX0gJHtub2RlLmNvbnRlbnQuYXJncy5tYXAocHJldHR5QVNUKS5qb2luKFwiIFwiKX0pYFxuICAgIGNhc2UgXCJyZWNvcmRcIjogcmV0dXJuIGB7JHtub2RlLmNvbnRlbnQubWFwKChbaywgdl0pID0+IGAke2suY29udGVudC5uYW1lfTogJHtwcmV0dHlBU1Qodil9YCkuam9pbihcIiwgXCIpfX1gXG4gICAgY2FzZSBcImVycm9yXCI6IHJldHVybiBgW0VSUk9SOiAke25vZGUuY29udGVudC5tZXNzYWdlfV1gXG4gIH1cbn1cblxuXG4vLyBhc3RWaWV3ID0gZGVidWdDYWxsKGFzdFZpZXcpXG5cbnR5cGUgTmV1dHJhbCA9IFZhciB8IFByaW0gfCBUYWc8XCJOYXBwXCIsIHtmbjogTmV1dHJhbCwgYXJnczogVmFsdWVbXX0+XG50eXBlIFZhbHVlID0gVGFnPFwiZnVuY3Rpb25cIiwge2VudjogRW52LCB2YXJzOiBWYXJbXSwgYm9keTogQVNUfT4gfCBOZXV0cmFsXG50eXBlIEVudiA9IFJlY29yZDxzdHJpbmcsIHtiaW5kZXI6IFZhciwgdmFsOlZhbHVlfT5cblxubGV0IGFubm90ID0gKHRlcm06VmFsdWUsIHR5cGU6IEFTVCB8IHVuZGVmaW5lZCkgOlZhbHVlID0+IHtcbiAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHRlcm1cbiAgaWYgKHRlcm0udHlwZSAhPT0gdW5kZWZpbmVkICYmIHByZXR0eUFTVCh0ZXJtLnR5cGUpICE9PSBwcmV0dHlBU1QodHlwZSkpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtwcmV0dHlBU1QodHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QodGVybS50eXBlKX1gKVxuICB0ZXJtLnR5cGUgPT0gdHlwZVxuICByZXR1cm4gdGVybVxufVxuXG5hbm5vdCA9IGRlYnVnQ2FsbChhbm5vdClcblxubGV0IGV2YWx1YXRlID0gKHRlcm06QVNULCBlbnY6IEVudik6IFZhbHVlID0+IHtcbiAgc3dpdGNoICh0ZXJtLiQpIHtcbiAgICBjYXNlIFwidmFyXCI6IHtcbiAgICAgIGlmIChlbnZbdGVybS5jb250ZW50Lm5hbWVdKSByZXR1cm4gZW52W3Rlcm0uY29udGVudC5uYW1lXS52YWxcbiAgICAgIHJldHVybiB0ZXJtXG4gICAgfVxuICAgIGNhc2UgXCJmdW5jdGlvblwiOiByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7Li4udGVybS5jb250ZW50LCBlbnZ9KSBcbiAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBhcHBseShcbiAgICAgIGV2YWx1YXRlKHRlcm0uY29udGVudC5mbiwgZW52KSxcbiAgICAgIHRlcm0uY29udGVudC5hcmdzLm1hcChhcmcgPT4gZXZhbHVhdGUoYXJnLCBlbnYpKVxuICAgIClcbiAgICBjYXNlIFwibGV0XCI6e1xuICAgICAgbGV0IHZhbCA9IGV2YWx1YXRlKHRlcm0uY29udGVudC52YWx1ZSwgZW52KTtcbiAgICAgIGRlYnVnKFwiVkFMOlwiLHZhbCwgdmFsLnR5cGUsIFwiXFxuXCIpXG4gICAgICBhbm5vdCh0ZXJtLmNvbnRlbnQudmFyLCB2YWwudHlwZSlcbiAgICAgIHJldHVybiBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQuYm9keSwgey4uLmVudiwgW3Rlcm0uY29udGVudC52YXIuY29udGVudC5uYW1lXToge2JpbmRlcjogdGVybS5jb250ZW50LnZhciwgdmFsLH19KVxuICAgIH1cbiAgICBjYXNlIFwibnVtYmVyXCI6IHJldHVybiBhbm5vdCh0ZXJtLCBOVU1CRVIpXG4gICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gdGVybVxuICB9XG4gIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGV2YWx1YXRlIHRlcm0gb2YgdHlwZSAke3Rlcm0uJH1gKVxufVxuZXZhbHVhdGUgPSBkZWJ1Z0NhbGwoZXZhbHVhdGUpXG5cbmNvbnN0IGFwcGx5ID0gKGZuOiBWYWx1ZSwgYXJnczogVmFsdWVbXSk6IFZhbHVlID0+IHtcbiAgaWYgKGZuLiQgPT0gXCJmdW5jdGlvblwiKXtcbiAgICBpZiAoZm4uY29udGVudC52YXJzLmxlbmd0aCAhPSBhcmdzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2ZuLmNvbnRlbnQudmFycy5sZW5ndGh9IGFyZ3VtZW50cywgZ290ICR7YXJncy5sZW5ndGh9YClcbiAgICBsZXQgZW52ID0gey4uLmZuLmNvbnRlbnQuZW52fVxuICAgIGZuLmNvbnRlbnQudmFycy5mb3JFYWNoKChiaW5kZXIsaSk9PiBlbnZbYmluZGVyLmNvbnRlbnQubmFtZV0gPSB7IGJpbmRlciwgdmFsOiBhcmdzW2ldfSlcbiAgICByZXR1cm4gZXZhbHVhdGUoZm4uY29udGVudC5ib2R5LCBlbnYpXG4gIH1cbiAgcmV0dXJuIG1rQXN0KFwiTmFwcFwiLCB7Zm4sIGFyZ3N9KVxufVxuXG5sZXQgY291bnRlciA9IDA7XG5cbmNvbnN0IHJlYWRiYWNrID0gKHZhbDogVmFsdWUpOiBBU1QgPT4ge1xuICBpZiAodmFsLiQgPT0gXCJmdW5jdGlvblwiKXtcbiAgICBsZXQgdmFycyA9IHZhbC5jb250ZW50LnZhcnMubWFwKHg9PiBta3Zhcih4LmNvbnRlbnQubmFtZSArIFwiX1wiICsgY291bnRlcisrKSlcbiAgICByZXR1cm4gbWtmdW4odmFycywgcmVhZGJhY2soYXBwbHkodmFsLCB2YXJzKSkpXG4gIH1cbiAgaWYgKHZhbC4kID09IFwiTmFwcFwiKSByZXR1cm4gbWthcHAocmVhZGJhY2sodmFsLmNvbnRlbnQuZm4pLCB2YWwuY29udGVudC5hcmdzLm1hcChyZWFkYmFjaykpXG4gIHJldHVybiB2YWxcbn1cblxuXG5leHBvcnQgY29uc3QgcnVuID0gKGFzdDogQVNUKSA9PiB7XG4gIGNvdW50ZXIgPTBcbiAgcmV0dXJuIHJlYWRiYWNrKGV2YWx1YXRlKGFzdCwge30pKVxufVxuXG5ERUJVRyA9IDFcblxue1xuICBsZXQgYXN0ID0gZXZhbHVhdGUocGFyc2UoXCIyXCIpLmFzdCwge30pXG5cbiAgYXN0LnR5cGUgPSBOVU1CRVJcblxuICBkZWJ1Zyhhc3QsIGFzdC50eXBlKVxuXG59XG5cblxuXG4vLyBsZXQgYXN0ID0gcGFyc2UoJ2xldCB1ID0gMiBpbiAoZm4geCA9PiBmbiB5ID0+IHggMyknKS5hc3Rcbi8vIGxldCByZXMgPSBydW4oYXN0KVxuLy8gY29uc29sZS5sb2cocmVzKVxuXG5ERUJVRyA9IDBcbiIsCiAgICAiXG5cblxuXG5pbXBvcnQgeyBib2R5LCBodG1sLCBzcGFuICwgZnJvbUhUTUwsIGgyLCBkaXZ9IGZyb20gXCIuL2h0bWxcIjtcbmltcG9ydCB7IGVkaXRvciB9IGZyb20gXCIuL2VkaXRvclwiO1xuaW1wb3J0IHsgcGFyc2UsIHR5cGUgQVNULCB0eXBlIFNwYW4sIHR5cGUgU3ludGF4Tm9kZSB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgZ2V0ZGVmIH0gZnJvbSBcIi4vbHNwXCJcbmltcG9ydCB7IEFOWSwgcHJldHR5QVNULCBydW4gfSBmcm9tIFwiLi9ydW50aW1lXCJcbmltcG9ydCB7IGNvbG9yIH0gZnJvbSBcIi4vaHRtbFwiO1xuXG5cblxuY29uc3QgYWJvdXRfdGV4dCA6IHN0cmluZyA9IGBcblxuLy8gVGhpcyBpcyBhIHRveSBjb2RlIGVkaXRvciBzdGlsbCBpbiBkZXZlbG9wbWVudC5cblxuLy8gdGhlIGdvYWwgaXMgdG8gYnVpbGQgYSBsYW5ndWFnZSB3aXRoOlxuXG4vLyBleHRyZW1lbHkgbWluaW1hbCBzeW50YXhcbi8vIGZpcnN0IGNsYXNzIHN1cHBvcnQgZm9yIHR5cGVzIGFzIHZhbHVlc1xuLy8gZmlyc3QgY2FzcyBMU1AgcHJvZ3JhbW5nIGluIGEgc3RyYWlnaHRmb3J3YXJkIHdheS5cblxuLy8gaG92ZXIgb3ZlciB4IHRvIHNlZSBpdHMgaW5mZXJyZWQgdHlwZVxubGV0IG4gPSAyMiBpblxuXG4vLyB0aGlzIGlzIGhvdyB0eXBlcyBhcmUgYW5ub3RhdGVkLiB0eXBlcyBhcmUgZXNzZW50aWFsbHkganVzdCBmdW5jdGlvbnMgb3ZlciB2YWx1ZXMuXG5sZXQgayA9IChudW1iZXIgMzMpIGluXG5sZXQgdSA9IChzdHJpbmcgXCJobGxvXCIpIGluXG5cbi8vIHVudHlwZWQgaWRcbmxldCBpZCA9IGZuIHggPT4geCBpblxuXG4vLyBudW1iZXIgdHlwZWQgaWRcbmxldCBpZG4gPSBmbiB4ID0+IChudW1iZXIgeCkgaW5cblxuLy8gdHlwZSBvZiBudW1iZXIgLT4gbnVtYmVyXG5sZXQgVCA9IGZuIGYgPT4gZm4gKG51bWJlciB4KSA9PiAobnVtYmVyIChmIHgpKSBpblxuXG5sZXQgX2lkID0gKFQgaWQpIGluXG5cbi8vbGV0IGJhZCA9IChfaWQgXCJlXCIpIGluXG5cbmxldCByID0gKGlkIFwiMlwiKSBpblxuXG4vLyB0aGlzIGlzIHdpbGwgcmVzdWx0IGluIHR5cGUgZXJyb3IuXG4vLyBsZXQgQkFEID0gKGlkbl8gXCIyXCIpIGluXG5cbihudW1iZXIgc3QpXG5gO1xuXG5cblxuXG5sZXQgb3V0dmlldyA9IGh0bWwoJ3ByZScpKCkuc3R5bGUoe1xuICBib3JkZXJUb3A6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICBwYWRkaW5nVG9wOiBcIjE2cHhcIixcbn0pXG5cbmxldCBhc3Q6IEFTVCB8IHVuZGVmaW5lZFxubGV0IGN1cnJlbnRBc3RNYXA6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gW11cblxuXG5sZXQgY29kZTpzdHJpbmcgPSAnJ1xuXG5sZXQgRWRpdCA9IGVkaXRvcihcbiAgbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJsaW5lc1wiKSA/PyBhYm91dF90ZXh0LFxuICAoY29kZSk9PiB7XG4gICAgdHJ5e1xuXG4gICAgICBsZXQgcGFyc2VkID0gcGFyc2UoY29kZSlcbiAgICAgIGFzdCA9IHBhcnNlZC5hc3RcbiAgICAgIGN1cnJlbnRBc3RNYXAgPSBwYXJzZWQuYXN0bWFwXG4gICAgICBjb2RlID0gY29kZVxuICAgICAgbGV0IHJlcyA9IHJ1bihhc3QpXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gcHJldHR5QVNUKHJlcylcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibGluZXNcIiwgY29kZSlcblxuICAgIH1jYXRjaChlKXtcbiAgICAgIGFzdCA9IHVuZGVmaW5lZFxuICAgICAgY3VycmVudEFzdE1hcCA9IFtdXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgfVxuICB9LFxuICAoKT0+IGN1cnJlbnRBc3RNYXAsXG4gIChyZXEpID0+IHtcbiAgICBsZXQgZGVmID0gcmVxLiQgPT0gXCJ2YXJcIiA/IGdldGRlZihhc3QhLCByZXEpIDogdW5kZWZpbmVkXG4gICAgaWYgKGRlZikgRWRpdC5zZXRDdXJzb3Ioe3JvdzogZGVmLnNwYW4uc3RhcnQubGluZS0xLCBjb2w6IGRlZi5zcGFuLnN0YXJ0LmNvbC0xfSlcbiAgfSxcbiAgKG5vZGUpID0+IHtcbiAgICBpZiAobm9kZS4kID09PSBcImNvbW1lbnRcIikgcmV0dXJuIFsnJywgW11dXG5cbiAgICBsZXQgc3RyID0gKG5vZGUuJCArIFwiOiBcIilcbiAgICBsZXQgbWFwIDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBzdHIuc3BsaXQoJycpLm1hcChjPT4gdW5kZWZpbmVkKVxuXG4gICAgbGV0IGFzdDpBU1QgPSBub2RlLnR5cGUgPyBub2RlLnR5cGUgOiBBTllcblxuICAgIGxldCBjbyA9IHByZXR0eUFTVChhc3QpXG4gICAgbWFwLnB1c2goLi4ucGFyc2UoY28pLmFzdG1hcClcbiAgICBzdHIgKz0gY29cblxuICAgIHJldHVybiBbc3RyLCBtYXBdXG4gIH1cbilcblxuXG5cblxuYm9keS5zdHlsZSh7cGFkZGluZzogXCI0NHB4XCIsZm9udEZhbWlseTogXCJzYW5zLXNlcmlmXCIsfSlcblxuXG5sZXQgYnV0dG4gPSAodDpzdHJpbmcsIG9uQ2xpY2s6KCkgPT4gdm9pZCkgPT4gc3Bhbih0LCBvbkNsaWNrKS5zdHlsZSh7Y29sb3I6IFwiZ3JheVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkIGdyYXlcIiwgYm9yZGVyUmFkaXVzOiBcIjRweFwiLCBwYWRkaW5nOiBcIjJweCA0cHhcIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KVxuXG5ib2R5LmFwcGVuZChcbiAgZGl2KFxuICAgIHNwYW4oJ+KciO+4jicpLnN0eWxlKHtmb250U2l6ZTogXCIzZW1cIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KSxcbiAgICBzcGFuKFwiTWlHXCIpLnN0eWxlKHtmb250U2l6ZTogXCIxLjVlbVwiLCBmb250V2VpZ2h0OiBcImJvbGRcIiwgZm9udEZhbWlseTogXCJtb25vc3BhY2VcIn0pXG4gICkuc3R5bGUoe2Rpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBtYXJnaW5Cb3R0b206IFwiMTZweFwiLCBjb2xvcjogXCJncmF5XCJ9KSxcblxuICBFZGl0LmVsLFxuICBvdXR2aWV3LFxuICBidXR0bihcImFib3V0XCIsICgpID0+IEVkaXQuc2V0VGV4dChhYm91dF90ZXh0KSksXG4gIGJ1dHRuKFwiZ2l0aHViXCIsICgpID0+IHdpbmRvdy5vcGVuKFwiaHR0cHM6Ly9naXRodWIuY29tL2Rrb3JtYW5uL215ZWRpdG9yXCIpKVxuKVxuXG5cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFjTyxJQUFNLE9BQU8sQ0FBeUMsUUFBVSxJQUFJLGFBQW9EO0FBQUEsRUFDN0gsSUFBSSxVQUFVLFNBQVMsS0FBSyxPQUFLLE9BQU8sTUFBTSxVQUFVO0FBQUEsRUFDeEQsSUFBSSxLQUFLLFNBQVUsU0FBUyxjQUFjLEdBQUcsQ0FBQyxFQUFFLE9BQU8sR0FBSSxTQUFTLE9BQU8sT0FBSyxPQUFPLE1BQU0sVUFBVSxDQUFzQjtBQUFBLEVBQzdILElBQUk7QUFBQSxJQUFTLEdBQUcsR0FBSSxVQUFXO0FBQUEsRUFFL0IsT0FBTztBQUFBO0FBSUYsSUFBTSxXQUFZLENBQTBCLE9BQW1CO0FBQUEsRUFFcEUsSUFBSSxPQUFpQjtBQUFBLElBQ25CLEdBQUc7QUFBQSxJQUNIO0FBQUEsSUFDQSxRQUFRLElBQUksYUFBOEI7QUFBQSxNQUN4QyxTQUFTLFFBQVEsV0FBUztBQUFBLFFBQ3hCLElBQUksT0FBTyxVQUFVO0FBQUEsVUFBVSxHQUFHLFlBQVksU0FBUyxlQUFlLEtBQUssQ0FBQztBQUFBLFFBQ3ZFO0FBQUEsYUFBRyxZQUFZLE1BQU0sRUFBRTtBQUFBLE9BQzdCO0FBQUEsTUFDRCxPQUFPO0FBQUE7QUFBQSxJQUVULFNBQVMsQ0FBQyxNQUE2QjtBQUFBLE1BQ3JDLEdBQUcsVUFBVTtBQUFBLE1BQ2IsT0FBTztBQUFBO0FBQUEsSUFFVCxnQkFBZ0IsSUFBSSxhQUE4QjtBQUFBLE1BQ2hELEdBQUcsZ0JBQWdCO0FBQUEsTUFD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QUEsQ0FFcEI7QUFLQSxLQUFLLE1BQU0sRUFBQyxTQUFTLFFBQU8sWUFBWSxhQUFhLENBQUM7QUFHdEQsSUFBSSxRQUFRLENBQUMsR0FBVSxZQUF1QixLQUFLLEdBQUcsT0FBTyxFQUFFLE1BQU0sRUFBQyxPQUFPLFFBQVEsUUFBUSxrQkFBa0IsY0FBYyxPQUFPLFNBQVMsV0FBVyxhQUFhLE1BQUssQ0FBQztBQUUzSyxLQUFLLE9BQ0gsSUFDRSxLQUFLLElBQUcsRUFBRSxNQUFNLEVBQUMsVUFBVSxPQUFPLGFBQWEsTUFBSyxDQUFDLEdBQ3JELEtBQUssS0FBSyxFQUFFLE1BQU0sRUFBQyxVQUFVLFNBQVMsWUFBWSxRQUFRLFlBQVksWUFBVyxDQUFDLENBQ3BGLEVBQUUsTUFBTSxFQUFDLFNBQVMsUUFBUSxZQUFZLFVBQVUsY0FBYyxRQUFRLE9BQU8sT0FBTSxDQUFDLEdBRXBGLEtBQUssSUFDTCxTQUNBLE1BQU0sU0FBUyxNQUFNLEtBQUssUUFBUSxVQUFVLENBQUMsR0FDN0MsTUFBTSxVQUFVLE1BQU0sT0FBTyxLQUFLLHNDQUFzQyxDQUFDLENBQzNFOyIsCiAgImRlYnVnSWQiOiAiQUQ4MTZBQTM2OTA2MDYyOTY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
