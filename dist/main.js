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
  --white: #abb2bf;
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
      --white: #abb2bf;
      --gray: #abb2bf88;
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
  white: "var(--white)",
  gray: "var(--gray)",
  color: "var(--color)",
  background: "var(--background)"
};
body.el.style = `
background: ${color.background};
color: ${color.color};
`;

// src/editor.ts
var colorOf = (node) => node == undefined ? color.gray : node.$ === "comment" ? color.gray : node.$ === "number" || node.$ === "string" ? color.yellow : node.$ === "var" ? color.purple : node.$ === "let" || node.$ == "function" ? color.blue : node.$ === "app" ? color.green : node.$ === "error" ? color.red : color.white;
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
            border: "1px solid " + color.white,
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
body.append(div(span("✈︎").style({ fontSize: "3em", marginRight: "8px" }), span("my editor").style({ fontSize: "1.5em", fontWeight: "bold" })).style({ display: "flex", alignItems: "center", marginBottom: "16px", color: "gray" }), Edit.el, outview, buttn("about", () => Edit.setText(about_text)), buttn("github", () => window.open("https://github.com/dkormann/myeditor")));

//# debugId=602D2A8D8F707EE264756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjogKE5PREUgfCBzdHJpbmcpW10pID0+IE5PREUsXG4gIHN0eWxlOiAoc3R5bGVzOiBQYXJ0aWFsPENTU1N0eWxlRGVjbGFyYXRpb24+KSA9PiBOT0RFLFxuICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiBOT0RFXG59XG5cbmV4cG9ydCB0eXBlIEFSRyA9IE5PREUgfCBzdHJpbmcgfCAoKGU6TW91c2VFdmVudCk9PnZvaWQpXG5cbmV4cG9ydCBjb25zdCBodG1sID0gPEsgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+ICh0YWc6SykgPT4gKC4uLmNoaWxkcmVuOkFSR1tdKTogTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPiA9PiB7XG4gIGxldCBvbmNsaWNrID0gY2hpbGRyZW4uZmluZChjID0+IHR5cGVvZiBjID09PSBcImZ1bmN0aW9uXCIpIGFzIEZ1bmN0aW9uXG4gIGxldCBlbCA9IGZyb21IVE1MIChkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZykpLmFwcGVuZCguLi4gY2hpbGRyZW4uZmlsdGVyKGMgPT4gdHlwZW9mIGMgIT09IFwiZnVuY3Rpb25cIikgYXMgKE5PREUgfCBzdHJpbmcpW10pIGFzIE5PREUgPEhUTUxFbGVtZW50VGFnTmFtZU1hcFtLXT47XG4gIGlmIChvbmNsaWNrKSBlbC5lbC4gb25jbGljayA9IChvbmNsaWNrIGFzIChlOk1vdXNlRXZlbnQpPT52b2lkKVxuICBcbiAgcmV0dXJuIGVsXG59XG5cblxuZXhwb3J0IGNvbnN0IGZyb21IVE1MICA9IDxIIGV4dGVuZHMgSFRNTEVsZW1lbnQ+ICAoZWw6SCk6IE5PREUgPEg+ID0+IHtcbiAgbGV0IG5vZGUgOiBOT0RFPEg+ID0ge1xuICAgICQ6IFwiTk9ERVwiLFxuICAgIGVsLFxuICAgIGFwcGVuZDogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNoaWxkID09PSBcInN0cmluZ1wiKSBlbC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjaGlsZCkpO1xuICAgICAgICBlbHNlIGVsLmFwcGVuZENoaWxkKGNoaWxkLmVsKTtcblxuICAgICAgfSk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgcmVwbGFjZUNoaWxyZW46ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBlbC5yZXBsYWNlQ2hpbGRyZW4oKVxuICAgICAgcmV0dXJuIG5vZGUuYXBwZW5kKC4uLmNoaWxkcmVuKVxuICAgIH0sXG4gICAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IHtcbiAgICAgIE9iamVjdC5hc3NpZ24oZWwuc3R5bGUsIHN0eWxlcyk7XG4gICAgICByZXR1cm4gZnJvbUhUTUwoZWwpO1xuICAgIH0sXG4gICAgYXNzaWduOiAoaHRtbFByb3BzOiBQYXJ0aWFsPEhUTUxFbGVtZW50PikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbCwgaHRtbFByb3BzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfVxuICB9O1xuICByZXR1cm4gbm9kZVxufVxuXG5cbmV4cG9ydCBjb25zdCBkaXYgPSBodG1sKFwiZGl2XCIpO1xuZXhwb3J0IGNvbnN0IHNwYW4gPSBodG1sKFwic3BhblwiKTtcbmV4cG9ydCBjb25zdCBwID0gaHRtbChcInBcIik7XG5leHBvcnQgY29uc3QgYm9keSA9IGZyb21IVE1MKGRvY3VtZW50LmJvZHkpO1xuZXhwb3J0IGNvbnN0IGgxID0gaHRtbChcImgxXCIpO1xuZXhwb3J0IGNvbnN0IGgyID0gaHRtbChcImgyXCIpO1xuZXhwb3J0IGNvbnN0IGgzID0gaHRtbChcImgzXCIpO1xuZXhwb3J0IGNvbnN0IGg0ID0gaHRtbChcImg0XCIpO1xuZXhwb3J0IGNvbnN0IHRhYmxlID0gaHRtbChcInRhYmxlXCIpO1xuZXhwb3J0IGNvbnN0IHRyID0gaHRtbChcInRyXCIpO1xuZXhwb3J0IGNvbnN0IHRkID0gaHRtbChcInRkXCIpO1xuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNTZiNmMyO1xuICAtLXdoaXRlOiAjYWJiMmJmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMmEyNzJhO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZTA2Yzc1O1xuICAgICAgLS1ncmVlbjogIzk4YzM3OTtcbiAgICAgIC0tYmx1ZTogIzQxOWZlYztcbiAgICAgIC0teWVsbG93OiAjZGRiMTVmO1xuICAgICAgLS1wdXJwbGU6ICNjNjc4ZGQ7XG4gICAgICAtLWN5YW46ICM1NmI2YzI7XG4gICAgICAtLXdoaXRlOiAjYWJiMmJmO1xuICAgICAgLS1ncmF5OiAjYWJiMmJmODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuICB3aGl0ZTogXCJ2YXIoLS13aGl0ZSlcIixcbiAgZ3JheTogXCJ2YXIoLS1ncmF5KVwiLFxuICBjb2xvcjogXCJ2YXIoLS1jb2xvcilcIixcbiAgYmFja2dyb3VuZDogXCJ2YXIoLS1iYWNrZ3JvdW5kKVwiXG59XG5cblxuYm9keS5lbC5zdHlsZSA9YFxuYmFja2dyb3VuZDogJHtjb2xvci5iYWNrZ3JvdW5kfTtcbmNvbG9yOiAke2NvbG9yLmNvbG9yfTtcbmBcbiIsCiAgICAiaW1wb3J0IHtkaXYsIGh0bWwsIHAsIHNwYW4sIGNvbG9yfSBmcm9tIFwiLi9odG1sXCJcbmltcG9ydCB7IHR5cGUgU3ludGF4Tm9kZSB9IGZyb20gXCIuL3BhcnNlclwiXG5cbnR5cGUgUG9zID0geyBjb2w6IG51bWJlciwgcm93OiBudW1iZXIgfVxuXG5jb25zdCBjb2xvck9mID0gKG5vZGU6IFN5bnRheE5vZGUgfCB1bmRlZmluZWQpOiBzdHJpbmcgPT4gXG4gIChub2RlID09IHVuZGVmaW5lZCkgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJjb21tZW50XCIpID8gY29sb3IuZ3JheSA6XG4gIChub2RlLiQgPT09IFwibnVtYmVyXCIgfHwgbm9kZS4kID09PSBcInN0cmluZ1wiICkgPyBjb2xvci55ZWxsb3cgOlxuICAobm9kZS4kID09PSBcInZhclwiKSA/IGNvbG9yLnB1cnBsZSA6XG4gIChub2RlLiQgPT09IFwibGV0XCIgfHwgbm9kZS4kID09IFwiZnVuY3Rpb25cIiApID8gY29sb3IuYmx1ZSA6XG4gIChub2RlLiQgPT09IFwiYXBwXCIpID8gY29sb3IuZ3JlZW4gOlxuICAobm9kZS4kID09PSBcImVycm9yXCIpID8gY29sb3IucmVkIDpcbiAgY29sb3Iud2hpdGVcblxuXG5sZXQgZSA9IDIgYXMgbnVtYmVyXG5cbmV4cG9ydCBjb25zdCBlZGl0b3IgPSAob25pbnB1dDogKHM6c3RyaW5nKT0+dm9pZCxcbiAgZ2V0QXN0TWFwIDogKCk9PiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10sXG4gIGdvVG9EZWYgOiAoYXN0OiBTeW50YXhOb2RlKSA9PiB2b2lkLFxuICBob3ZlckluZm86IChhc3Q6IFN5bnRheE5vZGUpID0+IHN0cmluZyB8IHVuZGVmaW5lZCxcblxuKSA9PiB7XG5cbiAgbGV0IGxpbmVzID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJsaW5lc1wiKT8uc3BsaXQoXCJcXG5cIikgPz8gW1wiXCJdXG4gIGxldCBjdXJzb3IgOiBQb3MgJiB7c2VsZWN0aW9uPyA6IFBvc30gPSB7Y29sOjAsIHJvdzowfTtcblxuICBsZXQgZWwgPSBodG1sKFwicHJlXCIpKClcbiAgLnN0eWxlKHtcbiAgICB1c2VyU2VsZWN0OiBcIm5vbmVcIixcbiAgICBjdXJzb3I6IFwidGV4dFwiLFxuICB9KVxuXG5cbiAgbGV0IGhpc3QgOiBzdHJpbmdbXSA9IFtdXG4gIGxldCBlbGVtZW50cyA9IG5ldyBXZWFrTWFwPEhUTUxFbGVtZW50LCB7cG9zOlBvcywgYXN0PzogU3ludGF4Tm9kZX0+KClcbiAgbGV0IGFzdG1hcDogKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdID0gW11cblxuICBsZXQgcGxlc3MgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDwgYi5jb2wpXG4gIGxldCBwbGVzc2VxID0gKGE6IFBvcywgYjogUG9zKSA9PiBhLnJvdyA8IGIucm93IHx8IChhLnJvdyA9PSBiLnJvdyAmJiBhLmNvbCA8PSBiLmNvbClcblxuICBsZXQgc2VscmFuZ2UgPSAoKSA6IHVuZGVmaW5lZCB8IFtQb3MsIFBvc10gPT4ge1xuICAgIGlmICghY3Vyc29yLnNlbGVjdGlvbikgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGlmIChjdXJzb3Iucm93ID09IGN1cnNvci5zZWxlY3Rpb24ucm93ICYmIGN1cnNvci5jb2wgPT0gY3Vyc29yLnNlbGVjdGlvbi5jb2wpIHtcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKHBsZXNzZXEoY3Vyc29yLCBjdXJzb3Iuc2VsZWN0aW9uKSkgcmV0dXJuIFtjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb25dXG4gICAgZWxzZSByZXR1cm4gW2N1cnNvci5zZWxlY3Rpb24sIGN1cnNvcl1cbiAgfVxuXG4gIGNvbnN0IHJlbmRlciA9ICgpID0+IHtcbiAgICBsZXQgY29kZSA9IGxpbmVzLmpvaW4oXCJcXG5cIilcbiAgICBsZXQgc2NvbCA9IE1hdGgubWluKGN1cnNvci5jb2wsIGxpbmVzW2N1cnNvci5yb3ddPy5sZW5ndGggPz8gMClcblxuICAgIGxldCBjaGFyczogSFRNTEVsZW1lbnRbXSA9IFtdXG5cblxuICAgIGxldCBta2NvbG9yID0gKCkgPT4ge1xuICAgICAgY2hhcnMuZm9yRWFjaCgoYywgaSk9PntcbiAgICAgICAgbGV0IGFzdCA9IGFzdG1hcFtpXVxuICAgICAgICBsZXQgY29sb3IgPSBjb2xvck9mKGFzdClcbiAgICAgICAgaWYgKGNvbG9yKSBjLnN0eWxlLmNvbG9yID0gY29sb3JcbiAgICAgICAgZWxzZSBjLnN0eWxlLmNvbG9yID0gXCJcIlxuICAgICAgICBlbGVtZW50cy5nZXQoYykhLmFzdCA9IGFzdFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG5cblxuICAgIGVsLnJlcGxhY2VDaGlscmVuKC4uLmxpbmVzLm1hcCgobGluZSxyb3cpPT57XG4gICAgICBsZXQgcGFyID0gcChcbiAgICAgICAgLi4ubGluZS5zcGxpdChcIlwiKS5jb25jYXQoJyAnKS5tYXAoXG4gICAgICAgICAgKGNoYXIsY29sKT0+e1xuXG4gICAgICAgICAgICBsZXQgY2hyID0gc3BhbihjaGFyKVxuICAgICAgICAgICAgLnN0eWxlKCByYW5nZSAmJiBwbGVzcyh7cm93LCBjb2x9LCByYW5nZVsxXSkgJiYgcGxlc3NlcShyYW5nZVswXSwge3JvdywgY29sfSkgPyB7YmFja2dyb3VuZENvbG9yOiBcIiM4ZDk2ZmY4NVwiLCBjb2xvcjogY29sb3IuYmFja2dyb3VuZH0gOiB7fSlcbiAgICAgICAgICAgIC5zdHlsZShjdXJzb3Iucm93ID09PSByb3cgJiYgc2NvbCA9PT0gY29sID8ge2JveFNoYWRvdzogYDJweCAwIDAgMCAke2NvbG9yLmNvbG9yfSBpbnNldGAsfSA6IHt9KVxuICAgICAgICAgICAgY2hhcnMucHVzaChjaHIuZWwpXG4gICAgICAgICAgICBlbGVtZW50cy5zZXQoY2hyLmVsLCB7cG9zOiB7cm93LCBjb2x9fSlcbiAgICAgICAgICAgIHJldHVybiBjaHJcbiAgICAgICAgICB9XG4gICAgICAgICksXG4gICAgICApLnN0eWxlKHttYXJnaW46IFwiMFwifSlcbiAgICAgIGVsZW1lbnRzLnNldChwYXIuZWwsIHtwb3M6e3JvdywgY29sOiBsaW5lLmxlbmd0aH19KVxuICAgICAgcmV0dXJuIHBhclxuICAgIH0pKVxuXG4gICAgbWtjb2xvcigpXG5cbiAgICBpZiAoaGlzdFtoaXN0Lmxlbmd0aCAtIDFdICE9IGNvZGUpIHtcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibGluZXNcIiwgY29kZSlcbiAgICAgIG9uaW5wdXQoY29kZSlcbiAgICAgIGhpc3QucHVzaChjb2RlKVxuICAgICAgYXN0bWFwID0gZ2V0QXN0TWFwKClcbiAgICAgIG1rY29sb3IoKVxuICAgIH1cblxuICB9XG5cblxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBlPT57XG4gICAgbGV0IHNldEN1cnNvciA9IChwb3M6UG9zKT0+e1xuICAgICAgaWYgKCFlLnNoaWZ0S2V5KSBjdXJzb3Iuc2VsZWN0aW9uID0gdW5kZWZpbmVkXG4gICAgICBlbHNlIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgIGN1cnNvci5jb2wgPSBwb3MuY29sXG4gICAgICBjdXJzb3Iucm93ID0gcG9zLnJvd1xuICAgIH1cblxuICAgIGxldCBjbGVhcl9yYW5nZSA9ICgpID0+IHtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmICghcmFuZ2UpIHJldHVyblxuICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgcmFuZ2VbMF0ucm93KSwgbGluZXNbcmFuZ2VbMF0ucm93XS5zdWJzdHJpbmcoMCwgcmFuZ2VbMF0uY29sKSArIGxpbmVzW3JhbmdlWzFdLnJvd10uc3Vic3RyaW5nKHJhbmdlWzFdLmNvbCksIC4uLmxpbmVzLnNsaWNlKHJhbmdlWzFdLnJvdyArIDEpXVxuICAgICAgc2V0Q3Vyc29yKHtyb3c6IHJhbmdlWzBdLnJvdywgY29sOiByYW5nZVswXS5jb2x9KVxuICAgIH1cblxuICAgIGlmIChlLmtleS5sZW5ndGggPT09IDEpe1xuICAgICAgaWYgKGUubWV0YUtleSl7XG4gICAgICAgIGlmIChlLmtleSA9PSBcInpcIil7XG4gICAgICAgICAgaWYgKGhpc3QubGVuZ3RoID4gMSl7XG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsZXQgbGFzdCA9IGhpc3RbaGlzdC5sZW5ndGggLSAxXVxuICAgICAgICAgICAgaGlzdC5wb3AoKVxuICAgICAgICAgICAgbGluZXMgPSBsYXN0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzowLCBjb2w6MH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIHJlbmRlcigpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09IFwiY1wiKXtcbiAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgaWYgKHJhbmdlKXtcbiAgICAgICAgICAgIGxldCB0ZXh0ID0gbGluZXMuc2xpY2UocmFuZ2VbMF0ucm93LCByYW5nZVsxXS5yb3cgKyAxKS5tYXAoKGxpbmUsIGkpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGkgPT0gMCAmJiBpID09IHJhbmdlWzFdLnJvdyAtIHJhbmdlWzBdLnJvdykgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbCwgcmFuZ2VbMV0uY29sKVxuICAgICAgICAgICAgICBlbHNlIGlmIChpID09IDApIHJldHVybiBsaW5lLnN1YnN0cmluZyhyYW5nZVswXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcoMCwgcmFuZ2VbMV0uY29sKVxuICAgICAgICAgICAgICBlbHNlIHJldHVybiBsaW5lXG4gICAgICAgICAgICB9KS5qb2luKFwiXFxuXCIpXG4gICAgICAgICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJ2XCIpe1xuICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQucmVhZFRleHQoKS50aGVuKHRleHQgPT4ge1xuICAgICAgICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgICAgICAgY2xlYXJfcmFuZ2UoKVxuICAgICAgICAgICAgbGV0IGluc2VydExpbmVzID0gdGV4dC5zcGxpdChcIlxcblwiKVxuICAgICAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSArIGluc2VydExpbmVzWzBdLCAuLi5pbnNlcnRMaW5lcy5zbGljZSgxLCAtMSksIGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXSArIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sKSA6IGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sKSwgLi4ubGluZXMuc2xpY2UoY3Vyc29yLnJvdyArIDEpXVxuICAgICAgICAgICAgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyBpbnNlcnRMaW5lcy5sZW5ndGggLSAxLCBjb2w6IChpbnNlcnRMaW5lcy5sZW5ndGggPiAxID8gaW5zZXJ0TGluZXNbaW5zZXJ0TGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoIDogY3Vyc29yLmNvbCArIGluc2VydExpbmVzWzBdLmxlbmd0aCl9KVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBsaW5lc1tjdXJzb3Iucm93XSA9IGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSArIGUua2V5ICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBjdXJzb3Iuc2VsZWN0aW9uID0gdW5kZWZpbmVkXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJCYWNrc3BhY2VcIil7XG4gICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICBpZiAocmFuZ2Upe1xuICAgICAgICBjbGVhcl9yYW5nZSgpXG5cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGUubWV0YUtleSAmJiBjdXJzb3IuY29sID4gMCl7XG4gICAgICAgIGxpbmVzID0gWy4uLmxpbmVzLnNsaWNlKDAsIGN1cnNvci5yb3cpLCBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoIGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgIGN1cnNvci5jb2wgPSAwXG4gICAgICBcbiAgICAgIH1lbHNlIGlmIChjdXJzb3IuY29sID4gMCl7XG4gICAgICAgIGN1cnNvci5jb2wtLVxuICAgICAgICBsaW5lc1tjdXJzb3Iucm93XSA9IGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSArIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyhjdXJzb3IuY29sICsgMSlcbiAgICAgIH1lbHNlIGlmIChjdXJzb3Iucm93ID4gMCl7XG4gICAgICAgIGN1cnNvci5yb3ctLVxuICAgICAgICBjdXJzb3IuY29sID0gbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoXG4gICAgICAgIGxpbmVzID0gWy4uLmxpbmVzLnNsaWNlKDAsIGN1cnNvci5yb3cpLCBsaW5lc1tjdXJzb3Iucm93XSArIGxpbmVzW2N1cnNvci5yb3cgKyAxXSwgLi4ubGluZXMuc2xpY2UoY3Vyc29yLnJvdyArIDIpXVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd0xlZnRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiAwfSlcbiAgICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93IC0gMSwgY29sOiBsaW5lc1tjdXJzb3Iucm93IC0gMV0ubGVuZ3RofSlcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sIC0gMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuXG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1JpZ2h0XCIpe1xuICAgICAgaWYgKGUubWV0YUtleSl7XG4gICAgICAgIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGh9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA8IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbCArIDF9KVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA8IGxpbmVzLmxlbmd0aCAtIDEpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93ICsgMSwgY29sOiAwfSlcbiAgICB9XG5cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dVcFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpIHNldEN1cnNvcih7cm93OiAwLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93IC0gMSwgY29sOiBjdXJzb3IuY29sfSlcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93RG93blwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpIHNldEN1cnNvcih7cm93OiBsaW5lcy5sZW5ndGggLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLnJvdyA8IGxpbmVzLmxlbmd0aCAtIDEpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93ICsgMSwgY29sOiBjdXJzb3IuY29sfSlcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpe1xuICAgICAgbGluZXMgPSBbXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKDAsIGN1cnNvci5yb3cpLFxuICAgICAgICBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoMCwgY3Vyc29yLmNvbCksXG4gICAgICAgIChsaW5lc1tjdXJzb3Iucm93XS5tYXRjaCgvXlxccyovKT8uWzBdIHx8IFwiXCIpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLFxuICAgICAgICAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICBjdXJzb3Iucm93KytcbiAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5tYXRjaCgvXlxccyovKT8uWzBdLmxlbmd0aCB8fCAwXG4gICAgfVxuXG5cbiAgICBpZiAoZS5rZXkuc3RhcnRzV2l0aChcIkFycm93XCIpKXtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIH1cblxuICAgIHJlbmRlcigpXG5cbiAgfSlcblxuXG4gIGxldCBtb3VzZWRvd249IGZhbHNlICBcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBlPT57XG4gICAgaWYgKGUubWV0YUtleSkge1xuICAgICAgbGV0IGFzdCA9IGVsZW1lbnRzLmdldChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCk/LmFzdFxuICAgICAgaWYgKGFzdCkgZ29Ub0RlZihhc3QpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgbW91c2Vkb3duID0gdHJ1ZVxuICAgIGlmIChlbGVtZW50cy5oYXMoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpKXtcbiAgICAgIGN1cnNvciA9IGVsZW1lbnRzLmdldChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkhLnBvc1xuICAgICAgcmVuZGVyKClcbiAgICB9XG4gIH0pXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgZT0+e1xuICAgIGlmIChtb3VzZWRvd24pIHtcbiAgICAgIGlmIChlbGVtZW50cy5oYXMoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpKXtcbiAgICAgICAgbGV0IHBvcyA9IGVsZW1lbnRzLmdldChlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkhLnBvc1xuICAgICAgICBjdXJzb3Iuc2VsZWN0aW9uID0gY3Vyc29yLnNlbGVjdGlvbiB8fCB7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2x9XG4gICAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgICAgIGN1cnNvci5jb2wgPSBwb3MuY29sXG4gICAgICAgIHJlbmRlcigpXG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSB7XG4gICAgICAgIGxldCBpbmZvID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdihpbmZvKS5zdHlsZSh7XG4gICAgICAgICAgICBwb3NpdGlvbjogXCJmaXhlZFwiLFxuICAgICAgICAgICAgbGVmdDogZS5jbGllbnRYICsgXCJweFwiLFxuICAgICAgICAgICAgYm90dG9tOiAod2luZG93LmlubmVySGVpZ2h0IC0gZS5jbGllbnRZICsgMTApICsgXCJweFwiLFxuICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBjb2xvci5iYWNrZ3JvdW5kLFxuICAgICAgICAgICAgY29sb3I6IGNvbG9yLmNvbG9yLFxuICAgICAgICAgICAgYm9yZGVyOiBcIjFweCBzb2xpZCBcIiArIGNvbG9yLndoaXRlLFxuICAgICAgICAgICAgcGFkZGluZzogXCI4cHggMTJweFwiLFxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiBcIjRweFwiLFxuICAgICAgICAgICAgcG9pbnRlckV2ZW50czogXCJub25lXCIsXG4gICAgICAgICAgICB6SW5kZXg6IFwiMTAwMFwiLFxuICAgICAgICAgICAgd2hpdGVTcGFjZTogXCJwcmVcIixcbiAgICAgICAgICB9KVxuICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9vbHRpcC5lbClcbiAgICAgICAgICBsZXQgcmVtb3ZlID0gKCkgPT4ge1xuICAgICAgICAgICAgdG9vbHRpcC5lbC5yZW1vdmUoKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgbW92ZSlcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgbW92ZSA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgICAgaWYgKGUubWV0YUtleSkgcmV0dXJuIHJlbW92ZSgpXG4gICAgICAgICAgICB0b29sdGlwLnN0eWxlKHtcbiAgICAgICAgICAgICAgbGVmdDogZS5jbGllbnRYICsgXCJweFwiLFxuICAgICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgb3V0ID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgIGlmIChlLnJlbGF0ZWRUYXJnZXQgPT09IHRvb2x0aXAuZWwpIHJldHVyblxuICAgICAgICAgICAgcmVtb3ZlKClcbiAgICAgICAgICB9XG4gICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgbW92ZSlcbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsIG91dClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgZT0+IHtcbiAgICBtb3VzZWRvd24gPSBmYWxzZVxuICB9KVxuXG5cbiAgcmVuZGVyKClcbiAgcmV0dXJuIHtlbCxcbiAgICBzZXRUZXh0OiAodGV4dDpzdHJpbmcpID0+IHtcbiAgICAgIGxpbmVzID0gdGV4dC5zcGxpdChcIlxcblwiKVxuICAgICAgcmVuZGVyKClcbiAgICB9LFxuICAgIHNldEN1cnNvcjogKHBvczogUG9zKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZyhcInNldHRpbmcgY3Vyc29yIHRvXCIsIHBvcylcbiAgICAgIGN1cnNvciA9IHBvc1xuICAgICAgcmVuZGVyKClcbiAgICB9XG4gIH1cblxuICBcbn1cbiIsCiAgICAiaW1wb3J0IHt0eXBlIEVudn0gZnJvbSBcIi4vcnVudGltZVwiXG5leHBvcnQgdHlwZSBQb3MgPSB7b2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXJ9XG5leHBvcnQgdHlwZSBTcGFuID0ge3N0YXJ0OiBQb3MsIGVuZDogUG9zfVxuXG5leHBvcnQgdHlwZSBUYWcgPFQgZXh0ZW5kcyBzdHJpbmcsIEM+ID0geyQ6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4sIHR5cGU/OiBBU1R9XG5cbmV4cG9ydCB0eXBlIFZhciA9IFRhZzxcInZhclwiLCB7bmFtZTogc3RyaW5nfT5cbmV4cG9ydCB0eXBlIENvbW1lbnQgPSBUYWc8XCJjb21tZW50XCIsIHN0cmluZz5cbmV4cG9ydCB0eXBlIEZ1bmMgPSBUYWc8XCJmdW5jdGlvblwiLCB7dmFyczogVmFyW10sIGJvZHk6IEFTVCwgZW52PyA6RW52fT5cblxuZXhwb3J0IHR5cGUgRXJyb3JOb2RlID0gVGFnPFwiZXJyb3JcIiwge21lc3NhZ2U6IHN0cmluZywgY29udGVudDogc3RyaW5nfT5cblxuZXhwb3J0IHR5cGUgQVNUID1cbiAgfCBUYWc8XCJhcHBcIiwge2ZuOiBBU1QsIGFyZ3M6IEFTVFtdfT5cbiAgfCBWYXJcbiAgfCBGdW5jXG4gIHwgVGFnPFwibnVtYmVyXCIsIG51bWJlcj5cbiAgfCBUYWc8XCJzdHJpbmdcIiwgc3RyaW5nPlxuICB8IFRhZzxcImxldFwiLCB7dmFyOiBWYXIsIHZhbHVlOiBBU1QsIGJvZHk6IEFTVH0+XG4gIHwgVGFnPFwicmVjb3JkXCIsIFtWYXIsIEFTVF1bXT5cbiAgfCBFcnJvck5vZGVcblxuZXhwb3J0IHR5cGUgU3ludGF4Tm9kZSA9IEFTVCB8IENvbW1lbnRcbmV4cG9ydCB0eXBlIFBhcnNlUmVzdWx0ID0ge2FzdDogQVNULCBjb21tZW50czogQ29tbWVudFtdLCBhc3RtYXA6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdfVxuXG5jb25zdCBoYXNTaG93blR5cGUgPSAodjogVmFyKSA9PiB2LnR5cGUgJiYgISh2LnR5cGUuJCA9PT0gXCJ2YXJcIiAmJiB2LnR5cGUuY29udGVudC5uYW1lID09PSBcImFueVwiKVxuY29uc3QgcHJldHR5QmluZGVyID0gKHY6IFZhcik6IHN0cmluZyA9PiBoYXNTaG93blR5cGUodikgPyBgKCR7cHJldHR5QVNUKHYudHlwZSEpfSAke3YuY29udGVudC5uYW1lfSlgIDogdi5jb250ZW50Lm5hbWVcblxuZXhwb3J0IGNvbnN0IHByZXR0eUFTVCA9IChub2RlOiBBU1QpOiBzdHJpbmcgPT57XG4gIHN3aXRjaChub2RlLiQpe1xuICAgIGNhc2UgXCJudW1iZXJcIiA6IHJldHVybiBub2RlLmNvbnRlbnQudG9TdHJpbmcoKVxuICAgIGNhc2UgXCJzdHJpbmdcIiA6IHJldHVybiBKU09OLnN0cmluZ2lmeShub2RlLmNvbnRlbnQpXG4gICAgY2FzZSBcInZhclwiOiByZXR1cm4gbm9kZS5jb250ZW50Lm5hbWVcbiAgICBjYXNlIFwibGV0XCI6IHJldHVybiBgbGV0ICR7cHJldHR5QmluZGVyKG5vZGUuY29udGVudC52YXIpfSA9ICR7cHJldHR5QVNUKG5vZGUuY29udGVudC52YWx1ZSl9IGluXFxuJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIGBmbiAke25vZGUuY29udGVudC52YXJzLm1hcChwcmV0dHlCaW5kZXIpLmpvaW4oXCIgXCIpfSA9PiAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQuYm9keSl9YFxuICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGAoJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmZuKX0gJHtub2RlLmNvbnRlbnQuYXJncy5tYXAocHJldHR5QVNUKS5qb2luKFwiIFwiKX0pYFxuICAgIGNhc2UgXCJyZWNvcmRcIjogcmV0dXJuIGB7JHtub2RlLmNvbnRlbnQubWFwKChbaywgdl0pID0+IGAke2suY29udGVudC5uYW1lfTogJHtwcmV0dHlBU1Qodil9YCkuam9pbihcIiwgXCIpfX1gXG4gICAgY2FzZSBcImVycm9yXCI6IHJldHVybiBgW0VSUk9SOiAke25vZGUuY29udGVudC5tZXNzYWdlfV1gXG4gIH1cbn1cblxuXG5jb25zdCB6ZXJvUG9zID0gKCk6IFBvcyA9PiAoe29mZnNldDogMCwgbGluZTogMSwgY29sOiAxfSlcbmNvbnN0IHplcm9TcGFuID0gKCk6IFNwYW4gPT4gKHtzdGFydDogemVyb1BvcygpLCBlbmQ6IHplcm9Qb3MoKX0pXG5cbmV4cG9ydCBjb25zdCBta0FzdCA9IDxUIGV4dGVuZHMgc3RyaW5nLCBDPih0YWc6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4gPSB6ZXJvU3BhbigpKTogVGFnPFQsIEM+ID0+ICh7JDogdGFnLCBjb250ZW50LCBzcGFufSlcblxudHlwZSBUb2tlbkJhc2UgPSB7c3BhbjogU3Bhbn1cblxudHlwZSBUb2tlbiA9XG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImlkZW50XCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJudW1iZXJcIiwgdmFsdWU6IG51bWJlcn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcInN0cmluZ1wiLCB2YWx1ZTogc3RyaW5nfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImFycm93XCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJjb21tZW50XCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlOiBcImxldFwiIHwgXCJpblwiIHwgXCJmblwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9KVxuXG50eXBlIFRva2VuTm9TcGFuID0gVG9rZW4gZXh0ZW5kcyBpbmZlciBUID8gVCBleHRlbmRzIHtzcGFuOiBTcGFufSA/IE9taXQ8VCwgXCJzcGFuXCI+IDogbmV2ZXIgOiBuZXZlclxuXG5jb25zdCB0b2tlbml6ZSA9IChjb2RlOiBzdHJpbmcpOiB7dG9rZW5zOiBUb2tlbltdLCBjb21tZW50czogQ29tbWVudFtdLCBlb2Y6IFBvc30gPT4ge1xuICBsZXQgdG9rZW5zOiBUb2tlbltdID0gW11cbiAgbGV0IGNvbW1lbnRzOiBDb21tZW50W10gPSBbXVxuICBsZXQgaSA9IDBcbiAgbGV0IGxpbmUgPSAxXG4gIGxldCBjb2wgPSAxXG5cbiAgbGV0IGlzQWxwaGEgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtel9dLy50ZXN0KGNoYXIpXG4gIGxldCBpc0RpZ2l0ID0gKGNoYXI6IHN0cmluZykgPT4gL1swLTldLy50ZXN0KGNoYXIpXG4gIGxldCBpc0lkZW50ID0gKGNoYXI6IHN0cmluZykgPT4gL1tBLVphLXowLTlfXS8udGVzdChjaGFyKVxuICBsZXQgcG9zID0gKCk6IFBvcyA9PiAoe29mZnNldDogaSwgbGluZSwgY29sfSlcbiAgbGV0IGFkdmFuY2UgPSAoKSA9PiB7XG4gICAgaWYgKGNvZGVbaV0gPT09IFwiXFxuXCIpIHtcbiAgICAgIGkrK1xuICAgICAgbGluZSsrXG4gICAgICBjb2wgPSAxXG4gICAgfSBlbHNlIHtcbiAgICAgIGkrK1xuICAgICAgY29sKytcbiAgICB9XG4gIH1cbiAgbGV0IHB1c2ggPSAodG9rZW46IFRva2VuTm9TcGFuLCBzdGFydDogUG9zKSA9PiB7XG4gICAgdG9rZW5zLnB1c2goey4uLnRva2VuLCBzcGFuOiB7c3RhcnQsIGVuZDogcG9zKCl9fSBhcyBUb2tlbilcbiAgfVxuXG4gIHdoaWxlIChpIDwgY29kZS5sZW5ndGgpIHtcbiAgICBsZXQgY2hhciA9IGNvZGVbaV1cblxuICAgIGlmICgvXFxzLy50ZXN0KGNoYXIpKSB7XG4gICAgICBhZHZhbmNlKClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09IFwiL1wiICYmIGNvZGVbaSArIDFdID09PSBcIi9cIikge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGNvZGVbaV0gIT09IFwiXFxuXCIpIGFkdmFuY2UoKVxuICAgICAgY29tbWVudHMucHVzaChta0FzdChcImNvbW1lbnRcIiwgY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpLCB7c3RhcnQsIGVuZDogcG9zKCl9KSlcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09IFwiPVwiICYmIGNvZGVbaSArIDFdID09PSBcIj5cIikge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcImFycm93XCJ9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKFwiKCl7fT0sOlwiLmluY2x1ZGVzKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlID0gY2hhciBhcyBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIlxuICAgICAgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcInN5bWJvbFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gJ1wiJykge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gXCJcIlxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IGNvZGVbaV1cbiAgICAgICAgaWYgKGN1cnJlbnQgPT09IFwiXFxcXFwiKSB7XG4gICAgICAgICAgbGV0IG5leHQgPSBjb2RlW2kgKyAxXVxuICAgICAgICAgIGlmIChuZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGFkdmFuY2UoKVxuICAgICAgICAgICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBcIlVudGVybWluYXRlZCBzdHJpbmcgZXNjYXBlXCIsIGNvbnRlbnQ6IGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKX0sIHN0YXJ0KVxuICAgICAgICAgICAgcmV0dXJuIHt0b2tlbnMsIGNvbW1lbnRzLCBlb2Y6IHBvcygpfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgZXNjYXBlZCA9ICh7bjogXCJcXG5cIiwgcjogXCJcXHJcIiwgdDogXCJcXHRcIiwgJ1wiJzogJ1wiJywgXCJcXFxcXCI6IFwiXFxcXFwifSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KVtuZXh0XVxuICAgICAgICAgIHZhbHVlICs9IGVzY2FwZWQgPz8gbmV4dFxuICAgICAgICAgIGFkdmFuY2UoKVxuICAgICAgICAgIGFkdmFuY2UoKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnJlbnQgPT09ICdcIicpIGJyZWFrXG4gICAgICAgIHZhbHVlICs9IGN1cnJlbnRcbiAgICAgICAgYWR2YW5jZSgpXG4gICAgICB9XG4gICAgICBpZiAoY29kZVtpXSAhPT0gJ1wiJykge1xuICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBsaXRlcmFsXCIsIGNvbnRlbnQ6IGNvZGUuc2xpY2Uoc3RhcnQub2Zmc2V0LCBpKX0sIHN0YXJ0KVxuICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICB9XG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0RpZ2l0KGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzRGlnaXQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJudW1iZXJcIiwgdmFsdWU6IE51bWJlcihjb2RlLnNsaWNlKHZhbHVlU3RhcnQsIGkpKX0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoaXNBbHBoYShjaGFyKSkge1xuICAgICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICAgIGxldCB2YWx1ZVN0YXJ0ID0gaVxuICAgICAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCAmJiBpc0lkZW50KGNvZGVbaV0pKSBhZHZhbmNlKClcbiAgICAgIGxldCB2YWx1ZSA9IGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSlcbiAgICAgIGlmICh2YWx1ZSA9PT0gXCJsZXRcIiB8fCB2YWx1ZSA9PT0gXCJpblwiIHx8IHZhbHVlID09PSBcImZuXCIpIHB1c2goe3R5cGU6IFwia2V5d29yZFwiLCB2YWx1ZX0sIHN0YXJ0KVxuICAgICAgZWxzZSBwdXNoKHt0eXBlOiBcImlkZW50XCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgYWR2YW5jZSgpXG4gICAgcHVzaCh7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBgVW5leHBlY3RlZCBjaGFyYWN0ZXI6ICR7Y2hhcn1gLCBjb250ZW50OiBjaGFyfSwgc3RhcnQpXG4gIH1cblxuICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG59XG5cbmNsYXNzIFBhcnNlciB7XG4gIHByaXZhdGUgaSA9IDBcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRva2VuczogVG9rZW5bXSwgcHJpdmF0ZSBzb3VyY2U6IHN0cmluZywgcHJpdmF0ZSBlb2Y6IFBvcykge31cblxuICBwYXJzZSgpOiBBU1Qge1xuICAgIGxldCBhc3QgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgaWYgKHRoaXMucGVlaygpKSB7XG4gICAgICBsZXQgc3RhcnQgPSB0aGlzLnBlZWsoKSEuc3Bhbi5zdGFydFxuICAgICAgbGV0IGVuZCA9IHRoaXMudG9rZW5zW3RoaXMudG9rZW5zLmxlbmd0aCAtIDFdPy5zcGFuLmVuZCA/PyBzdGFydFxuICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW5leHBlY3RlZCBleHRyYSBpbnB1dCBhZnRlciBleHByZXNzaW9uXCIsIHtzdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uoc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICB9XG4gICAgcmV0dXJuIGFzdFxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUV4cHIoKTogQVNUIHtcbiAgICBpZiAodGhpcy5pc0tleXdvcmQoXCJsZXRcIikpIHJldHVybiB0aGlzLnBhcnNlTGV0KClcbiAgICBpZiAodGhpcy5pc0tleXdvcmQoXCJmblwiKSkgcmV0dXJuIHRoaXMucGFyc2VGdW5jdGlvbigpXG4gICAgcmV0dXJuIHRoaXMucGFyc2VBdG9tKClcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VMZXQoKTogQVNUIHtcbiAgICBsZXQgc3RhcnQgPSB0aGlzLmV4cGVjdEtleXdvcmQoXCJsZXRcIikuc3Bhbi5zdGFydFxuICAgIGxldCB2YXJpYWJsZSA9IHRoaXMucGFyc2VMZXRCaW5kZXIoKVxuICAgIGlmICh2YXJpYWJsZS4kID09PSBcImVycm9yXCIpIHJldHVybiB2YXJpYWJsZVxuXG4gICAgbGV0IHZhbHVlOiBBU1RcbiAgICBpZiAodGhpcy5pc1N5bWJvbChcIj1cIikpIHtcbiAgICAgIHRoaXMuZXhwZWN0U3ltYm9sKFwiPVwiKVxuICAgICAgdmFsdWUgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnPScgYWZ0ZXIgbGV0IGJpbmRpbmcgbmFtZVwiKVxuICAgIH1cblxuICAgIGxldCBib2R5OiBBU1RcbiAgICBpZiAodGhpcy5pc0tleXdvcmQoXCJpblwiKSkge1xuICAgICAgdGhpcy5leHBlY3RLZXl3b3JkKFwiaW5cIilcbiAgICAgIGJvZHkgPSB0aGlzLnBhcnNlRXhwcigpXG4gICAgfSBlbHNlIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQga2V5d29yZCBpbiBhZnRlciBsZXQgYmluZGluZ1wiLCB0aGlzLnBhcnNlRXhwcigpKSA6IHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQga2V5d29yZCBpbiBhZnRlciBsZXQgYmluZGluZ1wiKVxuICAgIH1cblxuICAgIHJldHVybiBta0FzdChcImxldFwiLCB7dmFyOiB2YXJpYWJsZSwgdmFsdWUsIGJvZHl9LCB7c3RhcnQsIGVuZDogYm9keS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlRnVuY3Rpb24oKTogQVNUIHtcbiAgICBsZXQgc3RhcnQgPSB0aGlzLmV4cGVjdEtleXdvcmQoXCJmblwiKS5zcGFuLnN0YXJ0XG4gICAgbGV0IHZhcnM6IFZhcltdID0gW11cbiAgICB3aGlsZSAodGhpcy5wZWVrKCk/LnR5cGUgPT09IFwiaWRlbnRcIiB8fCB0aGlzLmlzU3ltYm9sKFwiKFwiKSkge1xuICAgICAgbGV0IGJpbmRlciA9IHRoaXMucGFyc2VCaW5kZXIoKVxuICAgICAgaWYgKGJpbmRlci4kID09PSBcImVycm9yXCIpIHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzLCBib2R5OiBiaW5kZXJ9LCB7c3RhcnQsIGVuZDogYmluZGVyLnNwYW4uZW5kfSlcbiAgICAgIHZhcnMucHVzaChiaW5kZXIpXG4gICAgfVxuICAgIGxldCBib2R5OiBBU1RcbiAgICBpZiAodmFycy5sZW5ndGggPT09IDApIHtcbiAgICAgIGlmICh0aGlzLm1hdGNoVG9rZW4oXCJhcnJvd1wiKSkgYm9keSA9IHRoaXMud3JhcEVycm9yKFwiRnVuY3Rpb24gcmVxdWlyZXMgYXQgbGVhc3Qgb25lIHBhcmFtZXRlclwiLCB0aGlzLnBhcnNlRXhwcigpKVxuICAgICAgZWxzZSBib2R5ID0gdGhpcy5wZWVrKCkgPyB0aGlzLndyYXBFcnJvcihcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgdGhpcy5wYXJzZUV4cHIoKSkgOiB0aGlzLmVycm9ySGVyZShcIkZ1bmN0aW9uIHJlcXVpcmVzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXJcIiwgc3RhcnQpXG4gICAgfSBlbHNlIGlmICghdGhpcy5tYXRjaFRva2VuKFwiYXJyb3dcIikpIHtcbiAgICAgIGJvZHkgPSB0aGlzLnBlZWsoKSA/IHRoaXMud3JhcEVycm9yKFwiRXhwZWN0ZWQgJz0+JyBhZnRlciBmdW5jdGlvbiBwYXJhbWV0ZXJzXCIsIHRoaXMucGFyc2VFeHByKCkpIDogdGhpcy5lcnJvckhlcmUoXCJFeHBlY3RlZCAnPT4nIGFmdGVyIGZ1bmN0aW9uIHBhcmFtZXRlcnNcIilcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMucGFyc2VFeHByKClcbiAgICB9XG4gICAgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHl9LCB7c3RhcnQsIGVuZDogYm9keS5zcGFuLmVuZH0pXG4gIH1cblxuICBwcml2YXRlIHBhcnNlQXRvbSgpOiBBU1Qge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiVW5leHBlY3RlZCBlbmQgb2YgaW5wdXRcIilcblxuICAgIGlmICh0b2tlbi50eXBlID09PSBcImlkZW50XCIpIHtcbiAgICAgIHRoaXMuaSsrXG4gICAgICByZXR1cm4gbWtBc3QoXCJ2YXJcIiwge25hbWU6IHRva2VuLnZhbHVlfSwgdG9rZW4uc3BhbilcbiAgICB9XG5cblxuICAgIGlmICh0b2tlbi50eXBlID09PSBcIm51bWJlclwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwibnVtYmVyXCIsIHRva2VuLnZhbHVlLCB0b2tlbi5zcGFuKVxuICAgIH1cblxuICAgIGlmICh0b2tlbi50eXBlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwic3RyaW5nXCIsIHRva2VuLnZhbHVlLCB0b2tlbi5zcGFuKVxuICAgIH1cbiAgICBpZiAodG9rZW4udHlwZSA9PT0gXCJlcnJvclwiKSB7XG4gICAgICB0aGlzLmkrK1xuICAgICAgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IHRva2VuLm1lc3NhZ2UsIGNvbnRlbnQ6IHRva2VuLmNvbnRlbnR9LCB0b2tlbi5zcGFuKVxuICAgIH1cblxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiKFwiKSkgcmV0dXJuIHRoaXMucGFyc2VQYXJlbnMoKVxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwie1wiKSkgcmV0dXJuIHRoaXMucGFyc2VSZWNvcmQoKVxuXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoYFVuZXhwZWN0ZWQgdG9rZW46ICR7dGhpcy5kZXNjcmliZSh0b2tlbil9YCwgdG9rZW4uc3BhbilcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VQYXJlbnMoKTogQVNUIHtcbiAgICBsZXQgb3BlbiA9IHRoaXMuZXhwZWN0U3ltYm9sKFwiKFwiKVxuICAgIGxldCBpdGVtczogQVNUW10gPSBbXVxuICAgIHdoaWxlICghdGhpcy5pc1N5bWJvbChcIilcIikpIHtcbiAgICAgIGlmICghdGhpcy5wZWVrKCkpIHtcbiAgICAgICAgbGV0IGVuZCA9IGl0ZW1zLmxlbmd0aCA+IDAgPyBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBpdGVtcy5wdXNoKHRoaXMucGFyc2VFeHByKCkpXG4gICAgfVxuICAgIGxldCBjbG9zZSA9IHRoaXMuZXhwZWN0U3ltYm9sKFwiKVwiKVxuICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHJldHVybiB0aGlzLmVycm9yTm9kZShcIkVtcHR5IHBhcmVudGhlc2VzIGFyZSBub3QgYWxsb3dlZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0sIHRoaXMuc291cmNlLnNsaWNlKG9wZW4uc3Bhbi5zdGFydC5vZmZzZXQsIGNsb3NlLnNwYW4uZW5kLm9mZnNldCkpXG4gICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMSkgcmV0dXJuIGl0ZW1zWzBdXG4gICAgcmV0dXJuIG1rQXN0KFwiYXBwXCIsIHtmbjogaXRlbXNbMF0sIGFyZ3M6IGl0ZW1zLnNsaWNlKDEpfSwge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVJlY29yZCgpOiBBU1Qge1xuICAgIGxldCBvcGVuID0gdGhpcy5leHBlY3RTeW1ib2woXCJ7XCIpXG4gICAgbGV0IGZpZWxkczogW1ZhciwgQVNUXVtdID0gW11cblxuICAgIHdoaWxlICghdGhpcy5pc1N5bWJvbChcIn1cIikpIHtcbiAgICAgIGlmICghdGhpcy5wZWVrKCkpIHtcbiAgICAgICAgbGV0IGVuZCA9IGZpZWxkcy5sZW5ndGggPiAwID8gZmllbGRzW2ZpZWxkcy5sZW5ndGggLSAxXVsxXS5zcGFuLmVuZCA6IG9wZW4uc3Bhbi5lbmRcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3JOb2RlKFwiVW50ZXJtaW5hdGVkIHJlY29yZFwiLCB7c3RhcnQ6IG9wZW4uc3Bhbi5zdGFydCwgZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgZW5kLm9mZnNldCkpXG4gICAgICB9XG4gICAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKCkhXG4gICAgICAgIHRoaXMuaSsrXG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShgRXhwZWN0ZWQgcmVjb3JkIGZpZWxkIG5hbWUsIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWAsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmQ6IHRva2VuLnNwYW4uZW5kfSwgdGhpcy5zb3VyY2Uuc2xpY2Uob3Blbi5zcGFuLnN0YXJ0Lm9mZnNldCwgdG9rZW4uc3Bhbi5lbmQub2Zmc2V0KSlcbiAgICAgIH1cbiAgICAgIGxldCBrZXkgPSBta0FzdChcInZhclwiLCB7bmFtZTogbmFtZS52YWx1ZX0sIG5hbWUuc3BhbilcbiAgICAgIGxldCB2YWx1ZSA9IHRoaXMuaXNTeW1ib2woXCI6XCIpXG4gICAgICAgID8gKHRoaXMuZXhwZWN0U3ltYm9sKFwiOlwiKSwgdGhpcy5pc1N5bWJvbChcIn1cIikgPyB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIHJlY29yZCBmaWVsZCB2YWx1ZSBhZnRlciAnOidcIikgOiB0aGlzLnBhcnNlRXhwcigpKVxuICAgICAgICA6IGtleVxuICAgICAgZmllbGRzLnB1c2goW2tleSwgdmFsdWVdKVxuICAgICAgaWYgKHRoaXMuaXNTeW1ib2woXCIsXCIpKSB0aGlzLmkrK1xuICAgICAgZWxzZSBicmVha1xuICAgIH1cblxuICAgIGlmICghdGhpcy5pc1N5bWJvbChcIn1cIikpIHtcbiAgICAgIGxldCBlbmQgPSBmaWVsZHMubGVuZ3RoID4gMCA/IGZpZWxkc1tmaWVsZHMubGVuZ3RoIC0gMV1bMV0uc3Bhbi5lbmQgOiBvcGVuLnNwYW4uZW5kXG4gICAgICByZXR1cm4gdGhpcy5lcnJvck5vZGUoXCJVbnRlcm1pbmF0ZWQgcmVjb3JkXCIsIHtzdGFydDogb3Blbi5zcGFuLnN0YXJ0LCBlbmR9LCB0aGlzLnNvdXJjZS5zbGljZShvcGVuLnNwYW4uc3RhcnQub2Zmc2V0LCBlbmQub2Zmc2V0KSlcbiAgICB9XG4gICAgbGV0IGNsb3NlID0gdGhpcy5leHBlY3RTeW1ib2woXCJ9XCIpXG4gICAgcmV0dXJuIG1rQXN0KFwicmVjb3JkXCIsIGZpZWxkcywge3N0YXJ0OiBvcGVuLnNwYW4uc3RhcnQsIGVuZDogY2xvc2Uuc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUJpbmRlcigpOiBWYXIgfCBUYWc8XCJlcnJvclwiLCB7bWVzc2FnZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmd9PiB7XG4gICAgaWYgKHRoaXMuaXNTeW1ib2woXCIoXCIpKSB7XG4gICAgICB0aGlzLmV4cGVjdFN5bWJvbChcIihcIilcbiAgICAgIGxldCBkZWNsYXJlZFR5cGUgPSB0aGlzLnBhcnNlQXRvbSgpXG4gICAgICBsZXQgbmFtZSA9IHRoaXMubWF0Y2hUb2tlbihcImlkZW50XCIpXG4gICAgICBpZiAoIW5hbWUpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkIGlkZW50aWZpZXIgaW4gYmluZGVyIHBhdHRlcm5cIilcbiAgICAgIGlmICghdGhpcy5pc1N5bWJvbChcIilcIikpIHJldHVybiB0aGlzLmVycm9ySGVyZShcIkV4cGVjdGVkICcpJyBhZnRlciBiaW5kZXIgcGF0dGVyblwiKVxuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCIpXCIpXG4gICAgICBpZiAoZGVjbGFyZWRUeXBlLiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGRlY2xhcmVkVHlwZVxuICAgICAgbGV0IHZhcmlhYmxlID0gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5hbWUudmFsdWV9LCBuYW1lLnNwYW4pXG4gICAgICB2YXJpYWJsZS50eXBlID0gZGVjbGFyZWRUeXBlXG4gICAgICByZXR1cm4gdmFyaWFibGVcbiAgICB9XG4gICAgbGV0IG5hbWUgPSB0aGlzLm1hdGNoVG9rZW4oXCJpZGVudFwiKVxuICAgIGlmICghbmFtZSkgcmV0dXJuIHRoaXMuZXJyb3JIZXJlKFwiRXhwZWN0ZWQgaWRlbnRpZmllclwiKVxuICAgIGxldCB2YXJpYWJsZSA9IG1rQXN0KFwidmFyXCIsIHtuYW1lOiBuYW1lLnZhbHVlfSwgbmFtZS5zcGFuKVxuICAgIGlmICh0aGlzLmlzU3ltYm9sKFwiOlwiKSkge1xuICAgICAgdGhpcy5leHBlY3RTeW1ib2woXCI6XCIpXG4gICAgICBsZXQgZGVjbGFyZWRUeXBlID0gdGhpcy5wYXJzZUF0b20oKVxuICAgICAgaWYgKGRlY2xhcmVkVHlwZS4kID09PSBcImVycm9yXCIpIHJldHVybiBkZWNsYXJlZFR5cGVcbiAgICAgIHZhcmlhYmxlLnR5cGUgPSBkZWNsYXJlZFR5cGVcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhYmxlXG4gIH1cblxuICBwcml2YXRlIHBhcnNlTGV0QmluZGVyKCk6IFZhciB8IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+IHtcbiAgICByZXR1cm4gdGhpcy5wYXJzZUJpbmRlcigpXG4gIH1cblxuICBwcml2YXRlIHBlZWsoKTogVG9rZW4gfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLnRva2Vuc1t0aGlzLmldXG4gIH1cblxuICBwcml2YXRlIGlzS2V5d29yZCh2YWx1ZTogXCJsZXRcIiB8IFwiaW5cIiB8IFwiZm5cIik6IGJvb2xlYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgcmV0dXJuIHRva2VuPy50eXBlID09PSBcImtleXdvcmRcIiAmJiB0b2tlbi52YWx1ZSA9PT0gdmFsdWVcbiAgfVxuXG4gIHByaXZhdGUgaXNTeW1ib2wodmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiKTogYm9vbGVhbiB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICByZXR1cm4gdG9rZW4/LnR5cGUgPT09IFwic3ltYm9sXCIgJiYgdG9rZW4udmFsdWUgPT09IHZhbHVlXG4gIH1cblxuICBwcml2YXRlIGV4cGVjdFRva2VuPEsgZXh0ZW5kcyBUb2tlbltcInR5cGVcIl0+KHR5cGU6IEspOiBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+IHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICghdG9rZW4gfHwgdG9rZW4udHlwZSAhPT0gdHlwZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke3R5cGV9LCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuIGFzIEV4dHJhY3Q8VG9rZW4sIHt0eXBlOiBLfT5cbiAgfVxuXG4gIHByaXZhdGUgbWF0Y2hUb2tlbjxLIGV4dGVuZHMgVG9rZW5bXCJ0eXBlXCJdPih0eXBlOiBLKTogRXh0cmFjdDxUb2tlbiwge3R5cGU6IEt9PiB8IHVuZGVmaW5lZCB7XG4gICAgbGV0IHRva2VuID0gdGhpcy5wZWVrKClcbiAgICBpZiAoIXRva2VuIHx8IHRva2VuLnR5cGUgIT09IHR5cGUpIHJldHVybiB1bmRlZmluZWRcbiAgICB0aGlzLmkrK1xuICAgIHJldHVybiB0b2tlbiBhcyBFeHRyYWN0PFRva2VuLCB7dHlwZTogS30+XG4gIH1cblxuICBwcml2YXRlIGV4cGVjdEtleXdvcmQodmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCIpIHtcbiAgICBsZXQgdG9rZW4gPSB0aGlzLnBlZWsoKVxuICAgIGlmICh0b2tlbj8udHlwZSAhPT0gXCJrZXl3b3JkXCIgfHwgdG9rZW4udmFsdWUgIT09IHZhbHVlKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGtleXdvcmQgJHt2YWx1ZX0sIGdvdCAke3RoaXMuZGVzY3JpYmUodG9rZW4pfWApXG4gICAgdGhpcy5pKytcbiAgICByZXR1cm4gdG9rZW5cbiAgfVxuXG4gIHByaXZhdGUgZXhwZWN0U3ltYm9sKHZhbHVlOiBcIihcIiB8IFwiKVwiIHwgXCJ7XCIgfCBcIn1cIiB8IFwiLFwiIHwgXCI9XCIgfCBcIjpcIikge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuPy50eXBlICE9PSBcInN5bWJvbFwiIHx8IHRva2VuLnZhbHVlICE9PSB2YWx1ZSkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAnJHt2YWx1ZX0nLCBnb3QgJHt0aGlzLmRlc2NyaWJlKHRva2VuKX1gKVxuICAgIHRoaXMuaSsrXG4gICAgcmV0dXJuIHRva2VuXG4gIH1cblxuICBwcml2YXRlIGRlc2NyaWJlKHRva2VuOiBUb2tlbiB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG4gICAgaWYgKCF0b2tlbikgcmV0dXJuIFwiZW5kIG9mIGlucHV0XCJcbiAgICBpZiAoXCJ2YWx1ZVwiIGluIHRva2VuKSByZXR1cm4gYCR7dG9rZW4udHlwZX0oJHtTdHJpbmcodG9rZW4udmFsdWUpfSlgXG4gICAgaWYgKHRva2VuLnR5cGUgPT09IFwiZXJyb3JcIikgcmV0dXJuIGBlcnJvcigke3Rva2VuLm1lc3NhZ2V9KWBcbiAgICByZXR1cm4gdG9rZW4udHlwZVxuICB9XG5cbiAgcHJpdmF0ZSBlcnJvck5vZGUobWVzc2FnZTogc3RyaW5nLCBzcGFuPzogU3BhbiwgY29udGVudD86IHN0cmluZyk6IEVycm9yTm9kZSB7XG4gICAgbGV0IGZpbmFsU3BhbiA9IHNwYW4gPz8gdGhpcy5wb2ludFNwYW4oKVxuICAgIHJldHVybiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlLCBjb250ZW50OiBjb250ZW50ID8/IHRoaXMuc291cmNlLnNsaWNlKGZpbmFsU3Bhbi5zdGFydC5vZmZzZXQsIGZpbmFsU3Bhbi5lbmQub2Zmc2V0KX0sIGZpbmFsU3BhbilcbiAgfVxuXG4gIHByaXZhdGUgZXJyb3JIZXJlKG1lc3NhZ2U6IHN0cmluZywgc3RhcnQ/OiBQb3MpOkVycm9yTm9kZSB7XG4gICAgbGV0IHNwYW4gPSB0aGlzLnBlZWsoKT8uc3BhbiA/PyB7c3RhcnQ6IHRoaXMuZW9mLCBlbmQ6IHRoaXMuZW9mfVxuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShtZXNzYWdlLCB7c3RhcnQ6IHN0YXJ0ID8/IHNwYW4uc3RhcnQsIGVuZDogc3Bhbi5lbmR9KVxuICB9XG5cbiAgcHJpdmF0ZSB3cmFwRXJyb3IobWVzc2FnZTogc3RyaW5nLCBub2RlOiBBU1QpOiBBU1Qge1xuICAgIHJldHVybiB0aGlzLmVycm9yTm9kZShtZXNzYWdlLCBub2RlLnNwYW4sIHRoaXMuc291cmNlLnNsaWNlKG5vZGUuc3Bhbi5zdGFydC5vZmZzZXQsIG5vZGUuc3Bhbi5lbmQub2Zmc2V0KSlcbiAgfVxuXG4gIHByaXZhdGUgcG9pbnRTcGFuKCk6IFNwYW4ge1xuICAgIGxldCB0b2tlbiA9IHRoaXMucGVlaygpXG4gICAgaWYgKHRva2VuKSByZXR1cm4gdG9rZW4uc3BhblxuICAgIHJldHVybiB7c3RhcnQ6IHRoaXMuZW9mLCBlbmQ6IHRoaXMuZW9mfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBidWlsZEFzdE1hcCA9IChhc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdKTogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPT4ge1xuICBsZXQgbWF4RW5kID0gY29tbWVudHMucmVkdWNlKChtLCBjKSA9PiBjLnNwYW4uZW5kLm9mZnNldCA+IG0gPyBjLnNwYW4uZW5kLm9mZnNldCA6IG0sIGFzdC5zcGFuLmVuZC5vZmZzZXQpXG4gIGxldCByZXM6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gQXJyYXkuZnJvbSh7bGVuZ3RoOiBtYXhFbmR9LCAoKT0+dW5kZWZpbmVkKVxuICBjb25zdCB3YWxrID0gKG5vZGU6IEFTVCkgPT4ge1xuICAgIGZvciAobGV0IGkgPSBub2RlLnNwYW4uc3RhcnQub2Zmc2V0OyBpIDwgbm9kZS5zcGFuLmVuZC5vZmZzZXQ7IGkrKykgcmVzW2ldID0gbm9kZVxuICAgIGNoaWxkcmVuKG5vZGUpLmZvckVhY2god2FsaylcbiAgfVxuICB3YWxrKGFzdClcbiAgY29tbWVudHMuZm9yRWFjaChjb21tZW50ID0+IHtcbiAgICBmb3IgKGxldCBpID0gY29tbWVudC5zcGFuLnN0YXJ0Lm9mZnNldDsgaSA8IGNvbW1lbnQuc3Bhbi5lbmQub2Zmc2V0OyBpKyspIHJlc1tpXSA9IGNvbW1lbnRcbiAgfSlcbiAgcmV0dXJuIHJlc1xufVxuXG5leHBvcnQgY29uc3QgcGFyc2UgPSAoY29kZTpzdHJpbmcpOiBQYXJzZVJlc3VsdCA9PiB7XG4gIGxldCB7dG9rZW5zLCBjb21tZW50cywgZW9mfSA9IHRva2VuaXplKGNvZGUpXG4gIGxldCBhc3QgPSBuZXcgUGFyc2VyKHRva2VucywgY29kZSwgZW9mKS5wYXJzZSgpXG4gIHJldHVybiB7YXN0LCBjb21tZW50cywgYXN0bWFwOiBidWlsZEFzdE1hcChhc3QsIGNvbW1lbnRzKX1cbn1cblxuZXhwb3J0IGNvbnN0IHBhcnNlQVNUID0gKGNvZGU6c3RyaW5nKTogQVNUID0+IHBhcnNlKGNvZGUpLmFzdFxuXG5leHBvcnQgY29uc3QgY2hpbGRyZW4gPSAobm9kZTogQVNUKTogQVNUW10gPT4ge1xuICBpZiAobm9kZS4kID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBbLi4ubm9kZS5jb250ZW50LnZhcnMsIG5vZGUuY29udGVudC5ib2R5XVxuICBpZiAobm9kZS4kID09PSBcImFwcFwiKSByZXR1cm4gW25vZGUuY29udGVudC5mbiwgLi4ubm9kZS5jb250ZW50LmFyZ3NdXG4gIGlmIChub2RlLiQgPT09IFwibGV0XCIpIHJldHVybiBbbm9kZS5jb250ZW50LnZhciwgbm9kZS5jb250ZW50LnZhbHVlLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJyZWNvcmRcIikgcmV0dXJuIG5vZGUuY29udGVudC5mbGF0TWFwKChba2V5LCB2YWx1ZV0pID0+IFtrZXksIHZhbHVlXSlcbiAgcmV0dXJuIFtdXG59XG5cbmNvbnN0IHN0cmlwU3BhbnMgPSAoYXN0OiBBU1QpOiB1bmtub3duID0+IHtcbiAgaWYgKGFzdC4kID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHt2YXJzOiBhc3QuY29udGVudC52YXJzLm1hcChzdHJpcFNwYW5zKSwgYm9keTogc3RyaXBTcGFucyhhc3QuY29udGVudC5ib2R5KX19XG4gIGlmIChhc3QuJCA9PT0gXCJhcHBcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDoge2ZuOiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmZuKSwgYXJnczogYXN0LmNvbnRlbnQuYXJncy5tYXAoc3RyaXBTcGFucyl9fVxuICBpZiAoYXN0LiQgPT09IFwibGV0XCIpIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IHt2YXI6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQudmFyKSwgdmFsdWU6IHN0cmlwU3BhbnMoYXN0LmNvbnRlbnQudmFsdWUpLCBib2R5OiBzdHJpcFNwYW5zKGFzdC5jb250ZW50LmJvZHkpfX1cbiAgaWYgKGFzdC4kID09PSBcInJlY29yZFwiKSByZXR1cm4geyQ6IGFzdC4kLCBjb250ZW50OiBhc3QuY29udGVudC5tYXAoKFtuYW1lLCB2YWx1ZV0pID0+IFtzdHJpcFNwYW5zKG5hbWUpLCBzdHJpcFNwYW5zKHZhbHVlKV0pfVxuICBpZiAoYXN0LiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIHskOiBhc3QuJCwgY29udGVudDogYXN0LmNvbnRlbnR9XG4gIHJldHVybiB7JDogYXN0LiQsIGNvbnRlbnQ6IGFzdC5jb250ZW50fVxufVxuXG5cbmxldCBzdHJpbmdpZnkgPSAoeDogdW5rbm93bikgPT4gSlNPTi5zdHJpbmdpZnkoeCwgbnVsbCwgMilcblxuY29uc3QgdGVzdF9wYXJzZSA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBBU1QpID0+IHtcbiAgbGV0IGFzdCA9IHBhcnNlQVNUKGNvZGUpXG5cbiAgaWYgKEpTT04uc3RyaW5naWZ5KHN0cmlwU3BhbnMoYXN0KSkgIT09IEpTT04uc3RyaW5naWZ5KHN0cmlwU3BhbnMoZXhwZWN0ZWQpKSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJUZXN0IGZhaWxlZCBmb3IgY29kZTpcIiwgY29kZSlcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIHN0cmluZ2lmeShzdHJpcFNwYW5zKGV4cGVjdGVkKSkpXG4gICAgY29uc29sZS5lcnJvcihcIkdvdDpcIiwgc3RyaW5naWZ5KHN0cmlwU3BhbnMoYXN0KSkpXG4gICAgdGhyb3cgbmV3IEVycm9yKGBUZXN0IGZhaWxlZCBmb3IgY29kZTogJHtjb2RlfWApXG4gIH1cbn1cblxuY29uc3QgdGVzdF9zcGFuID0gKGNvZGU6IHN0cmluZywgZXhwZWN0ZWQ6IFNwYW4pID0+IHtcbiAgbGV0IGFzdCA9IHBhcnNlQVNUKGNvZGUpXG4gIGlmIChKU09OLnN0cmluZ2lmeShhc3Quc3BhbikgIT09IEpTT04uc3RyaW5naWZ5KGV4cGVjdGVkKSkge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJTcGFuIHRlc3QgZmFpbGVkIGZvciBjb2RlOlwiLCBjb2RlKVxuICAgIGNvbnNvbGUuZXJyb3IoXCJFeHBlY3RlZDpcIiwgZXhwZWN0ZWQpXG4gICAgY29uc29sZS5lcnJvcihcIkdvdDpcIiwgYXN0LnNwYW4pXG4gICAgdGhyb3cgbmV3IEVycm9yKGBTcGFuIHRlc3QgZmFpbGVkIGZvciBjb2RlOiAke2NvZGV9YClcbiAgfVxufVxuXG5leHBvcnQgbGV0IG1rbnVtID0gKG46IG51bWJlcikgPT4gbWtBc3QoXCJudW1iZXJcIiwgbilcbmV4cG9ydCBsZXQgbWtzdHIgPSAoczogc3RyaW5nKSA9PiBta0FzdChcInN0cmluZ1wiLCBzKVxuZXhwb3J0IGxldCBta3ZhciA9IChuYW1lOiBzdHJpbmcpID0+IG1rQXN0KFwidmFyXCIsIHtuYW1lfSlcbmV4cG9ydCBsZXQgbWthcHAgPSAoZm46IEFTVCwgYXJnczogQVNUW10pID0+IG1rQXN0KFwiYXBwXCIsIHtmbiwgYXJnc30pXG5leHBvcnQgbGV0IG1rbGV0ID0gKHY6IHN0cmluZyB8IFZhciwgdmFsdWU6IEFTVCwgYm9keTogQVNUKSA9PiBta0FzdChcImxldFwiLCB7dmFyOiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IG1rdmFyKHYpIDogdiwgdmFsdWUsIGJvZHl9KVxuZXhwb3J0IGxldCBta2Z1biA9ICh2YXJzOiAoc3RyaW5nIHwgVmFyKVtdLCBib2R5OiBBU1QpID0+IG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnM6IHZhcnMubWFwKHYgPT4gdHlwZW9mIHYgPT09IFwic3RyaW5nXCIgPyBta3Zhcih2KSA6IHYpLCBib2R5fSkgYXMgRnVuY1xuZXhwb3J0IGxldCBhbm5vdCA9ICh0eXBlOiBBU1QsIHZhbHVlOiBBU1QpID0+IG1rQXN0KFwiYW5ub3RcIiwge3R5cGUsIHZhbHVlfSlcbmV4cG9ydCBsZXQgbWtyZWNvcmQgPSAoZmllbGRzOiB7W2tleSA6IHN0cmluZ10gOiBBU1R9KSA9PiBta0FzdChcInJlY29yZFwiLCBPYmplY3QuZW50cmllcyhmaWVsZHMpLm1hcCgoW2ssdl0pPT4gW21rdmFyKGspLCB2XSkpXG5cbk9iamVjdC5lbnRyaWVzKHtcbiAgXCJ4XCI6IG1rdmFyKFwieFwiKSxcbiAgXCIyMlwiOiBta251bSgyMiksXG4gICdcImhlbGxvXCInOiBta3N0cihcImhlbGxvXCIpLFxuICBcIihmIHgpXCI6IG1rYXBwKG1rdmFyKFwiZlwiKSwgW21rdmFyKFwieFwiKV0pLFxuICBcIihmIHggeSlcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpLCBta3ZhcihcInlcIildKSxcbiAgXCJsZXQgeCA9IDIyIGluIHhcIjogbWtsZXQoXCJ4XCIsIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJ7YTogMjIsIGI6IHh9XCI6IG1rcmVjb3JkKHthOiBta251bSgyMiksIGI6IG1rdmFyKFwieFwiKX0pLFxuICBcImZuIHggPT4geFwiOiBta2Z1bihbXCJ4XCJdLCBta3ZhcihcInhcIikpLFxuICBcImZuIHggeSA9PiB4XCI6IG1rZnVuKFtcInhcIiwgXCJ5XCJdLCBta3ZhcihcInhcIikpLFxuICBcImxldCAobnVtYmVyIHgpID0gMjIgaW4geFwiOiBta2xldChPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiAobnVtYmVyIHgpIChzdHJpbmcgeSkgPT4geFwiOiBta2Z1bihbXG4gICAgT2JqZWN0LmFzc2lnbihta3ZhcihcInhcIiksIHt0eXBlOiBta3ZhcihcIm51bWJlclwiKX0pLFxuICAgIE9iamVjdC5hc3NpZ24obWt2YXIoXCJ5XCIpLCB7dHlwZTogbWt2YXIoXCJzdHJpbmdcIil9KSxcbiAgXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJ7ZToyMn1cIiA6IG1rcmVjb3JkKHtlOiBta251bSgyMil9KSxcbiAgXCJ7ZX1cIjogbWtyZWNvcmQoe2U6IG1rdmFyKFwiZVwiKX0pLFxuICBcIi8vY29tbWVudFxcbjIyXCI6IHBhcnNlQVNUKFwiMjJcIiksXG59KS5mb3JFYWNoKChbY29kZSwgZXhwZWN0ZWRdKSA9PiB0ZXN0X3BhcnNlKGNvZGUsIGV4cGVjdGVkIGFzIEFTVCkpXG5cbk9iamVjdC5lbnRyaWVzKHtcbiAgXCIoXCI6IG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiLCBjb250ZW50OiBcIihcIn0pLFxuICBcImxldCB4IDIyIGluIHhcIjogbWtBc3QoXCJsZXRcIiwge1xuICAgIHZhcjogbWt2YXIoXCJ4XCIpLFxuICAgIHZhbHVlOiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkICc9JyBhZnRlciBsZXQgYmluZGluZyBuYW1lXCIsIGNvbnRlbnQ6IFwiMjJcIn0pLFxuICAgIGJvZHk6IG1rdmFyKFwieFwiKSxcbiAgfSksXG4gIFwie2U6fVwiOiBta3JlY29yZCh7ZTogbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCByZWNvcmQgZmllbGQgdmFsdWUgYWZ0ZXIgJzonXCIsIGNvbnRlbnQ6IFwifVwifSl9KSxcblxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG50ZXN0X3NwYW4oXCJsZXQgeCA9IDIyXFxuaW4geFwiLCB7XG4gIHN0YXJ0OiB7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9LFxuICBlbmQ6IHtvZmZzZXQ6IDE1LCBsaW5lOiAyLCBjb2w6IDV9LFxufSlcbiIsCiAgICAiaW1wb3J0IHsgQVNULCBWYXIgfSBmcm9tIFwiLi9wYXJzZXJcIlxuaW1wb3J0IHtjaGlsZHJlbn0gZnJvbSBcIi4vcGFyc2VyXCJcblxuXG5leHBvcnQgY29uc3QgZ2V0ZGVmID0gKHJvb3Q6IEFTVCwgdmFyaTogVmFyKTogQVNUIHwgdW5kZWZpbmVkID0+IHtcbiAgaWYgKHJvb3Quc3Bhbi5zdGFydC5vZmZzZXQgPiB2YXJpLnNwYW4uc3RhcnQub2Zmc2V0IHx8IHJvb3Quc3Bhbi5lbmQub2Zmc2V0IDwgdmFyaS5zcGFuLmVuZC5vZmZzZXQpIHJldHVybiB1bmRlZmluZWRcbiAgZm9yIChsZXQgY2hpbGQgb2YgY2hpbGRyZW4ocm9vdCkpe1xuICAgIGxldCByZXMgPSBnZXRkZWYoY2hpbGQsIHZhcmkpXG4gICAgaWYgKHJlcykgcmV0dXJuIHJlc1xuICB9XG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJsZXRcIiAmJiByb290LmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgcmV0dXJuIHJvb3QuY29udGVudC52YXJcblxuICBpZiAocm9vdC4kID09PSBcImZ1bmN0aW9uXCIpXG4gICAgZm9yIChsZXQgdiBvZiByb290LmNvbnRlbnQudmFycylcbiAgICAgIGlmICh2LmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgICAgIHJldHVybiB2XG59XG4iLAogICAgIlxuaW1wb3J0IHsgYm9keSwgY29sb3IsIGRpdiwgdGFibGUsIHRkLCB0ciB9IGZyb20gXCIuL2h0bWxcIlxuaW1wb3J0IHtta251bSwgVGFnLCB0eXBlIEFTVH0gZnJvbSBcIi4vcGFyc2VyXCJcbmltcG9ydCB7cGFyc2UsIHByZXR0eUFTVCwgbWtBc3QsIG1rdmFyLCBta2FwcCwgbWtmdW4sIG1rbGV0LCBWYXJ9IGZyb20gXCIuL3BhcnNlclwiXG5cbmxldCBhbm5vdCA9IChhc3Q6IEFTVCwgdHlwZTogQVNUKTogQVNUICYge3R5cGU6IEFTVH0gPT4ge1xuICBpZiAoYXN0LnR5cGUgJiYgcHJldHR5QVNUKGFzdC50eXBlKSAhPSBwcmV0dHlBU1QodHlwZSkpIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtwcmV0dHlBU1QodHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QoYXN0LnR5cGUpfWApXG4gIGFzdC50eXBlID0gdHlwZVxuICByZXR1cm4gYXN0IGFzIEFTVCAmIHt0eXBlOiBBU1R9XG5cbn1cblxuZXhwb3J0IGxldCBOVU1CRVIgOiBBU1QgPSBta3ZhcihcIm51bWJlclwiKVxuZXhwb3J0IGxldCBTVFJJTkcgOiBBU1QgPSBta3ZhcihcInN0cmluZ1wiKVxuZXhwb3J0IGxldCBUWVBFIDogQVNUID0gbWt2YXIoXCJ0eXBlXCIpXG5leHBvcnQgbGV0IFRZUEVPRjogQVNUID0gbWt2YXIoXCJ0eXBlb2ZcIilcblxuTlVNQkVSLnR5cGUgPSBUWVBFXG5TVFJJTkcudHlwZSA9IFRZUEVcblRZUEUudHlwZSA9IFRZUEVcblRZUEVPRi50eXBlID0gcGFyc2UoXCJmbiBmID0+IGZuIHggPT4gdHlwZVwiKS5hc3QhXG5cblxuXG5cbmV4cG9ydCBsZXQgQU5ZIDogQVNUID0gbWt2YXIoXCJhbnlcIilcblxuXG5sZXQgcHJpbWl0aXZlVHlwZSA9IChuYW1lOiBzdHJpbmcpID0+ICh7XG4gIHR5cGU6IFRZUEUsXG4gIGltcGw6ICh4OiBBU1QpID0+IHtcbiAgICBpZiAoeC4kID09IFwidmFyXCIpe1xuICAgICAgaWYgKHgudHlwZSl7XG4gICAgICAgIGlmICh4LnR5cGUuJCA9PSBcInZhclwiICYmIHgudHlwZS5jb250ZW50Lm5hbWUgPT0gbmFtZSkgcmV0dXJuIHhcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yOiBleHBlY3RlZCAke25hbWV9LCBnb3QgJHtwcmV0dHlBU1QoeC50eXBlKX1gKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGFubm90KHgsIG1rdmFyKG5hbWUpKVxuICAgIH1cbiAgICBlbHNlIGlmICh4LiQgPT0gbmFtZSkgcmV0dXJuIGFubm90KHgsIG1rdmFyKG5hbWUpKVxuICAgIHRocm93IG5ldyBFcnJvcihgVHlwZSBlcnJvcjogZXhwZWN0ZWQgJHtuYW1lfSwgZ290ICR7cHJldHR5QVNUKHgpfWApXG4gIH1cbn0pXG5cbmxldCBidWlsdGluczogUmVjb3JkPHN0cmluZywgeyB0eXBlOiBBU1QsIGltcGw6ICguLi5hcmdzOkFTVFtdKSA9PiBBU1QgfT4gPSB7XG4gIG51bWJlcjogcHJpbWl0aXZlVHlwZShcIm51bWJlclwiKSxcbiAgc3RyaW5nOiBwcmltaXRpdmVUeXBlKFwic3RyaW5nXCIpLFxuICBcImVxXCI6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCB5ID0+IChudW1iZXIgKGYgeCB5KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiBta251bShcbiAgICAgICh4LiQgPT0gXCJudW1iZXJcIiAmJiB5LiQgPT0gXCJudW1iZXJcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fFxuICAgICAgKHguJCA9PSBcInN0cmluZ1wiICYmIHkuJCA9PSBcInN0cmluZ1wiICYmIHguY29udGVudCA9PSB5LmNvbnRlbnQpIHx8ICh4ID09IHkpXG4gICAgICA/IDEgOiAwKVxuICB9LFxuICBcImFkZFwiOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmPT4gZm4geCB5ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSAobnVtYmVyIHkpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiB7XG4gICAgICBpZiAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIpIHJldHVybiBta251bSh4LmNvbnRlbnQgKyB5LmNvbnRlbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gYWRkOiBleHBlY3RlZCBudW1iZXJzLCBnb3QgJHtwcmV0dHlBU1QoeCl9IGFuZCAke3ByZXR0eUFTVCh5KX1gKVxuICAgIH1cbiAgfSxcbiAgXCJpZmVsc2VcIiA6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4gVCBjb25kIHRoZW4gZWxzZSA9PiAoVCAoZiAobnVtYmVyIGNvbmQpIChUIHRoZW4pIChUIGVsc2UpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoY29uZCwgdGhlbiwgZWxzKSA9PiB7XG4gICAgICBsZXQgdmFsID0gY29uZC4kID09IFwibnVtYmVyXCIgPyBjb25kLmNvbnRlbnQgOiBjb25kLiQgPT0gXCJzdHJpbmdcIiA/IGNvbmQuY29udGVudC5sZW5ndGggOiAxXG4gICAgICByZXR1cm4gdmFsID8gdGhlbiA6IGVsc1xuICAgIH1cbiAgfSxcbiAgXCJ0eXBlb2ZcIjoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiB4ID0+ICh0eXBlIChmIHgpKVwiKS5hc3QhLFxuICAgIGltcGw6ICh4KSA9PiB7XG4gICAgICBpZiAoIXgudHlwZSkgcmV0dXJuIG1rYXBwKFRZUEVPRiwgW3hdKVxuICAgICAgcmV0dXJuIHgudHlwZVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IHR5cGUgRW52ID0ge2JpbmRlcjogVmFyLCB2YWx1ZTogQVNULCBuZXh0OiBFbnZ9IHwgbnVsbFxuXG5sZXQgcHJldHR5RW52ID0gKGVudjogRW52KTogc3RyaW5nID0+IHtcbiAgaWYgKCFlbnYpIHJldHVybiBcInt9XCJcbiAgcmV0dXJuIGB7JHtlbnYuYmluZGVyLmNvbnRlbnQubmFtZX0gOiAke3ByZXR0eUFTVChlbnYudmFsdWUudHlwZSA/PyBBTlkpfSA9ICR7cHJldHR5QVNUKGVudi52YWx1ZSl9fSAtPiBgICsgcHJldHR5RW52KGVudi5uZXh0KVxufVxuXG5leHBvcnQgY29uc3QgcnVuID0gKGFzdDogQVNUKTogQVNUID0+IHtcblxuICBsZXQgbG9va3VwID0gKG5hbWU6IHN0cmluZywgZW52OiBFbnYpOiBFbnYgPT4ge1xuICAgIGlmICghZW52KSByZXR1cm4gbnVsbFxuICAgIGlmIChlbnYuYmluZGVyLmNvbnRlbnQubmFtZSA9PT0gbmFtZSkgcmV0dXJuIGVudlxuICAgIHJldHVybiBsb29rdXAobmFtZSwgZW52Lm5leHQpXG4gIH1cblxuICBsZXQgZnJlZW5hbWUgPSAoZW52OkVudik6c3RyaW5nPT57XG4gICAgbGV0IG4gPSAwXG4gICAgd2hpbGUobG9va3VwKGB4JHtufWAsIGVudikpIG4rK1xuICAgIHJldHVybiBgeCR7bn1gXG4gIH1cbiAgbGV0IGJpbmQgPSAoZW52OiBFbnYsIGJpbmRlcjogVmFyLCB2YWx1ZTogQVNUKTogRW52ID0+ICh7YmluZGVyLCB2YWx1ZSwgbmV4dDogZW52fSlcbiAgbGV0IGJpbmRWYWx1ZSA9IChlbnY6IEVudiwgYmluZGVyOiBWYXIsIHZhbHVlOiBBU1QsIGluZmVyID0gZmFsc2UpOiBFbnYgPT4ge1xuXG4gICAgaWYgKGJpbmRlci50eXBlKVxuICAgICAgaWYgKHZhbHVlLnR5cGUgJiYgcHJldHR5QVNUKGJpbmRlci50eXBlKSAhPSBwcmV0dHlBU1QodmFsdWUudHlwZSEpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gbGV0OiBleHBlY3RlZCAke3ByZXR0eUFTVChiaW5kZXIudHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QodmFsdWUudHlwZSEpfWApXG4gICAgZWxzZSBiaW5kZXIudHlwZSA9IHZhbHVlLnR5cGVcbiAgICByZXR1cm4gYmluZChlbnYsIGJpbmRlciwgdmFsdWUpXG5cbiAgfVxuXG4gIGNvbnN0IGdvID0gKGFzdDogQVNULCBlbnY6IEVudik6IEFTVCA9PiB7XG4gICAgc3dpdGNoKGFzdC4kKXtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjoge1xuICAgICAgICBhc3QudHlwZSA9IE5VTUJFUlxuICAgICAgICByZXR1cm4gYXN0IGFzIEFTVCAmIHt0eXBlOiBBU1R9XG4gICAgICB9XG4gICAgICBjYXNlIFwic3RyaW5nXCI6e1xuICAgICAgICBhc3QudHlwZSA9IFNUUklOR1xuICAgICAgICByZXR1cm4gYXN0IGFzIEFTVCAmIHt0eXBlOiBBU1R9XG4gICAgICB9XG5cbiAgICAgIGNhc2UgXCJ2YXJcIjoge1xuICAgICAgICBpZiAoYnVpbHRpbnNbYXN0LmNvbnRlbnQubmFtZV0pIHtcbiAgICAgICAgICBsZXQgZGVmID0gYnVpbHRpbnNbYXN0LmNvbnRlbnQubmFtZV1cbiAgICAgICAgICByZXR1cm4gYW5ub3QoYXN0LCBkZWYudHlwZSlcbiAgICAgICAgfVxuICAgICAgICBsZXQgaGl0ID0gbG9va3VwKGFzdC5jb250ZW50Lm5hbWUsIGVudilcbiAgICAgICAgaWYgKGhpdCkge1xuICAgICAgICAgIGlmIChoaXQuYmluZGVyLnR5cGUpIGFubm90KGFzdCwgaGl0LmJpbmRlci50eXBlKVxuICAgICAgICAgIHJldHVybiBoaXQudmFsdWVcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXN0XG4gICAgICB9XG4gICAgICBjYXNlIFwibGV0XCI6IHtcblxuICAgICAgICBsZXQgdmFsdWUgPSBnbyhhc3QuY29udGVudC52YWx1ZSwgZW52KVxuXG4gICAgICAgIFxuXG4gICAgICAgIGVudiA9IGJpbmRWYWx1ZShlbnYsIGFzdC5jb250ZW50LnZhciwgdmFsdWUsIHRydWUpXG4gICAgICAgIGxldCByZXMgPSBnbyhhc3QuY29udGVudC5ib2R5LCBlbnYpXG4gICAgICAgIGlmIChyZXMudHlwZSkgYW5ub3QoYXN0LCByZXMudHlwZSlcbiAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgfVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6e1xuICAgICAgICBpZiAoYXN0LmNvbnRlbnQuZW52ID09IHVuZGVmaW5lZCkgYXN0LmNvbnRlbnQuZW52ID0gZW52XG5cbiAgICAgICAgbGV0IGJvZHkgPSBnbyhcbiAgICAgICAgICBhc3QuY29udGVudC5ib2R5LFxuICAgICAgICAgIGFzdC5jb250ZW50LnZhcnMucmVkdWNlKChlbnYsIHYpID0+IGJpbmQoZW52LCB2LCB2KSwgYXN0LmNvbnRlbnQuZW52IGFzIEVudilcbiAgICAgICAgKVxuXG4gICAgICAgIGxldCBmdmFyID0gbWt2YXIoZnJlZW5hbWUoZW52KSlcbiAgICAgICAgbGV0IGZ0eXBlOiBBU1QgPSBta2Z1biggW2Z2YXJdLCBta2Z1bihhc3QuY29udGVudC52YXJzLCBhc3QuY29udGVudC5ib2R5LnR5cGUgPz8gbWthcHAoVFlQRU9GLCBbYm9keV0pKSlcbiAgICAgICAgYW5ub3QoYXN0LCBmdHlwZSlcbiAgICAgICAgbGV0IHJlcyA9IG1rZnVuKGFzdC5jb250ZW50LnZhcnMsIGJvZHkpXG4gICAgICAgIHJlcy5jb250ZW50LmVudiA9IGFzdC5jb250ZW50LmVudlxuICAgICAgICByZXR1cm4gYW5ub3QocmVzLCBmdHlwZSlcbiAgICAgIH1cblxuICAgICAgY2FzZSBcImFwcFwiOiB7XG4gICAgICAgIGxldCBmbiA9IGdvKGFzdC5jb250ZW50LmZuLCBlbnYpXG4gICAgICAgIGxldCBhcmdzID0gYXN0LmNvbnRlbnQuYXJncy5tYXAoYXJnID0+IGdvKGFyZywgZW52KSlcblxuICAgICAgICBpZiAoZm4uJCA9PSBcInZhclwiICYmIGJ1aWx0aW5zW2ZuLmNvbnRlbnQubmFtZV0pIHtcbiAgICAgICAgICBsZXQgcmVzID0gYnVpbHRpbnNbZm4uY29udGVudC5uYW1lXS5pbXBsKC4uLmFyZ3MpXG4gICAgICAgICAgaWYgKHJlcy50eXBlKSBhbm5vdChhc3QsIHJlcy50eXBlKVxuICAgICAgICAgIHJldHVybiByZXNcbiAgICAgICAgfVxuICAgICAgICBpZiAoZm4uJCA9PSBcImZ1bmN0aW9uXCIpe1xuXG4gICAgICAgICAgaWYgKGZuLmNvbnRlbnQudmFycy5sZW5ndGggIT09IGFyZ3MubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICR7Zm4uY29udGVudC52YXJzLmxlbmd0aH0gYXJndW1lbnRzLCBnb3QgJHthcmdzLmxlbmd0aH1gKVxuICAgICAgICAgIGxldCBjYWxsZW52ID0gZm4uY29udGVudC5lbnYgYXMgRW52O1xuICAgICAgICAgIGNhbGxlbnYgPSBmbi5jb250ZW50LnZhcnMucmVkdWNlKChlbnYsIHYsIGkpID0+IGJpbmRWYWx1ZShlbnYsIHYsIGFyZ3NbaV0sIHRydWUpLCBjYWxsZW52KVxuICAgICAgICAgIGxldCByZXMgPSBnbyhmbi5jb250ZW50LmJvZHksIGNhbGxlbnYpXG4gICAgICAgICAgaWYgKHJlcy50eXBlKSBhbm5vdChhc3QsIHJlcy50eXBlKVxuXG4gICAgICAgICAgcmV0dXJuIHJlc1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGFwcGx5IG5vbi1mdW5jdGlvbiAke3ByZXR0eUFTVChmbil9YClcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHJldHVybiBhc3RcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGdvKGFzdCwgbnVsbClcbn1cblxuXG5sZXQgc2FtcGxlcyA9IFtcbiAgXCIyMiB8IG51bWJlciB8IDIyXCIsXG4gICdsZXQgeCA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4gICdsZXQgKG51bWJlciB4KSA9IDIyIGluIHggfCBudW1iZXIgfCAyMicsXG4gICdmbiB4ID0+IHggfCBmbiB4MCA9PiBmbiB4ID0+ICh0eXBlb2YgeCknLFxuICAnKG51bWJlciAyMikgfCBudW1iZXIgfCAyMicsXG4gICdmbiAobnVtYmVyIHgpID0+IHggfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlciB8IGZuIChudW1iZXIgeCkgPT4geCcsXG4gICdmbiB4ID0+IChudW1iZXIgeCkgfCBmbiB4MCA9PiBmbiAobnVtYmVyIHgpID0+IG51bWJlcicsXG4gICcoZm4geCA9PiB4IDIyKSB8IG51bWJlcicsXG4gICcoZm4gKG51bWJlciB4KSA9PiB4IDIyKSB8IG51bWJlcicsXG4gICcoZm4gKHN0cmluZyB4KSA9PiB4IDIyKSB8IGVycm9yJyxcbiAgJ2xldCBpZCA9IGZuIHggPT4geCBpbiBmbiB5ID0+IChpZCB5KSB8IGZuIHgwID0+IGZuIHkgPT4gKHR5cGVvZiB5KSB8IGZuIHkgPT4geScsXG4gICdmbiAobnVtYmVyIHgpID0+IChzdHJpbmcgeCkgfCBlcnJvcicsXG5dLm1hcChjb2RlID0+IGNvZGUuc3BsaXQoXCJ8XCIpLm1hcChzID0+IHMudHJpbSgpKSlcblxuXG5sZXQgcmVzdWx0cyA9IHRhYmxlKCkuc3R5bGUoe1xuICB3aWR0aDogXCIxMDAlXCIsXG4gIHdoaXRlU3BhY2U6IFwicHJlXCIsXG59KVxuXG5cblxuXG5mb3IgKGxldCBbY29kZSwgZXhwZWN0ZWRUeXBlLCBleHBlY3RlZFJlc3VsdF0gb2Ygc2FtcGxlcyl7XG5cbiAgbGV0IGFzdCA9IHBhcnNlKGNvZGUpXG4gIGxldCByZXMgOiBBU1QgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcblxuICB0cnl7XG4gICAgcmVzID0gcnVuKGFzdC5hc3QpXG4gIH1jYXRjaChlKXtcbiAgICBpZiAoZXhwZWN0ZWRUeXBlICE9IFwiZXJyb3JcIikgY29uc29sZS5lcnJvcihgRXJyb3IgcnVubmluZyBjb2RlOiAke2NvZGV9XFxuYCwgZSlcbiAgfVxuXG4gIGxldCB0eXBlU3RyID0gcmVzID8gcmVzLnR5cGUgPyBwcmV0dHlBU1QocmVzLnR5cGUpIDogXCJubyB0eXBlXCIgOiBcImVycm9yXCJcbiAgbGV0IHJlc1N0ciA9IHJlcyA/IHByZXR0eUFTVChyZXMpIDogXCJlcnJvclwiXG5cbiAgbGV0IGNoZWNrID0gKHR5cGVTdHIgPT0gKGV4cGVjdGVkVHlwZSA/PyB0eXBlU3RyKSAmJiByZXNTdHIgPT0gKGV4cGVjdGVkUmVzdWx0ID8/IHJlc1N0cikpXG5cblxuXG5cbiAgaWYgKCFjaGVjaykge1xuICAgIHJlc3VsdHMuYXBwZW5kKFxuICAgICAgdHIoXG4gICAgICAgIHRkKGNvZGUpLFxuICAgICAgICB0ZCh0eXBlU3RyKS5zdHlsZSh7Y29sb3I6IHR5cGVTdHIgPT0gKGV4cGVjdGVkVHlwZSA/PyB0eXBlU3RyKSA/IFwiZ3JlZW5cIiA6IFwicmVkXCIsIHBhZGRpbmc6IFwiMCA4cHhcIn0pLFxuICAgICAgICB0ZChyZXNTdHIpLnN0eWxlKHtjb2xvcjogcmVzU3RyID09IChleHBlY3RlZFJlc3VsdCA/PyByZXNTdHIpID8gXCJncmVlblwiIDogXCJyZWRcIn0pXG4gICAgICApXG4gICAgICAuc3R5bGUoe1xuICAgICAgICBib3JkZXJCb3R0b206IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICAgICAgfSlcbiAgICApXG4gICAgYm9keS5hcHBlbmQoZGl2KHJlc3VsdHMpXG4gICAgLnN0eWxlKHtcbiAgICAgIHBvc2l0aW9uOiBcImFic29sdXRlXCIsXG4gICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiK2NvbG9yLmNvbG9yLFxuICAgICAgcGFkZGluZzogXCIxNnB4XCIsXG4gICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgfSkpXG4gIH1cbn0gICAgXG5cblxuXG4iLAogICAgImltcG9ydCB7IGJvZHksIGh0bWwsIHNwYW4gLCBmcm9tSFRNTCwgaDIsIGRpdn0gZnJvbSBcIi4vaHRtbFwiO1xuaW1wb3J0IHsgZWRpdG9yIH0gZnJvbSBcIi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBwYXJzZSwgcHJldHR5QVNULCB0eXBlIEFTVCwgdHlwZSBTcGFuLCB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIjtcbmltcG9ydCB7IGdldGRlZiB9IGZyb20gXCIuL2xzcFwiXG5pbXBvcnQgeyBydW4sIEFOWSB9IGZyb20gXCIuL3J1bnRpbWVcIlxuaW1wb3J0IHsgY29sb3IgfSBmcm9tIFwiLi9odG1sXCI7XG5cblxuaWYgKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4uaW5jbHVkZXMoXCJsb2NhbGhvc3RcIikpKGFzeW5jICgpPT57XG4gIGxldCB2ZXJzaW9uID0gYXdhaXQgZmV0Y2goXCIvdmVyc2lvblwiKS50aGVuKHJlcyA9PiByZXMudGV4dCgpKVxuICAuY2F0Y2goZT0+XCIwXCIpXG4gIHdoaWxlICh0cnVlKXtcbiAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSlcbiAgICB0cnl7XG4gICAgICBpZiAoYXdhaXQgZmV0Y2goXCIvdmVyc2lvblwiKS50aGVuKHJlcyA9PiByZXMudGV4dCgpKS5jYXRjaChlPT5cIjBcIikhPSB2ZXJzaW9uKSB3aW5kb3cubG9jYXRpb24ucmVsb2FkKClcbiAgICB9Y2F0Y2goZSl7YnJlYWs7fVxuICB9XG59KSgpO1xuXG5cblxubGV0IG91dHZpZXcgPSBodG1sKCdwcmUnKSgpLnN0eWxlKHtcbiAgYm9yZGVyVG9wOiBcIjFweCBzb2xpZCBcIitjb2xvci5jb2xvcixcbiAgcGFkZGluZ1RvcDogXCIxNnB4XCIsXG59KVxuXG5sZXQgYXN0OiBBU1QgfCB1bmRlZmluZWRcbmxldCBjdXJyZW50QXN0TWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IFtdXG5cblxubGV0IGNvZGU6c3RyaW5nID0gJydcblxubGV0IEVkaXQgPSBlZGl0b3Iocz0+IHtcbiAgICB0cnl7XG4gICAgICBsZXQgcGFyc2VkID0gcGFyc2UocylcbiAgICAgIGFzdCA9IHBhcnNlZC5hc3RcbiAgICAgIGN1cnJlbnRBc3RNYXAgPSBwYXJzZWQuYXN0bWFwXG4gICAgICBjb2RlID0gc1xuICAgICAgbGV0IHJlcyA9IHJ1bihhc3QpXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gcHJldHR5QVNUKHJlcylcblxuICAgIH1jYXRjaChlKXtcbiAgICAgIGFzdCA9IHVuZGVmaW5lZFxuICAgICAgY3VycmVudEFzdE1hcCA9IFtdXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgfVxuICB9LFxuICAoKT0+IGN1cnJlbnRBc3RNYXAsXG4gIChyZXEpID0+IHtcbiAgICBsZXQgZGVmID0gcmVxLiQgPT0gXCJ2YXJcIiA/IGdldGRlZihhc3QhLCByZXEpIDogdW5kZWZpbmVkXG4gICAgaWYgKGRlZikgRWRpdC5zZXRDdXJzb3Ioe3JvdzogZGVmLnNwYW4uc3RhcnQubGluZS0xLCBjb2w6IGRlZi5zcGFuLnN0YXJ0LmNvbC0xfSlcbiAgfSxcbiAgKG5vZGUpID0+IHtcbiAgICBpZiAobm9kZS4kID09PSBcImNvbW1lbnRcIikgcmV0dXJuIHVuZGVmaW5lZFxuXG4gICAgcmV0dXJuIG5vZGUuJCArIFwiOiBcIiArIChub2RlLnR5cGUgPyBwcmV0dHlBU1Qobm9kZS50eXBlKSA6IChub2RlLiQgPT0gXCJ2YXJcIiA/IHByZXR0eUFTVChnZXRkZWYoYXN0ISwgbm9kZSk/LnR5cGUgPz8gQU5ZKSA6IFwiWFhcIikpXG4gIH1cbilcblxuYm9keS5zdHlsZSh7cGFkZGluZzogXCI0NHB4XCIsZm9udEZhbWlseTogXCJzYW5zLXNlcmlmXCIsfSlcblxuXG5sZXQgYnV0dG4gPSAodDpzdHJpbmcsIG9uQ2xpY2s6KCkgPT4gdm9pZCkgPT4gc3Bhbih0LCBvbkNsaWNrKS5zdHlsZSh7Y29sb3I6IFwiZ3JheVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkIGdyYXlcIiwgYm9yZGVyUmFkaXVzOiBcIjRweFwiLCBwYWRkaW5nOiBcIjJweCA0cHhcIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KVxuXG5sZXQgYWJvdXRfdGV4dCA9IGBcblxuLy8gVGhpcyBpcyBhIHRveSBjb2RlIGVkaXRvciBzdGlsbCBpbiBkZXZlbG9wbWVudC5cblxuLy8gdGhlIGdvYWwgaXMgdG8gYnVpbGQgYSBsYW5ndWFnZSB3aXRoOlxuXG4vLyBleHRyZW1lbHkgbWluaW1hbCBzeW50YXhcbi8vIGZpcnN0IGNsYXNzIHN1cHBvcnQgZm9yIHR5cGVzIGFzIHZhbHVlc1xuLy8gZmlyc3QgY2FzcyBMU1AgcHJvZ3JhbW5nIGluIGEgc3RyYWlnaHRmb3J3YXJkIHdheS5cblxuXG4vLyBob3ZlciBvdmVyIHggdG8gc2VlIGl0cyBpbmZlcnJlZCB0eXBlXG5sZXQgbiA9IDIyIGluXG5cbi8vIHRoaXMgaXMgaG93IHR5cGVzIGFyZSBhbm5vdGF0ZWQuIHR5cGVzIGFyZSBlc3NlbnRpYWxseSBqdXN0IGZ1bmN0aW9ucyBvdmVyIHZhbHVlcy5cbmxldCBrID0gKG51bWJlciAzMykgaW5cbmxldCB1ID0gKHN0cmluZyBcImhsbG9cIikgaW5cblxuXG4vLyB1bnR5cGVkIGlkXG5sZXQgaWQgPSBmbiB4ID0+IHggaW5cblxuXG4vLyBudW1iZXIgdHlwZWQgaWRcbmxldCBpZG4gPSBmbiB4ID0+IChudW1iZXIgeCkgaW5cblxuLy8gdHlwZSBvZiBudW1iZXIgLT4gbnVtYmVyXG5sZXQgVCA9IGZuIGY9PiBmbiB4ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSkpIGluXG5cbi8vIGFubm90ZWQgaWRcblxubGV0IGlkbl8gPSAoVCBpZCkgaW5cblxubGV0IHI9IChpZCBcIjJcIikgaW5cblxuLy8gdGhpcyBpcyB3aWxsIHJlc3VsdCBpbiB0eXBlIGVycm9yLlxuLy8gbGV0IEJBRCA9IChpZG5fIFwiMlwiKSBpblxuXG4oaWQgMilcbmBcblxuYm9keS5hcHBlbmQoXG4gIGRpdihcbiAgICBzcGFuKCfinIjvuI4nKS5zdHlsZSh7Zm9udFNpemU6IFwiM2VtXCIsIG1hcmdpblJpZ2h0OiBcIjhweFwifSksXG4gICAgc3BhbihcIm15IGVkaXRvclwiKS5zdHlsZSh7Zm9udFNpemU6IFwiMS41ZW1cIiwgZm9udFdlaWdodDogXCJib2xkXCJ9KVxuICApLnN0eWxlKHtkaXNwbGF5OiBcImZsZXhcIiwgYWxpZ25JdGVtczogXCJjZW50ZXJcIiwgbWFyZ2luQm90dG9tOiBcIjE2cHhcIiwgY29sb3I6IFwiZ3JheVwifSksXG5cbiAgRWRpdC5lbCxcbiAgb3V0dmlldyxcbiAgYnV0dG4oXCJhYm91dFwiLCAoKSA9PiBFZGl0LnNldFRleHQoYWJvdXRfdGV4dCkpLFxuICBidXR0bihcImdpdGh1YlwiLCAoKSA9PiB3aW5kb3cub3BlbihcImh0dHBzOi8vZ2l0aHViLmNvbS9ka29ybWFubi9teWVkaXRvclwiKSlcbilcblxuXG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBYU8sSUFBTSxPQUFPLENBQXlDLFFBQVUsSUFBSSxhQUFvRDtBQUFBLEVBQzdILElBQUksVUFBVSxTQUFTLEtBQUssT0FBSyxPQUFPLE1BQU0sVUFBVTtBQUFBLEVBQ3hELElBQUksS0FBSyxTQUFVLFNBQVMsY0FBYyxHQUFHLENBQUMsRUFBRSxPQUFPLEdBQUksU0FBUyxPQUFPLE9BQUssT0FBTyxNQUFNLFVBQVUs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
