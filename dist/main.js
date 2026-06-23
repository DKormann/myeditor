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
var buildAstMap = (ast, comments = []) => {
  let maxEnd = comments.reduce((m, c) => c.span.end.offset > m ? c.span.end.offset : m, ast.span.end.offset);
  let res = Array.from({ length: maxEnd }, () => {
    return;
  });
  const walk = (node) => {
    if (node.span.start == undefined)
      console.error("no start:", node);
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
function parse(code) {
  let tokenized = tokenize(code);
  let tokens = tokenized.tokens;
  let idx = 0;
  let take = () => tokens[idx++];
  let peek = () => tokens[idx];
  let nextIs = (type, value) => {
    let token = peek();
    if (!token || token.type !== type)
      return false;
    if (value !== undefined) {
      if (!("value" in token))
        return false;
      return token.value === value;
    }
    return true;
  };
  let takeIs = (type, value) => {
    let res = nextIs(type, value);
    if (res)
      take();
    return res;
  };
  let asBinder = (term) => {
    if (term.$ === "var")
      return term;
    if (term.$ === "app" && term.content.args.length === 1 && term.content.args[0].$ === "var") {
      let variable = term.content.args[0];
      variable.type = term.content.fn;
      return variable;
    }
    return mkAst("error", { message: "Expected binder (variable or annotated variable)", content: code.slice(term.span.start.offset, term.span.end.offset) }, term.span);
  };
  let go = () => {
    let next = take();
    if (!next)
      return mkAst("error", { message: "unexpected end of input", content: "" });
    let mkspan = (ast2) => {
      ast2.span = {
        start: next.span.start,
        end: tokens[Math.min(tokens.length, idx) - 1]?.span.end
      };
      console.log(ast2.span);
      return ast2;
    };
    let mkerror = (msg) => mkspan(mkAst("error", { message: msg, content: "" }));
    switch (next.type) {
      case "number":
        return mkAst("number", next.value, next.span);
      case "ident":
        return mkAst("var", { name: next.value }, next.span);
      case "string":
        return mkAst("string", next.value, next.span);
      case "symbol": {
        if (next.value === "(") {
          let items = [];
          while (!nextIs("symbol", ")")) {
            if (!peek())
              return mkAst("error", { message: "Unterminated parenthesized expression", content: code.slice(next.span.start.offset) }, next.span);
            items.push(go());
          }
          let close = take();
          if (items.length === 0)
            return mkAst("error", { message: "Empty parentheses are not allowed", content: code.slice(next.span.start.offset, close.span.end.offset) }, { start: next.span.start, end: close.span.end });
          if (items.length === 1)
            return items[0];
          return mkAst("app", { fn: items[0], args: items.slice(1) }, { start: next.span.start, end: close.span.end });
        }
      }
      case "keyword": {
        if (next.value === "let") {
          let binder;
          let value;
          let body2;
          binder = asBinder(go());
          if (binder.$ == "error")
            return binder;
          if (!takeIs("symbol", "="))
            return mkerror("expected (=)");
          value = go();
          if (!takeIs("keyword", "in"))
            return mkerror("expected (in)");
          body2 = go();
          return mkspan(mklet(binder, value, body2));
        }
        if (next.value === "fn") {
          let vars = [];
          while (!takeIs("arrow")) {
            let binder = go();
            if (binder.$ === "error")
              return mkAst("function", { vars, body: binder }, { start: next.span.start, end: binder.span.end });
            else if (binder.$ === "var")
              vars.push(binder);
            else if (binder.$ === "app") {
              let { fn, args } = binder.content;
              if (args.length == 1 && args[0].$ === "var") {
                binder = args[0];
                binder.type = fn;
                vars.push(binder);
              }
            } else
              return mkAst("error", { message: "Expected function parameter", content: code.slice(binder.span.start.offset, binder.span.end.offset) }, binder.span);
          }
          let body2 = go();
          return mkAst("function", { vars, body: body2 }, { start: next.span.start, end: body2.span.end });
        }
      }
    }
    return mkAst("error", { message: `Unexpected token: ${next.type}${"value" in next ? `(${String(next.value)})` : ""}`, content: code.slice(next.span.start.offset, next.span.end.offset) }, next.span);
  };
  let ast = go();
  return { ast, comments: tokenized.comments };
}
var parseAST = (code) => parse(code).ast;
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
var hasShownType = (v) => v.type && !(v.type.$ === "var" && v.type.content.name === "any");
var prettyBinder = (v) => hasShownType(v) ? `(${prettyAST(v.type)} ${v.content.name})` : v.content.name;
var test_parse = (code, expected) => {
  let ast = parseAST(code);
  let A = prettyAST(ast);
  let B = prettyAST(expected);
  if (A !== B) {
    console.error("Expected:", B);
    console.error("Got:     ", A);
    throw new Error(`Test failed for code: ${code}`);
  }
};
var test_span = (code, expected) => {
  let ast = parseAST(code);
  if (JSON.stringify(ast.span) !== JSON.stringify(expected)) {
    console.error("Expected:", expected);
    console.error("Got:     ", ast.span);
    throw new Error(`Span test failed for code: ${code}`);
  }
};
var mknum = (n) => mkAst("number", n);
var mkstr = (s) => mkAst("string", s);
var mkvar = (name) => mkAst("var", { name });
var mkapp = (fn, args) => mkAst("app", { fn, args });
var mklet = (v, value, body2) => mkAst("let", { var: typeof v === "string" ? mkvar(v) : v, value, body: body2 });
var mkfun = (vars, body2) => mkAst("function", { vars: vars.map((v) => typeof v === "string" ? mkvar(v) : v), body: body2 });
Object.entries({
  x: mkvar("x"),
  "22": mknum(22),
  '"hello"': mkstr("hello"),
  "(f x)": mkapp(mkvar("f"), [mkvar("x")]),
  "(f x y)": mkapp(mkvar("f"), [mkvar("x"), mkvar("y")]),
  "let ix = 22 in ix": mklet("ix", mknum(22), mkvar("ix")),
  "fn x => x": mkfun(["x"], mkvar("x")),
  "let u = 4 in let v = 5 in u": mklet("u", mknum(4), mklet("v", mknum(5), mkvar("u"))),
  "let (number x) = 22 in x": mklet(Object.assign(mkvar("x"), { type: mkvar("number") }), mknum(22), mkvar("x")),
  "fn x y => x": mkfun(["x", "y"], mkvar("x")),
  "fn (number x) => x": mkfun([Object.assign(mkvar("x"), { type: mkvar("number") })], mkvar("x"))
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
      case "error":
        return term2;
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
          console.error(e);
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
    console.error(e);
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

//# debugId=C37FF8404E849BD464756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2h0bWwudHMiLCAiLi4vc3JjL2VkaXRvci50cyIsICIuLi9zcmMvcGFyc2VyLnRzIiwgIi4uL3NyYy9sc3AudHMiLCAiLi4vc3JjL3J1bnRpbWUudHMiLCAiLi4vc3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiXG5cbmV4cG9ydCB0eXBlIE5PREUgPEggZXh0ZW5kcyBIVE1MRWxlbWVudCA9IEhUTUxFbGVtZW50PiA9ICB7XG4gICQgOiBcIk5PREVcIixcbiAgZWw6IEgsXG4gIGFwcGVuZDogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCk9PiBOT0RFLFxuICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOiAoTk9ERSB8IHN0cmluZylbXSkgPT4gTk9ERSxcbiAgc3R5bGU6IChzdHlsZXM6IFBhcnRpYWw8Q1NTU3R5bGVEZWNsYXJhdGlvbj4pID0+IE5PREU8SD4sXG4gIGFzc2lnbjogKGh0bWxQcm9wczogUGFydGlhbDxIVE1MRWxlbWVudD4pID0+IE5PREVcbn1cblxuZXhwb3J0IHR5cGUgQVJHID0gTk9ERSB8IHN0cmluZyB8ICgoZTpNb3VzZUV2ZW50KT0+dm9pZClcblxuZXhwb3J0IGNvbnN0IGh0bWwgPSA8SyBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZU1hcD4gKHRhZzpLKSA9PiAoLi4uY2hpbGRyZW46QVJHW10pOiBOT0RFIDxIVE1MRWxlbWVudFRhZ05hbWVNYXBbS10+ID0+IHtcbiAgbGV0IG9uY2xpY2sgPSBjaGlsZHJlbi5maW5kKGMgPT4gdHlwZW9mIGMgPT09IFwiZnVuY3Rpb25cIikgYXMgRnVuY3Rpb25cbiAgbGV0IGVsID0gZnJvbUhUTUwgKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKSkuYXBwZW5kKC4uLiBjaGlsZHJlbi5maWx0ZXIoYyA9PiB0eXBlb2YgYyAhPT0gXCJmdW5jdGlvblwiKSBhcyAoTk9ERSB8IHN0cmluZylbXSkgYXMgTk9ERSA8SFRNTEVsZW1lbnRUYWdOYW1lTWFwW0tdPjtcbiAgaWYgKG9uY2xpY2spIGVsLmVsLiBvbmNsaWNrID0gKG9uY2xpY2sgYXMgKGU6TW91c2VFdmVudCk9PnZvaWQpXG4gIFxuICByZXR1cm4gZWxcbn1cblxuXG5leHBvcnQgY29uc3QgZnJvbUhUTUwgID0gPEggZXh0ZW5kcyBIVE1MRWxlbWVudD4gIChlbDpIKTogTk9ERSA8SD4gPT4ge1xuXG4gIGxldCBub2RlIDogTk9ERTxIPiA9IHtcbiAgICAkOiBcIk5PREVcIixcbiAgICBlbCxcbiAgICBhcHBlbmQ6ICguLi5jaGlsZHJlbjooTk9ERXwgc3RyaW5nKVtdKSA9PiB7XG4gICAgICBjaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGlsZCA9PT0gXCJzdHJpbmdcIikgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpKTtcbiAgICAgICAgZWxzZSBlbC5hcHBlbmRDaGlsZChjaGlsZC5lbCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0sXG4gICAgb25jbGljazogKGY6KGU6TW91c2VFdmVudCkgPT4gdm9pZCkgPT4ge1xuICAgICAgZWwub25jbGljayA9IGZcbiAgICAgIHJldHVybiBub2RlXG4gICAgfSxcbiAgICByZXBsYWNlQ2hpbHJlbjogKC4uLmNoaWxkcmVuOihOT0RFfCBzdHJpbmcpW10pID0+IHtcbiAgICAgIGVsLnJlcGxhY2VDaGlsZHJlbigpXG4gICAgICByZXR1cm4gbm9kZS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gICAgfSxcbiAgICBzdHlsZTogKHN0eWxlczogUGFydGlhbDxDU1NTdHlsZURlY2xhcmF0aW9uPikgPT4ge1xuICAgICAgT2JqZWN0LmFzc2lnbihlbC5zdHlsZSwgc3R5bGVzKTtcbiAgICAgIHJldHVybiBmcm9tSFRNTChlbCk7XG4gICAgfSxcbiAgICBhc3NpZ246IChodG1sUHJvcHM6IFBhcnRpYWw8SFRNTEVsZW1lbnQ+KSA9PiB7XG4gICAgICBPYmplY3QuYXNzaWduKGVsLCBodG1sUHJvcHMpO1xuICAgICAgcmV0dXJuIGZyb21IVE1MKGVsKTtcbiAgICB9XG4gIH07XG4gIHJldHVybiBub2RlXG59XG5cblxuZXhwb3J0IGNvbnN0IGRpdiA9IGh0bWwoXCJkaXZcIik7XG5leHBvcnQgY29uc3Qgc3BhbiA9IGh0bWwoXCJzcGFuXCIpO1xuZXhwb3J0IGNvbnN0IHAgPSBodG1sKFwicFwiKTtcbmV4cG9ydCBjb25zdCBib2R5ID0gZnJvbUhUTUwoZG9jdW1lbnQuYm9keSk7XG5leHBvcnQgY29uc3QgaDEgPSBodG1sKFwiaDFcIik7XG5leHBvcnQgY29uc3QgaDIgPSBodG1sKFwiaDJcIik7XG5leHBvcnQgY29uc3QgaDMgPSBodG1sKFwiaDNcIik7XG5leHBvcnQgY29uc3QgaDQgPSBodG1sKFwiaDRcIik7XG5leHBvcnQgY29uc3QgdGFibGUgPSBodG1sKFwidGFibGVcIik7XG5leHBvcnQgY29uc3QgdHIgPSBodG1sKFwidHJcIik7XG5leHBvcnQgY29uc3QgdGQgPSBodG1sKFwidGRcIik7XG5leHBvcnQgY29uc3QgcHJlID0gaHRtbChcInByZVwiKVxuXG5leHBvcnQgY29uc3QgY2FudmFzID0gaHRtbChcImNhbnZhc1wiKTtcblxuZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IGh0bWwoXCJidXR0b25cIik7XG5cblxuXG5sZXQgZ2xvYnN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpXG5nbG9ic3R5bGUudGV4dENvbnRlbnQgPSBgXG4gIGJvZHl7XG4gIC0tcmVkOiAjZTA2Yzc1O1xuICAtLWdyZWVuOiAjOThjMzc5O1xuICAtLWJsdWU6ICM2MWFmZWY7XG4gIC0teWVsbG93OiAjZTVjMDdiO1xuICAtLXB1cnBsZTogI2M2NzhkZDtcbiAgLS1jeWFuOiAjNmVlZWZmO1xuICAtLWdyYXk6ICNhYmIyYmY4ODtcbiAgLS1jb2xvcjogI2U3ZWFmMDtcbiAgLS1iYWNrZ3JvdW5kOiAjMjIyMTIyO1xuICB9XG4gIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGxpZ2h0KSB7XG4gICAgYm9keXtcbiAgICAgIC0tcmVkOiAjZjEwZjIyO1xuICAgICAgLS1ncmVlbjogIzU0YzgwMTtcbiAgICAgIC0tYmx1ZTogIzFmMzJmZjtcbiAgICAgIC0teWVsbG93OiAjZDM5ZTNkO1xuICAgICAgLS1icm93bjogI2M1NWQwMDtcbiAgICAgIC0tcHVycGxlOiAjYTYxZmQwO1xuICAgICAgLS1jeWFuOiAjMGJhZWJjO1xuICAgICAgLS1ncmF5OiAjNjc2YTZlODg7XG4gICAgICAtLWNvbG9yOiAjMjgyYzM0O1xuICAgICAgLS1iYWNrZ3JvdW5kOiAjZmZmZmZmO1xuXG4gICAgfVxuICB9XG5gXG5cbmRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZ2xvYnN0eWxlKVxuXG5cbmV4cG9ydCBjb25zdCBjb2xvciA9IHtcbiAgcmVkOiBcInZhcigtLXJlZClcIixcbiAgZ3JlZW46IFwidmFyKC0tZ3JlZW4pXCIsXG4gIGJsdWU6IFwidmFyKC0tYmx1ZSlcIixcbiAgeWVsbG93OiBcInZhcigtLXllbGxvdylcIixcbiAgcHVycGxlOiBcInZhcigtLXB1cnBsZSlcIixcbiAgY3lhbjogXCJ2YXIoLS1jeWFuKVwiLFxuXG4gIGdyYXk6IFwidmFyKC0tZ3JheSlcIixcbiAgY29sb3I6IFwidmFyKC0tY29sb3IpXCIsXG4gIGJhY2tncm91bmQ6IFwidmFyKC0tYmFja2dyb3VuZClcIlxufVxuXG5cbmJvZHkuZWwuc3R5bGUgPWBcbmJhY2tncm91bmQ6ICR7Y29sb3IuYmFja2dyb3VuZH07XG5jb2xvcjogJHtjb2xvci5jb2xvcn07XG5gXG4iLAogICAgImltcG9ydCB7ZGl2LCBodG1sLCBwLCBzcGFuLCBjb2xvcn0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQgeyB0eXBlIFN5bnRheE5vZGUgfSBmcm9tIFwiLi9wYXJzZXJcIlxuXG50eXBlIFBvcyA9IHsgY29sOiBudW1iZXIsIHJvdzogbnVtYmVyIH1cblxuZXhwb3J0IGNvbnN0IGNvbG9yT2YgPSAobm9kZTogU3ludGF4Tm9kZSB8IGFueSk6IHN0cmluZyA9PiBcbiAgKG5vZGUgPT0gdW5kZWZpbmVkKSA/IGNvbG9yLmdyYXkgOlxuICAobm9kZS4kID09PSBcImNvbW1lbnRcIikgPyBjb2xvci5ncmF5IDpcbiAgKG5vZGUuJCA9PT0gXCJudW1iZXJcIiB8fCBub2RlLiQgPT09IFwic3RyaW5nXCIgKSA/IGNvbG9yLnllbGxvdyA6XG4gIChub2RlLiQgPT09IFwidmFyXCIpID8gY29sb3IucHVycGxlIDpcbiAgKG5vZGUuJCA9PT0gXCJsZXRcIiB8fCBub2RlLiQgPT0gXCJmdW5jdGlvblwiICkgPyBjb2xvci5jeWFuIDpcbiAgKG5vZGUuJCA9PT0gXCJhcHBcIikgPyBjb2xvci5ncmVlbiA6XG4gIChub2RlLiQgPT09IFwiZXJyb3JcIikgPyBjb2xvci5yZWQgOlxuICBjb2xvci5jb2xvclxuXG5cbmxldCBlID0gMiBhcyBudW1iZXJcblxuZXhwb3J0IGNvbnN0IGVkaXRvciA9IChcbiAgY29kZTogc3RyaW5nLFxuICBvbmlucHV0OiAoczpzdHJpbmcpPT52b2lkLFxuICBnZXRBc3RNYXAgOiAoKT0+IChTeW50YXhOb2RlfHVuZGVmaW5lZClbXSxcbiAgZ29Ub0RlZiA6IChhc3Q6IFN5bnRheE5vZGUpID0+IHZvaWQsXG4gIGhvdmVySW5mbzogKGFzdDogU3ludGF4Tm9kZSkgPT4gW3N0cmluZywgKFN5bnRheE5vZGV8dW5kZWZpbmVkKVtdIF1cbikgPT4ge1xuXG4gIGxldCBsaW5lcyA9IGNvZGUuc3BsaXQoXCJcXG5cIilcbiAgbGV0IGN1cnNvciA6IFBvcyAmIHtzZWxlY3Rpb24/IDogUG9zfSA9IHtjb2w6MCwgcm93OjB9O1xuXG4gIGxldCBlbCA9IGh0bWwoXCJwcmVcIikoKVxuICAuc3R5bGUoe1xuICAgIHVzZXJTZWxlY3Q6IFwibm9uZVwiLFxuICAgIGN1cnNvcjogXCJ0ZXh0XCIsXG4gIH0pXG5cblxuICBsZXQgaGlzdCA6IHN0cmluZ1tdID0gW11cbiAgbGV0IGVsZW1lbnRzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIHtwb3M6UG9zLCBhc3Q/OiBTeW50YXhOb2RlfT4oKVxuICBsZXQgYXN0bWFwOiAoU3ludGF4Tm9kZXx1bmRlZmluZWQpW10gPSBbXVxuXG4gIGxldCBwbGVzcyA9IChhOiBQb3MsIGI6IFBvcykgPT4gYS5yb3cgPCBiLnJvdyB8fCAoYS5yb3cgPT0gYi5yb3cgJiYgYS5jb2wgPCBiLmNvbClcbiAgbGV0IHBsZXNzZXEgPSAoYTogUG9zLCBiOiBQb3MpID0+IGEucm93IDwgYi5yb3cgfHwgKGEucm93ID09IGIucm93ICYmIGEuY29sIDw9IGIuY29sKVxuXG4gIGxldCBzZWxyYW5nZSA9ICgpIDogdW5kZWZpbmVkIHwgW1BvcywgUG9zXSA9PiB7XG4gICAgaWYgKCFjdXJzb3Iuc2VsZWN0aW9uKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgaWYgKGN1cnNvci5yb3cgPT0gY3Vyc29yLnNlbGVjdGlvbi5yb3cgJiYgY3Vyc29yLmNvbCA9PSBjdXJzb3Iuc2VsZWN0aW9uLmNvbCkge1xuICAgICAgY3Vyc29yLnNlbGVjdGlvbiA9IHVuZGVmaW5lZFxuICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgIH1cbiAgICBpZiAocGxlc3NlcShjdXJzb3IsIGN1cnNvci5zZWxlY3Rpb24pKSByZXR1cm4gW2N1cnNvciwgY3Vyc29yLnNlbGVjdGlvbl1cbiAgICBlbHNlIHJldHVybiBbY3Vyc29yLnNlbGVjdGlvbiwgY3Vyc29yXVxuICB9XG5cbiAgY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuICAgIGxldCBjb2RlID0gbGluZXMuam9pbihcIlxcblwiKVxuICAgIGxldCBzY29sID0gTWF0aC5taW4oY3Vyc29yLmNvbCwgbGluZXNbY3Vyc29yLnJvd10/Lmxlbmd0aCA/PyAwKVxuXG4gICAgbGV0IGNoYXJzOiBIVE1MRWxlbWVudFtdID0gW11cblxuXG4gICAgbGV0IG1rY29sb3IgPSAoKSA9PiB7XG4gICAgICBjaGFycy5mb3JFYWNoKChjLCBpKT0+e1xuICAgICAgICBsZXQgYXN0ID0gYXN0bWFwW2ldXG4gICAgICAgIGxldCBjb2xvciA9IGNvbG9yT2YoYXN0KVxuICAgICAgICBpZiAoY29sb3IpIGMuc3R5bGUuY29sb3IgPSBjb2xvclxuICAgICAgICBlbHNlIGMuc3R5bGUuY29sb3IgPSBcIlwiXG4gICAgICAgIGVsZW1lbnRzLmdldChjKSEuYXN0ID0gYXN0XG4gICAgICB9KVxuICAgIH1cblxuICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcblxuXG4gICAgZWwucmVwbGFjZUNoaWxyZW4oLi4ubGluZXMubWFwKChsaW5lLHJvdyk9PntcbiAgICAgIGxldCBwYXIgPSBwKFxuICAgICAgICAuLi5saW5lLnNwbGl0KFwiXCIpLmNvbmNhdCgnICcpLm1hcChcbiAgICAgICAgICAoY2hhcixjb2wpPT57XG5cbiAgICAgICAgICAgIGxldCBjaHIgPSBzcGFuKGNoYXIpXG4gICAgICAgICAgICAuc3R5bGUoIHJhbmdlICYmIHBsZXNzKHtyb3csIGNvbH0sIHJhbmdlWzFdKSAmJiBwbGVzc2VxKHJhbmdlWzBdLCB7cm93LCBjb2x9KSA/IHtiYWNrZ3JvdW5kQ29sb3I6IFwiIzhkOTZmZjg1XCIsIGNvbG9yOiBjb2xvci5iYWNrZ3JvdW5kfSA6IHt9KVxuICAgICAgICAgICAgLnN0eWxlKGN1cnNvci5yb3cgPT09IHJvdyAmJiBzY29sID09PSBjb2wgPyB7Ym94U2hhZG93OiBgMnB4IDAgMCAwICR7Y29sb3IuY29sb3J9IGluc2V0YCx9IDoge30pXG4gICAgICAgICAgICBjaGFycy5wdXNoKGNoci5lbClcbiAgICAgICAgICAgIGVsZW1lbnRzLnNldChjaHIuZWwsIHtwb3M6IHtyb3csIGNvbH19KVxuICAgICAgICAgICAgcmV0dXJuIGNoclxuICAgICAgICAgIH1cbiAgICAgICAgKSxcbiAgICAgICkuc3R5bGUoe21hcmdpbjogXCIwXCJ9KVxuICAgICAgZWxlbWVudHMuc2V0KHBhci5lbCwge3Bvczp7cm93LCBjb2w6IGxpbmUubGVuZ3RofX0pXG4gICAgICByZXR1cm4gcGFyXG4gICAgfSkpXG5cbiAgICBta2NvbG9yKClcblxuICAgIGlmIChoaXN0W2hpc3QubGVuZ3RoIC0gMV0gIT0gY29kZSkge1xuICAgICAgb25pbnB1dChjb2RlKVxuICAgICAgaGlzdC5wdXNoKGNvZGUpXG4gICAgICBhc3RtYXAgPSBnZXRBc3RNYXAoKVxuICAgICAgbWtjb2xvcigpXG4gICAgfVxuXG4gIH1cblxuXG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGU9PntcbiAgICBsZXQgc2V0Q3Vyc29yID0gKHBvczpQb3MpPT57XG4gICAgICBpZiAoIWUuc2hpZnRLZXkpIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICAgIGVsc2UgY3Vyc29yLnNlbGVjdGlvbiA9IGN1cnNvci5zZWxlY3Rpb24gfHwge3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sfVxuICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgIGN1cnNvci5yb3cgPSBwb3Mucm93XG4gICAgfVxuXG4gICAgbGV0IGNsZWFyX3JhbmdlID0gKCkgPT4ge1xuICAgICAgbGV0IHJhbmdlID0gc2VscmFuZ2UoKVxuICAgICAgaWYgKCFyYW5nZSkgcmV0dXJuXG4gICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCByYW5nZVswXS5yb3cpLCBsaW5lc1tyYW5nZVswXS5yb3ddLnN1YnN0cmluZygwLCByYW5nZVswXS5jb2wpICsgbGluZXNbcmFuZ2VbMV0ucm93XS5zdWJzdHJpbmcocmFuZ2VbMV0uY29sKSwgLi4ubGluZXMuc2xpY2UocmFuZ2VbMV0ucm93ICsgMSldXG4gICAgICBzZXRDdXJzb3Ioe3JvdzogcmFuZ2VbMF0ucm93LCBjb2w6IHJhbmdlWzBdLmNvbH0pXG4gICAgfVxuXG4gICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGUua2V5ID09IFwielwiKXtcbiAgICAgICAgICBpZiAoaGlzdC5sZW5ndGggPiAxKXtcbiAgICAgICAgICAgIGhpc3QucG9wKClcbiAgICAgICAgICAgIGxldCBsYXN0ID0gaGlzdFtoaXN0Lmxlbmd0aCAtIDFdXG4gICAgICAgICAgICBoaXN0LnBvcCgpXG4gICAgICAgICAgICBsaW5lcyA9IGxhc3Quc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgIHNldEN1cnNvcih7cm93OjAsIGNvbDowfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVuZGVyKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT0gXCJjXCIpe1xuICAgICAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgICAgICBpZiAocmFuZ2Upe1xuICAgICAgICAgICAgbGV0IHRleHQgPSBsaW5lcy5zbGljZShyYW5nZVswXS5yb3csIHJhbmdlWzFdLnJvdyArIDEpLm1hcCgobGluZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaSA9PSAwICYmIGkgPT0gcmFuZ2VbMV0ucm93IC0gcmFuZ2VbMF0ucm93KSByZXR1cm4gbGluZS5zdWJzdHJpbmcocmFuZ2VbMF0uY29sLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgaWYgKGkgPT0gMCkgcmV0dXJuIGxpbmUuc3Vic3RyaW5nKHJhbmdlWzBdLmNvbClcbiAgICAgICAgICAgICAgZWxzZSBpZiAoaSA9PSByYW5nZVsxXS5yb3cgLSByYW5nZVswXS5yb3cpIHJldHVybiBsaW5lLnN1YnN0cmluZygwLCByYW5nZVsxXS5jb2wpXG4gICAgICAgICAgICAgIGVsc2UgcmV0dXJuIGxpbmVcbiAgICAgICAgICAgIH0pLmpvaW4oXCJcXG5cIilcbiAgICAgICAgICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChlLmtleSA9PSBcInZcIil7XG4gICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC5yZWFkVGV4dCgpLnRoZW4odGV4dCA9PiB7XG4gICAgICAgICAgICBsZXQgcmFuZ2UgPSBzZWxyYW5nZSgpXG4gICAgICAgICAgICBjbGVhcl9yYW5nZSgpXG4gICAgICAgICAgICBsZXQgaW5zZXJ0TGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICBsaW5lcyA9IFsuLi5saW5lcy5zbGljZSgwLCBjdXJzb3Iucm93KSwgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgaW5zZXJ0TGluZXNbMF0sIC4uLmluc2VydExpbmVzLnNsaWNlKDEsIC0xKSwgaW5zZXJ0TGluZXMubGVuZ3RoID4gMSA/IGluc2VydExpbmVzW2luc2VydExpbmVzLmxlbmd0aCAtIDFdICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpIDogbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wpLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMSldXG4gICAgICAgICAgICBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIGluc2VydExpbmVzLmxlbmd0aCAtIDEsIGNvbDogKGluc2VydExpbmVzLmxlbmd0aCA+IDEgPyBpbnNlcnRMaW5lc1tpbnNlcnRMaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggOiBjdXJzb3IuY29sICsgaW5zZXJ0TGluZXNbMF0ubGVuZ3RoKX0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgZS5rZXkgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbClcbiAgICAgIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgKyAxfSlcbiAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSB1bmRlZmluZWRcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkJhY2tzcGFjZVwiKXtcbiAgICAgIGxldCByYW5nZSA9IHNlbHJhbmdlKClcbiAgICAgIGlmIChyYW5nZSl7XG4gICAgICAgIGNsZWFyX3JhbmdlKClcblxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZS5tZXRhS2V5ICYmIGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZyggY3Vyc29yLmNvbCksIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgICAgY3Vyc29yLmNvbCA9IDBcbiAgICAgIFxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5jb2wgPiAwKXtcbiAgICAgICAgY3Vyc29yLmNvbC0tXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddID0gbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKDAsIGN1cnNvci5jb2wpICsgbGluZXNbY3Vyc29yLnJvd10uc3Vic3RyaW5nKGN1cnNvci5jb2wgKyAxKVxuICAgICAgfWVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKXtcbiAgICAgICAgY3Vyc29yLnJvdy0tXG4gICAgICAgIGN1cnNvci5jb2wgPSBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGhcbiAgICAgICAgbGluZXMgPSBbLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksIGxpbmVzW2N1cnNvci5yb3ddICsgbGluZXNbY3Vyc29yLnJvdyArIDFdLCAuLi5saW5lcy5zbGljZShjdXJzb3Iucm93ICsgMildXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93TGVmdFwiKXtcbiAgICAgIGlmIChlLm1ldGFLZXkpe1xuICAgICAgICBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IDB9KVxuICAgICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGxpbmVzW2N1cnNvci5yb3cgLSAxXS5sZW5ndGh9KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoY3Vyc29yLmNvbCA+IDApIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGN1cnNvci5jb2wgLSAxfSlcbiAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPiAwKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyAtIDEsIGNvbDogbGluZXNbY3Vyc29yLnJvdyAtIDFdLmxlbmd0aH0pXG5cbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkFycm93UmlnaHRcIil7XG4gICAgICBpZiAoZS5tZXRhS2V5KXtcbiAgICAgICAgaWYgKGN1cnNvci5jb2wgPCBsaW5lc1tjdXJzb3Iucm93XS5sZW5ndGgpIHNldEN1cnNvcih7cm93OiBjdXJzb3Iucm93LCBjb2w6IGxpbmVzW2N1cnNvci5yb3ddLmxlbmd0aH0pXG4gICAgICAgIGVsc2UgaWYgKGN1cnNvci5yb3cgPCBsaW5lcy5sZW5ndGggLSAxKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdyArIDEsIGNvbDogMH0pXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjdXJzb3IuY29sIDwgbGluZXNbY3Vyc29yLnJvd10ubGVuZ3RoKSBzZXRDdXJzb3Ioe3JvdzogY3Vyc29yLnJvdywgY29sOiBjdXJzb3IuY29sICsgMX0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IDB9KVxuICAgIH1cblxuICAgIGlmIChlLmtleSA9PT0gXCJBcnJvd1VwXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IDAsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93ID4gMCkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgLSAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiQXJyb3dEb3duXCIpe1xuICAgICAgaWYgKGUubWV0YUtleSkgc2V0Q3Vyc29yKHtyb3c6IGxpbmVzLmxlbmd0aCAtIDEsIGNvbDogY3Vyc29yLmNvbH0pXG4gICAgICBlbHNlIGlmIChjdXJzb3Iucm93IDwgbGluZXMubGVuZ3RoIC0gMSkgc2V0Q3Vyc29yKHtyb3c6IGN1cnNvci5yb3cgKyAxLCBjb2w6IGN1cnNvci5jb2x9KVxuICAgIH1cbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIil7XG4gICAgICBsaW5lcyA9IFtcbiAgICAgICAgLi4ubGluZXMuc2xpY2UoMCwgY3Vyc29yLnJvdyksXG4gICAgICAgIGxpbmVzW2N1cnNvci5yb3ddLnN1YnN0cmluZygwLCBjdXJzb3IuY29sKSxcbiAgICAgICAgKGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0gfHwgXCJcIikgKyBsaW5lc1tjdXJzb3Iucm93XS5zdWJzdHJpbmcoY3Vyc29yLmNvbCksXG4gICAgICAgIC4uLmxpbmVzLnNsaWNlKGN1cnNvci5yb3cgKyAxKV1cbiAgICAgIGN1cnNvci5yb3crK1xuICAgICAgY3Vyc29yLmNvbCA9IGxpbmVzW2N1cnNvci5yb3ddLm1hdGNoKC9eXFxzKi8pPy5bMF0ubGVuZ3RoIHx8IDBcbiAgICB9XG5cblxuICAgIGlmIChlLmtleS5zdGFydHNXaXRoKFwiQXJyb3dcIikpe1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgfVxuXG4gICAgcmVuZGVyKClcblxuICB9KVxuXG5cbiAgbGV0IG1vdXNlZG93bj0gZmFsc2UgIFxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGU9PntcbiAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICBsZXQgYXN0ID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KT8uYXN0XG4gICAgICBpZiAoYXN0KSBnb1RvRGVmKGFzdClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBtb3VzZWRvd24gPSB0cnVlXG4gICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgY3Vyc29yID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfSlcblxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBlPT57XG4gICAgaWYgKG1vdXNlZG93bikge1xuICAgICAgaWYgKGVsZW1lbnRzLmhhcyhlLnRhcmdldCBhcyBIVE1MRWxlbWVudCkpe1xuICAgICAgICBsZXQgcG9zID0gZWxlbWVudHMuZ2V0KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KSEucG9zXG4gICAgICAgIGN1cnNvci5zZWxlY3Rpb24gPSBjdXJzb3Iuc2VsZWN0aW9uIHx8IHtyb3c6IGN1cnNvci5yb3csIGNvbDogY3Vyc29yLmNvbH1cbiAgICAgICAgY3Vyc29yLnJvdyA9IHBvcy5yb3dcbiAgICAgICAgY3Vyc29yLmNvbCA9IHBvcy5jb2xcbiAgICAgICAgcmVuZGVyKClcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGxldCBhc3QgPSBlbGVtZW50cy5nZXQoZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQpPy5hc3RcbiAgICAgIGlmIChhc3QpIHtcbiAgICAgICAgbGV0IFtpbmZvLCBhc3RtYXBdID0gaG92ZXJJbmZvKGFzdClcbiAgICAgICAgaWYgKGluZm8pIHtcbiAgICAgICAgICBsZXQgdG9vbHRpcCA9IGRpdiguLi5pbmZvLnNwbGl0KCcnKS5tYXAoKGMsaSk9PnNwYW4oYykuc3R5bGUoe2NvbG9yOiBjb2xvck9mKGFzdG1hcFtpXSl9KSkpXG4gICAgICAgICAgLnN0eWxlKHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBcImZpeGVkXCIsXG4gICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICBib3R0b206ICh3aW5kb3cuaW5uZXJIZWlnaHQgLSBlLmNsaWVudFkgKyAxMCkgKyBcInB4XCIsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yLmJhY2tncm91bmQsXG4gICAgICAgICAgICBjb2xvcjogY29sb3IuY29sb3IsXG4gICAgICAgICAgICBib3JkZXI6IFwiMXB4IHNvbGlkIFwiICsgY29sb3IuY29sb3IsXG4gICAgICAgICAgICBwYWRkaW5nOiBcIjhweCAxMnB4XCIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IFwiNHB4XCIsXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgICAgICAgIHpJbmRleDogXCIxMDAwXCIsXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiBcInByZVwiLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwLmVsKVxuICAgICAgICAgIGxldCByZW1vdmUgPSAoKSA9PiB7XG4gICAgICAgICAgICB0b29sdGlwLmVsLnJlbW92ZSgpXG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBvdXQpXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBtb3ZlID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICBpZiAoZS5tZXRhS2V5KSByZXR1cm4gcmVtb3ZlKClcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUoe1xuICAgICAgICAgICAgICBsZWZ0OiBlLmNsaWVudFggKyBcInB4XCIsXG4gICAgICAgICAgICAgIGJvdHRvbTogKHdpbmRvdy5pbm5lckhlaWdodCAtIGUuY2xpZW50WSArIDEwKSArIFwicHhcIixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBvdXQgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGUucmVsYXRlZFRhcmdldCA9PT0gdG9vbHRpcC5lbCkgcmV0dXJuXG4gICAgICAgICAgICByZW1vdmUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCBtb3ZlKVxuICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgb3V0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCBlPT4ge1xuICAgIG1vdXNlZG93biA9IGZhbHNlXG4gIH0pXG5cblxuICByZW5kZXIoKVxuICByZXR1cm4ge2VsLFxuICAgIHNldFRleHQ6ICh0ZXh0OnN0cmluZykgPT4ge1xuICAgICAgbGluZXMgPSB0ZXh0LnNwbGl0KFwiXFxuXCIpXG4gICAgICByZW5kZXIoKVxuICAgIH0sXG4gICAgc2V0Q3Vyc29yOiAocG9zOiBQb3MpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyBjdXJzb3IgdG9cIiwgcG9zKVxuICAgICAgY3Vyc29yID0gcG9zXG4gICAgICByZW5kZXIoKVxuICAgIH1cbiAgfVxuXG4gIFxufVxuIiwKICAgICJleHBvcnQgdHlwZSBQb3MgPSB7b2Zmc2V0OiBudW1iZXIsIGxpbmU6IG51bWJlciwgY29sOiBudW1iZXJ9XG5leHBvcnQgdHlwZSBTcGFuID0ge3N0YXJ0OiBQb3MsIGVuZDogUG9zfVxuXG5leHBvcnQgdHlwZSBUYWcgPFQgZXh0ZW5kcyBzdHJpbmcsIEM+ID0geyQ6IFQsIGNvbnRlbnQ6IEMsIHNwYW46IFNwYW4sIHR5cGU/OiBBU1R9XG5cbmV4cG9ydCB0eXBlIFZhciA9IFRhZzxcInZhclwiLCB7bmFtZTogc3RyaW5nfT5cbmV4cG9ydCB0eXBlIENvbW1lbnQgPSBUYWc8XCJjb21tZW50XCIsIHN0cmluZz5cbmV4cG9ydCB0eXBlIEZ1bmMgPSBUYWc8XCJmdW5jdGlvblwiLCB7dmFyczogVmFyW10sIGJvZHk6IEFTVH0+XG5cbmV4cG9ydCB0eXBlIEVycm9yTm9kZSA9IFRhZzxcImVycm9yXCIsIHttZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30+XG5cbmV4cG9ydCB0eXBlIFByaW0gPSBUYWc8XCJudW1iZXJcIiwgbnVtYmVyPiB8IFRhZzxcInN0cmluZ1wiLCBzdHJpbmc+XG5cbmV4cG9ydCB0eXBlIEFTVCA9XG4gIHwgVGFnPFwiYXBwXCIsIHtmbjogQVNULCBhcmdzOiBBU1RbXX0+XG4gIHwgVmFyXG4gIHwgRnVuY1xuICB8IFByaW1cbiAgfCBUYWc8XCJsZXRcIiwge3ZhcjogVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1R9PlxuICB8IFRhZzxcInJlY29yZFwiLCBbVmFyLCBBU1RdW10+XG4gIHwgRXJyb3JOb2RlXG5cbmV4cG9ydCB0eXBlIFN5bnRheE5vZGUgPSBBU1QgfCBDb21tZW50XG5leHBvcnQgdHlwZSBQYXJzZVJlc3VsdCA9IHthc3Q6IEFTVCwgY29tbWVudHM6IENvbW1lbnRbXX1cblxuXG5cbmNvbnN0IHplcm9Qb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9KVxuY29uc3QgemVyb1NwYW4gPSAoKTogU3BhbiA9PiAoe3N0YXJ0OiB6ZXJvUG9zKCksIGVuZDogemVyb1BvcygpfSlcblxuZXhwb3J0IGNvbnN0IG1rQXN0ID0gPFQgZXh0ZW5kcyBzdHJpbmcsIEM+KHRhZzogVCwgY29udGVudDogQywgc3BhbjogU3BhbiA9IHplcm9TcGFuKCkpOiBUYWc8VCwgQz4gPT4gKHskOiB0YWcsIGNvbnRlbnQsIHNwYW59KVxuXG50eXBlIFRva2VuQmFzZSA9IHtzcGFuOiBTcGFufVxuXG50eXBlIFRva2VuID1cbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiaWRlbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogbnVtYmVyfSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwic3RyaW5nXCIsIHZhbHVlOiBzdHJpbmd9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJzeW1ib2xcIiwgdmFsdWU6IFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwifSlcbiAgfCAoVG9rZW5CYXNlICYge3R5cGU6IFwiYXJyb3dcIn0pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImNvbW1lbnRcIiwgdmFsdWU6IHN0cmluZ30pXG4gIHwgKFRva2VuQmFzZSAmIHt0eXBlOiBcImtleXdvcmRcIiwgdmFsdWU6IFwibGV0XCIgfCBcImluXCIgfCBcImZuXCJ9KVxuICB8IChUb2tlbkJhc2UgJiB7dHlwZTogXCJlcnJvclwiLCBtZXNzYWdlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZ30pXG5cbnR5cGUgVG9rZW5Ob1NwYW4gPSBUb2tlbiBleHRlbmRzIGluZmVyIFQgPyBUIGV4dGVuZHMge3NwYW46IFNwYW59ID8gT21pdDxULCBcInNwYW5cIj4gOiBuZXZlciA6IG5ldmVyXG5cbmNvbnN0IHRva2VuaXplID0gKGNvZGU6IHN0cmluZyk6IHt0b2tlbnM6IFRva2VuW10sIGNvbW1lbnRzOiBDb21tZW50W10sIGVvZjogUG9zfSA9PiB7XG4gIGxldCB0b2tlbnM6IFRva2VuW10gPSBbXVxuICBsZXQgY29tbWVudHM6IENvbW1lbnRbXSA9IFtdXG4gIGxldCBpID0gMFxuICBsZXQgbGluZSA9IDFcbiAgbGV0IGNvbCA9IDFcblxuICBsZXQgaXNBbHBoYSA9IChjaGFyOiBzdHJpbmcpID0+IC9bQS1aYS16X10vLnRlc3QoY2hhcilcbiAgbGV0IGlzRGlnaXQgPSAoY2hhcjogc3RyaW5nKSA9PiAvWzAtOV0vLnRlc3QoY2hhcilcbiAgbGV0IGlzSWRlbnQgPSAoY2hhcjogc3RyaW5nKSA9PiAvW0EtWmEtejAtOV9dLy50ZXN0KGNoYXIpXG4gIGxldCBwb3MgPSAoKTogUG9zID0+ICh7b2Zmc2V0OiBpLCBsaW5lLCBjb2x9KVxuICBsZXQgYWR2YW5jZSA9ICgpID0+IHtcbiAgICBpZiAoY29kZVtpXSA9PT0gXCJcXG5cIikge1xuICAgICAgaSsrXG4gICAgICBsaW5lKytcbiAgICAgIGNvbCA9IDFcbiAgICB9IGVsc2Uge1xuICAgICAgaSsrXG4gICAgICBjb2wrK1xuICAgIH1cbiAgfVxuICBsZXQgcHVzaCA9ICh0b2tlbjogVG9rZW5Ob1NwYW4sIHN0YXJ0OiBQb3MpID0+IHtcbiAgICB0b2tlbnMucHVzaCh7Li4udG9rZW4sIHNwYW46IHtzdGFydCwgZW5kOiBwb3MoKX19IGFzIFRva2VuKVxuICB9XG5cbiAgd2hpbGUgKGkgPCBjb2RlLmxlbmd0aCkge1xuICAgIGxldCBjaGFyID0gY29kZVtpXVxuXG4gICAgaWYgKC9cXHMvLnRlc3QoY2hhcikpIHtcbiAgICAgIGFkdmFuY2UoKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCIvXCIgJiYgY29kZVtpICsgMV0gPT09IFwiL1wiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgY29kZVtpXSAhPT0gXCJcXG5cIikgYWR2YW5jZSgpXG4gICAgICBjb21tZW50cy5wdXNoKG1rQXN0KFwiY29tbWVudFwiLCBjb2RlLnNsaWNlKHN0YXJ0Lm9mZnNldCwgaSksIHtzdGFydCwgZW5kOiBwb3MoKX0pKVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCI9XCIgJiYgY29kZVtpICsgMV0gPT09IFwiPlwiKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwiYXJyb3dcIn0sIHN0YXJ0KVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoXCIoKXt9PSw6XCIuaW5jbHVkZXMoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWUgPSBjaGFyIGFzIFwiKFwiIHwgXCIpXCIgfCBcIntcIiB8IFwifVwiIHwgXCIsXCIgfCBcIj1cIiB8IFwiOlwiXG4gICAgICBhZHZhbmNlKClcbiAgICAgIHB1c2goe3R5cGU6IFwic3ltYm9sXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChjaGFyID09PSAnXCInKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgYWR2YW5jZSgpXG4gICAgICBsZXQgdmFsdWUgPSBcIlwiXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gY29kZVtpXVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICBsZXQgbmV4dCA9IGNvZGVbaSArIDFdXG4gICAgICAgICAgaWYgKG5leHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHN0cmluZyBlc2NhcGVcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgICAgICByZXR1cm4ge3Rva2VucywgY29tbWVudHMsIGVvZjogcG9zKCl9XG4gICAgICAgICAgfVxuICAgICAgICAgIGxldCBlc2NhcGVkID0gKHtuOiBcIlxcblwiLCByOiBcIlxcclwiLCB0OiBcIlxcdFwiLCAnXCInOiAnXCInLCBcIlxcXFxcIjogXCJcXFxcXCJ9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pW25leHRdXG4gICAgICAgICAgdmFsdWUgKz0gZXNjYXBlZCA/PyBuZXh0XG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgYWR2YW5jZSgpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuICAgICAgICBpZiAoY3VycmVudCA9PT0gJ1wiJykgYnJlYWtcbiAgICAgICAgdmFsdWUgKz0gY3VycmVudFxuICAgICAgICBhZHZhbmNlKClcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlW2ldICE9PSAnXCInKSB7XG4gICAgICAgIHB1c2goe3R5cGU6IFwiZXJyb3JcIiwgbWVzc2FnZTogXCJVbnRlcm1pbmF0ZWQgc3RyaW5nIGxpdGVyYWxcIiwgY29udGVudDogY29kZS5zbGljZShzdGFydC5vZmZzZXQsIGkpfSwgc3RhcnQpXG4gICAgICAgIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbiAgICAgIH1cbiAgICAgIGFkdmFuY2UoKVxuICAgICAgcHVzaCh7dHlwZTogXCJzdHJpbmdcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGlzRGlnaXQoY2hhcikpIHtcbiAgICAgIGxldCBzdGFydCA9IHBvcygpXG4gICAgICBsZXQgdmFsdWVTdGFydCA9IGlcbiAgICAgIHdoaWxlIChpIDwgY29kZS5sZW5ndGggJiYgaXNEaWdpdChjb2RlW2ldKSkgYWR2YW5jZSgpXG4gICAgICBwdXNoKHt0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogTnVtYmVyKGNvZGUuc2xpY2UodmFsdWVTdGFydCwgaSkpfSwgc3RhcnQpXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChpc0FscGhhKGNoYXIpKSB7XG4gICAgICBsZXQgc3RhcnQgPSBwb3MoKVxuICAgICAgbGV0IHZhbHVlU3RhcnQgPSBpXG4gICAgICB3aGlsZSAoaSA8IGNvZGUubGVuZ3RoICYmIGlzSWRlbnQoY29kZVtpXSkpIGFkdmFuY2UoKVxuICAgICAgbGV0IHZhbHVlID0gY29kZS5zbGljZSh2YWx1ZVN0YXJ0LCBpKVxuICAgICAgaWYgKHZhbHVlID09PSBcImxldFwiIHx8IHZhbHVlID09PSBcImluXCIgfHwgdmFsdWUgPT09IFwiZm5cIikgcHVzaCh7dHlwZTogXCJrZXl3b3JkXCIsIHZhbHVlfSwgc3RhcnQpXG4gICAgICBlbHNlIHB1c2goe3R5cGU6IFwiaWRlbnRcIiwgdmFsdWV9LCBzdGFydClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgbGV0IHN0YXJ0ID0gcG9zKClcbiAgICBhZHZhbmNlKClcbiAgICBwdXNoKHt0eXBlOiBcImVycm9yXCIsIG1lc3NhZ2U6IGBVbmV4cGVjdGVkIGNoYXJhY3RlcjogJHtjaGFyfWAsIGNvbnRlbnQ6IGNoYXJ9LCBzdGFydClcbiAgfVxuXG4gIHJldHVybiB7dG9rZW5zLCBjb21tZW50cywgZW9mOiBwb3MoKX1cbn1cblxuXG5leHBvcnQgY29uc3QgYnVpbGRBc3RNYXAgPSAoYXN0OiBBU1QsIGNvbW1lbnRzOiBDb21tZW50W10gPSBbXSk6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0+IHtcblxuICBsZXQgbWF4RW5kID0gY29tbWVudHMucmVkdWNlKChtLCBjKSA9PiBjLnNwYW4uZW5kLm9mZnNldCA+IG0gPyBjLnNwYW4uZW5kLm9mZnNldCA6IG0sIGFzdC5zcGFuLmVuZC5vZmZzZXQpXG4gIGxldCByZXM6IChTeW50YXhOb2RlIHwgdW5kZWZpbmVkKVtdID0gQXJyYXkuZnJvbSh7bGVuZ3RoOiBtYXhFbmR9LCAoKT0+dW5kZWZpbmVkKVxuICBjb25zdCB3YWxrID0gKG5vZGU6IEFTVCkgPT4ge1xuICAgIGlmIChub2RlLnNwYW4uc3RhcnQgPT0gdW5kZWZpbmVkKSBjb25zb2xlLmVycm9yKFwibm8gc3RhcnQ6XCIsIG5vZGUpXG4gICAgZm9yIChsZXQgaSA9IG5vZGUuc3Bhbi5zdGFydC5vZmZzZXQ7IGkgPCBub2RlLnNwYW4uZW5kLm9mZnNldDsgaSsrKSByZXNbaV0gPSBub2RlXG4gICAgY2hpbGRyZW4obm9kZSkuZm9yRWFjaCh3YWxrKVxuICB9XG4gIHdhbGsoYXN0KVxuICBjb21tZW50cy5mb3JFYWNoKGNvbW1lbnQgPT4ge1xuICAgIGZvciAobGV0IGkgPSBjb21tZW50LnNwYW4uc3RhcnQub2Zmc2V0OyBpIDwgY29tbWVudC5zcGFuLmVuZC5vZmZzZXQ7IGkrKykgcmVzW2ldID0gY29tbWVudFxuICB9KVxuICByZXR1cm4gcmVzXG59XG5cblxuZXhwb3J0IGNvbnN0IGNoaWxkcmVuID0gKG5vZGU6IEFTVCk6IEFTVFtdID0+IHtcbiAgaWYgKG5vZGUuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gWy4uLm5vZGUuY29udGVudC52YXJzLCBub2RlLmNvbnRlbnQuYm9keV1cbiAgaWYgKG5vZGUuJCA9PT0gXCJhcHBcIikgcmV0dXJuIFtub2RlLmNvbnRlbnQuZm4sIC4uLm5vZGUuY29udGVudC5hcmdzXVxuICBpZiAobm9kZS4kID09PSBcImxldFwiKSByZXR1cm4gW25vZGUuY29udGVudC52YXIsIG5vZGUuY29udGVudC52YWx1ZSwgbm9kZS5jb250ZW50LmJvZHldXG4gIGlmIChub2RlLiQgPT09IFwicmVjb3JkXCIpIHJldHVybiBub2RlLmNvbnRlbnQuZmxhdE1hcCgoW2tleSwgdmFsdWVdKSA9PiBba2V5LCB2YWx1ZV0pXG4gIHJldHVybiBbXVxufVxuXG5jb25zdCBtYXBBc3QgPSAoYXN0OiBBU1QsIGY6IDxUIGV4dGVuZHMgQVNUPih4OlQpID0+VCkgOkFTVCA9PiB7XG4gIGlmIChhc3QuJCA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gbWtmdW4oYXN0LmNvbnRlbnQudmFycy5tYXAodj0+IG1hcEFzdCh2LCBmKSBhcyBWYXIpLCBtYXBBc3QoYXN0LmNvbnRlbnQuYm9keSwgZikpXG4gIGlmIChhc3QuJCA9PT0gXCJhcHBcIikgcmV0dXJuIG1rYXBwKG1hcEFzdChhc3QuY29udGVudC5mbiwgZiksIGFzdC5jb250ZW50LmFyZ3MubWFwKGFyZyA9PiBtYXBBc3QoYXJnLCBmKSkpXG4gIGlmIChhc3QuJCA9PT0gXCJsZXRcIikgcmV0dXJuIG1rbGV0KG1hcEFzdChhc3QuY29udGVudC52YXIsIGYpIGFzIFZhciwgbWFwQXN0KGFzdC5jb250ZW50LnZhbHVlLCBmKSwgbWFwQXN0KGFzdC5jb250ZW50LmJvZHksIGYpKVxuICBpZiAoYXN0LiQgPT09IFwicmVjb3JkXCIpIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKVxuICBpZiAoYXN0LiQgPT09IFwiZXJyb3JcIikgcmV0dXJuIGFzdFxuICByZXR1cm4gZihhc3QpXG59XG5cblxuY29uc3Qgc3RyaXBTcGFucyA9IChhc3Q6IEFTVCk6IEFTVCA9PiBtYXBBc3QoYXN0LCAoeCkgPT4gKHskOiB4LiQsIGNvbnRlbnQ6IHguY29udGVudH0gYXMgYW55KSlcblxuXG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShjb2RlOiBzdHJpbmcpIDoge2FzdDogQVNULCBjb21tZW50czogQ29tbWVudFtdfSB7XG5cblxuICBsZXQgdG9rZW5pemVkID0gdG9rZW5pemUoY29kZSlcbiAgbGV0IHRva2VucyA9IHRva2VuaXplZC50b2tlbnNcblxuXG4gIGxldCBpZHggPSAwXG5cbiAgbGV0IHRha2UgPSAoKTogVG9rZW4gfCB1bmRlZmluZWQgPT4gdG9rZW5zW2lkeCsrXVxuICBsZXQgcGVlayA9ICgpOiBUb2tlbiB8IHVuZGVmaW5lZCA9PiB0b2tlbnNbaWR4XVxuICAvLyBsZXQgYmFjayA9ICgpOiBUb2tlbiA9PiB7aWYgKGlkeCA+IDApIGlkeC0tfVxuXG5cbiAgbGV0IG5leHRJcyA9ICh0eXBlOiBUb2tlbltcInR5cGVcIl0sIHZhbHVlPzogc3RyaW5nKTogYm9vbGVhbiA9PiB7XG4gICAgbGV0IHRva2VuID0gcGVlaygpXG4gICAgaWYgKCF0b2tlbiB8fCB0b2tlbi50eXBlICE9PSB0eXBlKSByZXR1cm4gZmFsc2VcbiAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKCEoXCJ2YWx1ZVwiIGluIHRva2VuKSkgcmV0dXJuIGZhbHNlXG4gICAgICByZXR1cm4gdG9rZW4udmFsdWUgPT09IHZhbHVlXG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBsZXQgdGFrZUlzIDogdHlwZW9mIG5leHRJcyA9ICh0eXBlOiBUb2tlbltcInR5cGVcIl0sIHZhbHVlPzogc3RyaW5nKSA9PiB7XG4gICAgbGV0IHJlcyA9IG5leHRJcyh0eXBlLCB2YWx1ZSlcbiAgICBpZiAocmVzKSB0YWtlKClcbiAgICByZXR1cm4gcmVzXG4gIH1cblxuICBsZXQgYXNCaW5kZXIgPSAodGVybTogQVNUKTogVmFyIHwgRXJyb3JOb2RlID0+IHtcbiAgICBpZiAodGVybS4kID09PSBcInZhclwiKSByZXR1cm4gdGVybVxuICAgIGlmICh0ZXJtLiQgPT09IFwiYXBwXCIgJiYgdGVybS5jb250ZW50LmFyZ3MubGVuZ3RoID09PSAxICYmIHRlcm0uY29udGVudC5hcmdzWzBdLiQgPT09IFwidmFyXCIpe1xuICAgICAgbGV0IHZhcmlhYmxlID0gdGVybS5jb250ZW50LmFyZ3NbMF1cbiAgICAgIHZhcmlhYmxlLnR5cGUgPSB0ZXJtLmNvbnRlbnQuZm5cbiAgICAgIHJldHVybiB2YXJpYWJsZVxuICAgIH1cbiAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJFeHBlY3RlZCBiaW5kZXIgKHZhcmlhYmxlIG9yIGFubm90YXRlZCB2YXJpYWJsZSlcIiwgY29udGVudDogY29kZS5zbGljZSh0ZXJtLnNwYW4uc3RhcnQub2Zmc2V0LCB0ZXJtLnNwYW4uZW5kLm9mZnNldCl9LCB0ZXJtLnNwYW4pXG4gIH1cblxuXG5cbiAgbGV0IGdvID0gKCk6QVNUID0+IHtcblxuICAgIGxldCBuZXh0ID0gdGFrZSgpXG4gICAgaWYgKCFuZXh0KSByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogXCJ1bmV4cGVjdGVkIGVuZCBvZiBpbnB1dFwiLCBjb250ZW50OiBcIlwifSlcblxuICAgIGxldCBta3NwYW4gPSAoYXN0OkFTVCkgPT4ge1xuICAgICAgYXN0LnNwYW4gPSB7XG4gICAgICAgIHN0YXJ0OiBuZXh0LnNwYW4uc3RhcnQsXG4gICAgICAgIGVuZDogdG9rZW5zW01hdGgubWluKHRva2Vucy5sZW5ndGgsIGlkeCktMV0/LnNwYW4uZW5kLFxuICAgICAgfVxuICAgICAgY29uc29sZS5sb2coYXN0LnNwYW4pXG4gICAgICByZXR1cm4gYXN0XG4gICAgfVxuXG5cbiAgICBsZXQgbWtlcnJvciA9IChtc2c6IHN0cmluZyk9PiBta3NwYW4oIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IG1zZywgY29udGVudDogXCJcIn0pKVxuXG5cbiAgICBzd2l0Y2gobmV4dC50eXBlKXtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjogcmV0dXJuIG1rQXN0KFwibnVtYmVyXCIsIG5leHQudmFsdWUsIG5leHQuc3BhbilcbiAgICAgIGNhc2UgXCJpZGVudFwiOiByZXR1cm4gbWtBc3QoXCJ2YXJcIiwge25hbWU6IG5leHQudmFsdWV9LCBuZXh0LnNwYW4pXG4gICAgICBjYXNlIFwic3RyaW5nXCI6IHJldHVybiBta0FzdChcInN0cmluZ1wiLCBuZXh0LnZhbHVlLCBuZXh0LnNwYW4pXG4gICAgICBjYXNlIFwic3ltYm9sXCI6IHtcbiAgICAgICAgaWYgKG5leHQudmFsdWUgPT09IFwiKFwiKXtcbiAgICAgICAgICBsZXQgaXRlbXM6IEFTVFtdID0gW11cbiAgICAgICAgICB3aGlsZSghbmV4dElzKFwic3ltYm9sXCIsIFwiKVwiKSl7XG4gICAgICAgICAgICBpZiAoIXBlZWsoKSkgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiVW50ZXJtaW5hdGVkIHBhcmVudGhlc2l6ZWQgZXhwcmVzc2lvblwiLCBjb250ZW50OiBjb2RlLnNsaWNlKG5leHQuc3Bhbi5zdGFydC5vZmZzZXQpfSwgbmV4dC5zcGFuKVxuICAgICAgICAgICAgaXRlbXMucHVzaChnbygpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBsZXQgY2xvc2UgPSB0YWtlKCkhXG4gICAgICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG1rQXN0KFwiZXJyb3JcIiwge21lc3NhZ2U6IFwiRW1wdHkgcGFyZW50aGVzZXMgYXJlIG5vdCBhbGxvd2VkXCIsIGNvbnRlbnQ6IGNvZGUuc2xpY2UobmV4dC5zcGFuLnN0YXJ0Lm9mZnNldCwgY2xvc2Uuc3Bhbi5lbmQub2Zmc2V0KX0sIHtzdGFydDogbmV4dC5zcGFuLnN0YXJ0LCBlbmQ6IGNsb3NlLnNwYW4uZW5kfSlcbiAgICAgICAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAxKSByZXR1cm4gaXRlbXNbMF1cbiAgICAgICAgICByZXR1cm4gbWtBc3QoXCJhcHBcIiwge2ZuOiBpdGVtc1swXSwgYXJnczogaXRlbXMuc2xpY2UoMSl9LCB7c3RhcnQ6IG5leHQuc3Bhbi5zdGFydCwgZW5kOiBjbG9zZS5zcGFuLmVuZH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgXG4gICAgICBjYXNlIFwia2V5d29yZFwiOiB7XG4gICAgICAgIGlmIChuZXh0LnZhbHVlID09PSBcImxldFwiKSB7XG5cbiAgICAgICAgICBsZXQgYmluZGVyIDogQVNUO1xuICAgICAgICAgIGxldCB2YWx1ZSA6IEFTVDtcbiAgICAgICAgICBsZXQgYm9keSA6IEFTVDtcblxuICAgICAgICAgIGJpbmRlciA9IGFzQmluZGVyKGdvKCkpO1xuXG4gICAgICAgICAgaWYgKGJpbmRlci4kID09IFwiZXJyb3JcIikgcmV0dXJuIGJpbmRlclxuXG4gICAgICAgICAgaWYgKCF0YWtlSXMgKFwic3ltYm9sXCIsIFwiPVwiKSkgcmV0dXJuIG1rZXJyb3IoXCJleHBlY3RlZCAoPSlcIilcbiAgICAgICAgICBcbiAgICAgICAgICB2YWx1ZSA9IGdvKClcbiAgICAgICAgICBpZiAoIXRha2VJcyhcImtleXdvcmRcIiAsIFwiaW5cIikpIHJldHVybiBta2Vycm9yKFwiZXhwZWN0ZWQgKGluKVwiKVxuICAgICAgICAgIFxuICAgICAgICAgIGJvZHkgPSBnbygpXG5cbiAgICAgICAgICByZXR1cm4gbWtzcGFuKG1rbGV0KGJpbmRlciwgdmFsdWUsIGJvZHkpKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHQudmFsdWUgPT09IFwiZm5cIikge1xuICAgICAgICAgIGxldCB2YXJzOiBWYXJbXSA9IFtdXG4gICAgICAgICAgd2hpbGUgKCF0YWtlSXMoXCJhcnJvd1wiKSl7XG4gICAgICAgICAgICBsZXQgYmluZGVyID0gZ28oKVxuICAgICAgICAgICAgaWYgKGJpbmRlci4kID09PSBcImVycm9yXCIpIHJldHVybiBta0FzdChcImZ1bmN0aW9uXCIsIHt2YXJzLCBib2R5OiBiaW5kZXJ9LCB7c3RhcnQ6IG5leHQuc3Bhbi5zdGFydCwgZW5kOiBiaW5kZXIuc3Bhbi5lbmR9KVxuICAgICAgICAgICAgZWxzZSBpZiAoYmluZGVyLiQgPT09IFwidmFyXCIpIHZhcnMucHVzaChiaW5kZXIpXG4gICAgICAgICAgICBlbHNlIGlmIChiaW5kZXIuJCA9PT0gXCJhcHBcIil7XG4gICAgICAgICAgICAgIGxldCB7Zm4sIGFyZ3N9ID0gYmluZGVyLmNvbnRlbnRcbiAgICAgICAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09IDEgJiYgYXJnc1swXS4kID09PSBcInZhclwiKXtcbiAgICAgICAgICAgICAgICBiaW5kZXIgPSBhcmdzWzBdXG4gICAgICAgICAgICAgICAgYmluZGVyLnR5cGUgPSBmblxuICAgICAgICAgICAgICAgIHZhcnMucHVzaChiaW5kZXIpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1lbHNlIHJldHVybiBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBcIkV4cGVjdGVkIGZ1bmN0aW9uIHBhcmFtZXRlclwiLCBjb250ZW50OiBjb2RlLnNsaWNlKGJpbmRlci5zcGFuLnN0YXJ0Lm9mZnNldCwgYmluZGVyLnNwYW4uZW5kLm9mZnNldCl9LCBiaW5kZXIuc3BhbilcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGJvZHkgPSBnbygpXG4gICAgICAgICAgcmV0dXJuIG1rQXN0KFwiZnVuY3Rpb25cIiwge3ZhcnMsIGJvZHl9LCB7c3RhcnQ6IG5leHQuc3Bhbi5zdGFydCwgZW5kOiBib2R5LnNwYW4uZW5kfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogYFVuZXhwZWN0ZWQgdG9rZW46ICR7bmV4dC50eXBlfSR7XCJ2YWx1ZVwiIGluIG5leHQgPyBgKCR7U3RyaW5nKG5leHQudmFsdWUpfSlgIDogXCJcIn1gLCBjb250ZW50OiBjb2RlLnNsaWNlKG5leHQuc3Bhbi5zdGFydC5vZmZzZXQsIG5leHQuc3Bhbi5lbmQub2Zmc2V0KX0sIG5leHQuc3BhbilcbiAgfVxuXG4gIGxldCBhc3QgPSBnbygpXG4gIC8vIGlmIChwZWVrKCkpIHtcbiAgLy8gICBsZXQgbmV4dCA9IHBlZWsoKSFcbiAgLy8gICBhc3QgPSBta0FzdChcImVycm9yXCIsIHttZXNzYWdlOiBgVW5leHBlY3RlZCBleHRyYSBpbnB1dCBhZnRlciBleHByZXNzaW9uOiAke25leHQudHlwZX0keyBKU09OLnN0cmluZ2lmeShuZXh0KX1gLCBjb250ZW50OiBjb2RlLnNsaWNlKG5leHQuc3Bhbi5zdGFydC5vZmZzZXQsIG5leHQuc3Bhbi5lbmQub2Zmc2V0KX0sIHtzdGFydDogYXN0LnNwYW4uc3RhcnQsIGVuZDogbmV4dC5zcGFuLmVuZH0pXG4gIC8vIH1cblxuICByZXR1cm4ge2FzdCwgY29tbWVudHM6IHRva2VuaXplZC5jb21tZW50c31cblxufVxuXG5cblxuZXhwb3J0IGNvbnN0IHBhcnNlQVNUID0gKGNvZGU6c3RyaW5nKTogQVNUID0+IHBhcnNlKGNvZGUpLmFzdFxuXG5cblxuZXhwb3J0IGNvbnN0IHByZXR0eUFTVCA9IChub2RlOiBBU1QpOiBzdHJpbmcgPT57XG4gIHN3aXRjaChub2RlLiQpe1xuICAgIGNhc2UgXCJudW1iZXJcIiA6IHJldHVybiBub2RlLmNvbnRlbnQudG9TdHJpbmcoKVxuICAgIGNhc2UgXCJzdHJpbmdcIiA6IHJldHVybiBKU09OLnN0cmluZ2lmeShub2RlLmNvbnRlbnQpXG4gICAgY2FzZSBcInZhclwiOiByZXR1cm4gbm9kZS5jb250ZW50Lm5hbWVcbiAgICBjYXNlIFwibGV0XCI6IHJldHVybiBgbGV0ICR7cHJldHR5QmluZGVyKG5vZGUuY29udGVudC52YXIpfSA9ICR7cHJldHR5QVNUKG5vZGUuY29udGVudC52YWx1ZSl9IGluXFxuJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmJvZHkpfWBcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjogcmV0dXJuIGBmbiAke25vZGUuY29udGVudC52YXJzLm1hcChwcmV0dHlCaW5kZXIpLmpvaW4oXCIgXCIpfSA9PiAke3ByZXR0eUFTVChub2RlLmNvbnRlbnQuYm9keSl9YFxuICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGAoJHtwcmV0dHlBU1Qobm9kZS5jb250ZW50LmZuKX0gJHtub2RlLmNvbnRlbnQuYXJncy5tYXAocHJldHR5QVNUKS5qb2luKFwiIFwiKX0pYFxuICAgIGNhc2UgXCJyZWNvcmRcIjogcmV0dXJuIGB7JHtub2RlLmNvbnRlbnQubWFwKChbaywgdl0pID0+IGAke2suY29udGVudC5uYW1lfTogJHtwcmV0dHlBU1Qodil9YCkuam9pbihcIiwgXCIpfX1gXG4gICAgY2FzZSBcImVycm9yXCI6IHJldHVybiBgW0VSUk9SOiAke25vZGUuY29udGVudC5tZXNzYWdlfV1gXG4gIH1cbn1cblxuY29uc3QgaGFzU2hvd25UeXBlID0gKHY6IFZhcikgPT4gdi50eXBlICYmICEodi50eXBlLiQgPT09IFwidmFyXCIgJiYgdi50eXBlLmNvbnRlbnQubmFtZSA9PT0gXCJhbnlcIilcbmNvbnN0IHByZXR0eUJpbmRlciA9ICh2OiBWYXIpOiBzdHJpbmcgPT4gaGFzU2hvd25UeXBlKHYpID8gYCgke3ByZXR0eUFTVCh2LnR5cGUhKX0gJHt2LmNvbnRlbnQubmFtZX0pYCA6IHYuY29udGVudC5uYW1lXG5cblxuXG5sZXQgc3RyaW5naWZ5ID0gKHg6IHVua25vd24pID0+IEpTT04uc3RyaW5naWZ5KHgsIG51bGwsIDIpXG5cbmNvbnN0IHRlc3RfcGFyc2UgPSAoY29kZTogc3RyaW5nLCBleHBlY3RlZDogQVNUKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuXG4gIGxldCBBID0gcHJldHR5QVNUKGFzdClcbiAgbGV0IEIgPSBwcmV0dHlBU1QoZXhwZWN0ZWQpXG5cbiAgaWYgKEEgIT09IEIpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXhwZWN0ZWQ6XCIsIEIpXG4gICAgY29uc29sZS5lcnJvcihcIkdvdDogICAgIFwiLCBBKVxuICAgIHRocm93IG5ldyBFcnJvcihgVGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmNvbnN0IHRlc3Rfc3BhbiA9IChjb2RlOiBzdHJpbmcsIGV4cGVjdGVkOiBTcGFuKSA9PiB7XG4gIGxldCBhc3QgPSBwYXJzZUFTVChjb2RlKVxuICBpZiAoSlNPTi5zdHJpbmdpZnkoYXN0LnNwYW4pICE9PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZCkpIHtcblxuICAgIGNvbnNvbGUuZXJyb3IoXCJFeHBlY3RlZDpcIiwgZXhwZWN0ZWQpXG4gICAgY29uc29sZS5lcnJvcihcIkdvdDogICAgIFwiLCBhc3Quc3BhbilcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFNwYW4gdGVzdCBmYWlsZWQgZm9yIGNvZGU6ICR7Y29kZX1gKVxuICB9XG59XG5cbmV4cG9ydCBsZXQgbWtudW0gPSAobjogbnVtYmVyKSA9PiBta0FzdChcIm51bWJlclwiLCBuKVxuZXhwb3J0IGxldCBta3N0ciA9IChzOiBzdHJpbmcpID0+IG1rQXN0KFwic3RyaW5nXCIsIHMpXG5leHBvcnQgbGV0IG1rdmFyID0gKG5hbWU6IHN0cmluZykgPT4gbWtBc3QoXCJ2YXJcIiwge25hbWV9KVxuZXhwb3J0IGxldCBta2FwcCA9IChmbjogQVNULCBhcmdzOiBBU1RbXSkgPT4gbWtBc3QoXCJhcHBcIiwge2ZuLCBhcmdzfSlcbmV4cG9ydCBsZXQgbWtsZXQgPSAodjogc3RyaW5nIHwgVmFyLCB2YWx1ZTogQVNULCBib2R5OiBBU1QpID0+IG1rQXN0KFwibGV0XCIsIHt2YXI6IHR5cGVvZiB2ID09PSBcInN0cmluZ1wiID8gbWt2YXIodikgOiB2LCB2YWx1ZSwgYm9keX0pXG5leHBvcnQgbGV0IG1rZnVuID0gKHZhcnM6IChzdHJpbmcgfCBWYXIpW10sIGJvZHk6IEFTVCkgPT4gbWtBc3QoXCJmdW5jdGlvblwiLCB7dmFyczogdmFycy5tYXAodiA9PiB0eXBlb2YgdiA9PT0gXCJzdHJpbmdcIiA/IG1rdmFyKHYpIDogdiksIGJvZHl9KSBhcyBGdW5jXG5leHBvcnQgbGV0IGFubm90ID0gKHR5cGU6IEFTVCwgdmFsdWU6IEFTVCkgPT4gbWtBc3QoXCJhbm5vdFwiLCB7dHlwZSwgdmFsdWV9KVxuLy8gZXhwb3J0IGxldCBta3JlY29yZCA9IChmaWVsZHM6IHtba2V5IDogc3RyaW5nXSA6IEFTVH0pID0+IG1rQXN0KFwicmVjb3JkXCIsIE9iamVjdC5lbnRyaWVzKGZpZWxkcykubWFwKChbayx2XSk9PiBbbWt2YXIoayksIHZdKSlcblxuT2JqZWN0LmVudHJpZXMoe1xuICBcInhcIjogbWt2YXIoXCJ4XCIpLFxuICBcIjIyXCI6IG1rbnVtKDIyKSxcbiAgJ1wiaGVsbG9cIic6IG1rc3RyKFwiaGVsbG9cIiksXG4gIFwiKGYgeClcIjogbWthcHAobWt2YXIoXCJmXCIpLCBbbWt2YXIoXCJ4XCIpXSksXG4gIFwiKGYgeCB5KVwiOiBta2FwcChta3ZhcihcImZcIiksIFtta3ZhcihcInhcIiksIG1rdmFyKFwieVwiKV0pLFxuICBcImxldCBpeCA9IDIyIGluIGl4XCI6IG1rbGV0KFwiaXhcIiwgbWtudW0oMjIpLCBta3ZhcihcIml4XCIpKSxcbiAgXCJmbiB4ID0+IHhcIjogbWtmdW4oW1wieFwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJsZXQgdSA9IDQgaW4gbGV0IHYgPSA1IGluIHVcIjogbWtsZXQoXCJ1XCIsIG1rbnVtKDQpLCBta2xldChcInZcIiwgbWtudW0oNSksIG1rdmFyKFwidVwiKSkpLFxuICBcImxldCAobnVtYmVyIHgpID0gMjIgaW4geFwiOiBta2xldChPYmplY3QuYXNzaWduKG1rdmFyKFwieFwiKSwge3R5cGU6IG1rdmFyKFwibnVtYmVyXCIpfSksIG1rbnVtKDIyKSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiB4IHkgPT4geFwiOiBta2Z1bihbXCJ4XCIsIFwieVwiXSwgbWt2YXIoXCJ4XCIpKSxcbiAgXCJmbiAobnVtYmVyIHgpID0+IHhcIjogbWtmdW4oW09iamVjdC5hc3NpZ24obWt2YXIoXCJ4XCIpLCB7dHlwZTogbWt2YXIoXCJudW1iZXJcIil9KV0sIG1rdmFyKFwieFwiKSksXG5cblxufSkuZm9yRWFjaCgoW2NvZGUsIGV4cGVjdGVkXSkgPT4gdGVzdF9wYXJzZShjb2RlLCBleHBlY3RlZCBhcyBBU1QpKVxuXG50ZXN0X3NwYW4oXCJsZXQgeCA9IDIyXFxuaW4geFwiLCB7XG4gIHN0YXJ0OiB7b2Zmc2V0OiAwLCBsaW5lOiAxLCBjb2w6IDF9LFxuICBlbmQ6IHtvZmZzZXQ6IDE1LCBsaW5lOiAyLCBjb2w6IDV9LFxufSlcbiIsCiAgICAiaW1wb3J0IHsgQVNULCBWYXIgfSBmcm9tIFwiLi9wYXJzZXJcIlxuaW1wb3J0IHtjaGlsZHJlbn0gZnJvbSBcIi4vcGFyc2VyXCJcblxuXG5leHBvcnQgY29uc3QgZ2V0ZGVmID0gKHJvb3Q6IEFTVCwgdmFyaTogVmFyKTogQVNUIHwgdW5kZWZpbmVkID0+IHtcbiAgaWYgKHJvb3Quc3Bhbi5zdGFydC5vZmZzZXQgPiB2YXJpLnNwYW4uc3RhcnQub2Zmc2V0IHx8IHJvb3Quc3Bhbi5lbmQub2Zmc2V0IDwgdmFyaS5zcGFuLmVuZC5vZmZzZXQpIHJldHVybiB1bmRlZmluZWRcbiAgZm9yIChsZXQgY2hpbGQgb2YgY2hpbGRyZW4ocm9vdCkpe1xuICAgIGxldCByZXMgPSBnZXRkZWYoY2hpbGQsIHZhcmkpXG4gICAgaWYgKHJlcykgcmV0dXJuIHJlc1xuICB9XG5cbiAgaWYgKHJvb3QuJCA9PT0gXCJsZXRcIiAmJiByb290LmNvbnRlbnQudmFyLmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgcmV0dXJuIHJvb3QuY29udGVudC52YXJcblxuICBpZiAocm9vdC4kID09PSBcImZ1bmN0aW9uXCIpXG4gICAgZm9yIChsZXQgdiBvZiByb290LmNvbnRlbnQudmFycylcbiAgICAgIGlmICh2LmNvbnRlbnQubmFtZSA9PT0gdmFyaS5jb250ZW50Lm5hbWUpXG4gICAgICAgIHJldHVybiB2XG59XG4iLAogICAgImltcG9ydCB7IGNvbG9yT2YgfSBmcm9tIFwiLi9lZGl0b3JcIlxuaW1wb3J0IHsgYm9keSwgY29sb3IsIGRpdiwgTk9ERSwgcHJlLCBzcGFuIH0gZnJvbSBcIi4vaHRtbFwiXG5pbXBvcnQge21rbnVtLCBQcmltLCBUYWcsIHR5cGUgQVNULCB0eXBlIEZ1bmMsIHBhcnNlLCBta3ZhciwgbWthcHAsIFZhciwgbWtBc3QsIG1rZnVuLCBFcnJvck5vZGUsIHByZXR0eUFTVH0gZnJvbSBcIi4vcGFyc2VyXCJcblxuZXhwb3J0IGxldCBOVU1CRVIgPSBta3ZhcihcIm51bWJlclwiKVxuZXhwb3J0IGxldCBTVFJJTkcgPSBta3ZhcihcInN0cmluZ1wiKVxuZXhwb3J0IGxldCBUWVBFICAgPSBta3ZhcihcInR5cGVcIilcbmV4cG9ydCBsZXQgVFlQRU9GID0gbWt2YXIoXCJ0eXBlb2ZcIilcblxuTlVNQkVSLnR5cGUgPSBUWVBFXG5TVFJJTkcudHlwZSA9IFRZUEVcblRZUEUudHlwZSA9IFRZUEVcblRZUEVPRi50eXBlID0gcGFyc2UoXCJmbiBmID0+IGZuIHggPT4gdHlwZVwiKS5hc3QhXG5cbmV4cG9ydCBsZXQgQU5ZIDogQVNUID0gbWt2YXIoXCJhbnlcIilcblxubGV0IHByaW1pdGl2ZVR5cGUgPSAobmFtZTogc3RyaW5nKSA9PiAoe1xuICB0eXBlOiBUWVBFLFxuICBpbXBsOiAoeDogVmFsdWUpID0+IHtcbiAgICBpZiAoeC50eXBlKSB7XG4gICAgICBpZiAoeC50eXBlLiQgPT0gXCJ2YXJcIiAmJiB4LnR5cGUuY29udGVudC5uYW1lID09IG5hbWUpIHJldHVybiB4XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3I6IGV4cGVjdGVkICR7bmFtZX0sIGdvdCAkeyh4LnR5cGUpfWApXG4gICAgfVxuICAgIHgudHlwZSA9IG1rdmFyKG5hbWUpXG4gICAgcmV0dXJuIHhcbiAgfVxufSlcblxuXG5cbmNvbnN0IGJ1aWx0aW5LZXlzID0gW1wibnVtYmVyXCIsIFwic3RyaW5nXCIsIFwiZXFcIiwgXCJhZGRcIiwgXCJpZmVsc2VcIiwgXCJ0eXBlb2ZcIiwgXCJ0eXBlXCJdIGFzIGNvbnN0XG50eXBlIEJ1aWx0aW5LZXkgPSB0eXBlb2YgYnVpbHRpbktleXNbbnVtYmVyXVxuXG5sZXQgYnVpbHRpbnM6IFJlY29yZDxCdWlsdGluS2V5LCB7IHR5cGU6IEFTVCwgaW1wbDogKC4uLmFyZ3M6VmFsdWVbXSkgPT4gVmFsdWUgfT4gPSB7XG4gIG51bWJlcjogcHJpbWl0aXZlVHlwZShcIm51bWJlclwiKSxcbiAgc3RyaW5nOiBwcmltaXRpdmVUeXBlKFwic3RyaW5nXCIpLFxuICBcInR5cGVcIjoge1xuICAgIHR5cGU6IFRZUEUsXG4gICAgaW1wbDogKHg6IFZhbHVlKSA9PiB7XG4gICAgICBpZiAoeC50eXBlID09IFRZUEUpIHJldHVybiB4XG4gICAgICBpZiAoeCA9PSBOVU1CRVIgfHwgeCA9PSBTVFJJTkcpIHJldHVybiB4XG4gICAgICBpZiAoeC4kICE9IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IEVycm9yKGBUeXBlIGVycm9yOiBleHBlY3RlZCBhIHR5cGUsIGdvdCAke3ByZXR0eUFTVCh4KX1gKVxuICAgICAgbGV0IHt2YXJzLCBib2R5fSA9IHguY29udGVudFxuICAgICAgaWYgKHZhcnMubGVuZ3RoICE9IDEpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgZnVuY3Rpb24gVHlwZSB3aXRoIDEgYXJndW1lbnQsIGdvdCAke3ZhcnMubGVuZ3RofWApXG4gICAgICBpZiAoYm9keS4kICE9IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBmdW5jdGlvbiBUeXBlLCBnb3QgJHtib2R5LiR9YClcbiAgICAgIHJldHVybiB4XG4gICAgfVxuXG4gIH0sXG4gIGVxOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmID0+IGZuIHggeSA9PiAobnVtYmVyIChmIHggeSkpXCIpLmFzdCEsXG4gICAgaW1wbDogKHgseSkgPT4gbWtudW0oXG4gICAgICAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIgJiYgeC5jb250ZW50ID09IHkuY29udGVudCkgfHxcbiAgICAgICh4LiQgPT0gXCJzdHJpbmdcIiAmJiB5LiQgPT0gXCJzdHJpbmdcIiAmJiB4LmNvbnRlbnQgPT0geS5jb250ZW50KSB8fCAoeCA9PSB5KVxuICAgICAgPyAxIDogMClcbiAgfSxcbiAgYWRkOiB7XG4gICAgdHlwZTogcGFyc2UoXCJmbiBmPT4gZm4geCB5ID0+IChudW1iZXIgKGYgKG51bWJlciB4KSAobnVtYmVyIHkpKSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCx5KSA9PiB7XG4gICAgICBpZiAoeC4kID09IFwibnVtYmVyXCIgJiYgeS4kID09IFwibnVtYmVyXCIpIHJldHVybiBta251bSh4LmNvbnRlbnQgKyB5LmNvbnRlbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGUgZXJyb3IgaW4gYWRkOiBleHBlY3RlZCBudW1iZXJzLCBnb3QgJHtwcmV0dHlBU1QoeCl9IGFuZCAke3ByZXR0eUFTVCh5KX1gKVxuICAgIH1cbiAgfSxcbiAgaWZlbHNlIDoge1xuICAgIHR5cGU6IHBhcnNlKFwiZm4gZiA9PiBmbiBUIGNvbmQgdGhlbiBlbHNlID0+IChUIChmIChudW1iZXIgY29uZCkgKFQgdGhlbikgKFQgZWxzZSkpKVwiKS5hc3QhLFxuICAgIGltcGw6IChjb25kLCB0aGVuLCBlbHMpID0+IHtcbiAgICAgIGxldCB2YWwgPSBjb25kLiQgPT0gXCJudW1iZXJcIiA/IGNvbmQuY29udGVudCA6IGNvbmQuJCA9PSBcInN0cmluZ1wiID8gY29uZC5jb250ZW50Lmxlbmd0aCA6IDFcbiAgICAgIHJldHVybiB2YWwgPyB0aGVuIDogZWxzXG4gICAgfVxuICB9LFxuICB0eXBlb2Y6IHtcbiAgICB0eXBlOiBwYXJzZShcImZuIGYgPT4gZm4geCA9PiAodHlwZSAoZiB4KSlcIikuYXN0ISxcbiAgICBpbXBsOiAoeCA6IFZhbHVlKSA6IFZhbHVlID0+IHtcbiAgICAgIGlmICgheC50eXBlKSByZXR1cm4gbWtBc3QoXCJhcHBcIiwge2ZuOiBUWVBFT0YsIGFyZ3M6IFt4XX0pXG4gICAgICByZXR1cm4gZXZhbHVhdGUoeC50eXBlLCB7fSlcbiAgICB9XG4gIH1cbn1cblxubGV0IERFQlVHID0gMFxubGV0IGxvZ2dlclByZSA9IHByZSgpXG5ib2R5LnJlcGxhY2VDaGlscmVuKGxvZ2dlclByZSlcblxuXG50eXBlIFZpcyA9IE5PREUgfCBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsIHwgQVNUIHwgVmFsdWUgfCBWaXNbXSB8IG51bWJlclxuXG5sZXQgZGVidWcgPSAoLi4uYXJnczogVmlzW10pID0+IHtcbiAgaWYgKCFERUJVRykgcmV0dXJuXG4gIGxldCBwciA9IGxvZ2dlclByZVxuICBmb3IgKGxldCBhcmcgb2YgYXJncyl7XG4gICAgaWYgKHR5cGVvZiBhcmcgPT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgYXJnID09IFwibnVtYmVyXCIpIHByLmFwcGVuZChTdHJpbmcoYXJnKSlcbiAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KGFyZykpIFtcIltcIiwgLi4uYXJnLCBcIl1cIl0uZm9yRWFjaChhPT4gZGVidWcoYSkpXG4gICAgZWxzZSBpZiAoYXJnID09PSB1bmRlZmluZWQgfHwgYXJnID09PSBudWxsKSBwci5hcHBlbmQoc3BhbihTdHJpbmcoYXJnKSkuc3R5bGUoe2NvbG9yOiBjb2xvci5ncmF5fSkpXG4gICAgZWxzZSBpZiAoXCIkXCIgaW4gYXJnKXtcbiAgICAgIGlmIChhcmcuJCA9PSBcIk5PREVcIikgcHIuYXBwZW5kKGFyZylcbiAgICAgIGVsc2UgcHIuYXBwZW5kKGFzdFZpZXcoYXJnKSlcbiAgICB9XG4gIH1cbiAgcHIuYXBwZW5kKFwiXFxuXCIpXG59XG5cbmxldCBkZWJ1Z0NhbGwgPSA8QVJHUyBleHRlbmRzIGFueVtdLCBUPiAoZm46ICguLi5hcmdzOiBBUkdTKSA9PiBUKSA9PiAoLi4uYXJnczogQVJHUykgOiBUID0+IHtcbiAgaWYgKCFERUJVRykgcmV0dXJuIGZuKC4uLmFyZ3MpXG4gIGNvbnNvbGUubG9nKFwiREVCVUdcIiwgZm4ubmFtZSlcbiAgZGVidWcoXCJAIFwiLCBmbi5uYW1lLCAuLi5hcmdzKVxuICBsZXQgb2xkcHJlID0gbG9nZ2VyUHJlXG4gIGxldCBjYWxscHJlID0gcHJlKCkuc3R5bGUoe2JvcmRlckxlZnQ6IFwiNHB4IHNvbGlkIFwiK2NvbG9yLmdyYXksIG1hcmdpbkxlZnQ6IFwiOHB4XCIsIHBhZGRpbmdMZWZ0OiBcIjhweFwifSlcbiAgbG9nZ2VyUHJlLmFwcGVuZChjYWxscHJlKVxuICBsb2dnZXJQcmUgPSBjYWxscHJlXG4gIGxldCByZXMgPSBmbiguLi5hcmdzKVxuICBsb2dnZXJQcmUgPSBvbGRwcmVcbiAgZGVidWcocmVzIGFzIGFueSlcbiAgcmV0dXJuIHJlc1xufVxuXG5cbmxldCBhc3RWaWV3ID0gKGFzdDogQVNUIHwgVmFsdWUpOiBOT0RFID0+IHtcbiAgbGV0IF92aWV3ID0gKGFzdDogQVNUIHwgVmFsdWUpOiBOT0RFID0+IHtcbiAgICBsZXQgZWwgPSBzcGFuKClcbiAgICBzd2l0Y2goYXN0LiQpe1xuICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gZWwuYXBwZW5kKFN0cmluZyhhc3QuY29udGVudCkpLnN0eWxlKHtjb2xvcjogY29sb3IuYmx1ZX0pICBcbiAgICAgIGNhc2UgXCJ2YXJcIjogcmV0dXJuIGVsLmFwcGVuZChhc3QuY29udGVudC5uYW1lKVxuICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6IHJldHVybiBlbC5hcHBlbmQoIFwiZm4gXCIsLi4uYXN0LmNvbnRlbnQudmFycy5tYXAoeD0+e1xuICAgICAgICBpZiAoeC50eXBlKSByZXR1cm4gZ28obWthcHAoeC50eXBlLCBbeF0pKVxuICAgICAgICByZXR1cm4gZ28oeClcbiAgICAgIH0pLFwiID0+IFwiKS5hcHBlbmQoZ28oYXN0LmNvbnRlbnQuYm9keSkpXG4gICAgICBjYXNlIFwiYXBwXCI6IHJldHVybiBlbC5hcHBlbmQoXCIoXCIsIGdvKGFzdC5jb250ZW50LmZuKSwgXCIgXCIsIC4uLmFzdC5jb250ZW50LmFyZ3MubWFwKGFyZz0+Z28oYXJnKSksIFwiKVwiKVxuICAgICAgY2FzZSBcImxldFwiOiByZXR1cm4gZWwuYXBwZW5kKFwibGV0IFwiLCBhc3QuY29udGVudC52YXIuY29udGVudC5uYW1lLCBcIiA9IFwiLCBnbyhhc3QuY29udGVudC52YWx1ZSksIFwiIGluIFwiLCBnbyhhc3QuY29udGVudC5ib2R5KSlcbiAgICAgIGRlZmF1bHQ6IHJldHVybiBlbC5hcHBlbmQoYFske2FzdC4kfV1gKVxuICAgIH0gIFxuICB9XG4gIGxldCBnbyA9IChhc3Q6QVNUfFZhbHVlKTogTk9ERSA9PiB7XG4gICAgbGV0IGVsID0gc3Bhbihfdmlldyhhc3QpKS5zdHlsZSh7Y29sb3I6IGNvbG9yT2YoYXN0KSwgY3Vyc29yOiBcInBvaW50ZXJcIn0pXG4gICAgLm9uY2xpY2soZT0+e1xuICAgICAgZWwucmVwbGFjZUNoaWxyZW4oXG4gICAgICAgIHNwYW4oXCJUWVBFOlwiKS5zdHlsZSh7Y29sb3I6IGNvbG9yLmdyYXl9KVxuICAgICAgICAub25jbGljayhlPT57XG4gICAgICAgICAgZWwucmVwbGFjZUNoaWxyZW4oX3ZpZXcoYXN0KSlcbiAgICAgICAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG4gICAgICAgIH0pLFxuICAgICAgICBhc3QudHlwZSA/IGFzdFZpZXcoYXN0LnR5cGUpIDogXCIqXCIsXG4gICAgICAgIGdvKGFzdClcbiAgICAgIClcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICB9KVxuICAgIHJldHVybiBlbFxuICB9XG4gIHJldHVybiBkaXYoZ28oYXN0KSkuc3R5bGUoe3BhZGRpbmc6XCIuNGVtXCIsIGJvcmRlcjogXCIxcHggc29saWQgXCIrY29sb3IuZ3JheSwgYm9yZGVyUmFkaXVzOiBcIi40ZW1cIiwgbWFyZ2luOlwiLjRlbSAwXCJ9KVxufVxuXG5cblxudHlwZSBOZXV0cmFsID0gVmFyIHwgUHJpbSB8IFRhZzxcImFwcFwiLCB7Zm46IE5ldXRyYWwsIGFyZ3M6IFZhbHVlW119PiB8IEVycm9yTm9kZVxudHlwZSBWYWx1ZSA9IFRhZzxcImZ1bmN0aW9uXCIsIHtlbnY6IEVudiwgdmFyczogVmFyW10sIGJvZHk6IEFTVH0+IHwgTmV1dHJhbFxudHlwZSBFbnYgPSBSZWNvcmQ8c3RyaW5nLCB7YmluZGVyOiBWYXIsIHZhbDpWYWx1ZX0+XG5cbmxldCBhbm5vdCA9ICA8VCBleHRlbmRzIFZhbHVlIHwgQVNUPiAodGVybTpULCB0eXBlOiBBU1QgfCB1bmRlZmluZWQpIDpUID0+IHtcbiAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHRlcm1cbiAgaWYgKHRlcm0udHlwZSAhPT0gdW5kZWZpbmVkICYmIHByZXR0eUFTVCh0ZXJtLnR5cGUpICE9PSBwcmV0dHlBU1QodHlwZSkpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtwcmV0dHlBU1QodHlwZSl9LCBnb3QgJHtwcmV0dHlBU1QodGVybS50eXBlKX1gKVxuICB0ZXJtLnR5cGUgPSB0eXBlXG4gIHJldHVybiB0ZXJtXG59XG5cblxuXG5cbmxldCBldmFsdWF0ZSA9ICh0ZXJtOkFTVCwgZW52OiBFbnYgPSB7fSk6VmFsdWUgPT4ge1xuXG4gIGxldCBnbyA9ICh0ZXJtOkFTVCwgZW52OiBFbnYpOiBWYWx1ZSA9PiB7XG4gICAgc3dpdGNoICh0ZXJtLiQpIHtcbiAgICAgIGNhc2UgXCJlcnJvclwiOiByZXR1cm4gdGVybVxuICAgICAgY2FzZSBcInZhclwiOiB7XG4gICAgICAgIGlmIChlbnZbdGVybS5jb250ZW50Lm5hbWVdKSByZXR1cm4gZW52W3Rlcm0uY29udGVudC5uYW1lXS52YWxcbiAgICAgICAgcmV0dXJuIHRlcm1cbiAgICAgIH1cbiAgICAgIGNhc2UgXCJmdW5jdGlvblwiOiByZXR1cm4gbWtBc3QoXCJmdW5jdGlvblwiLCB7XG4gICAgICAgIHZhcnM6IHRlcm0uY29udGVudC52YXJzLFxuICAgICAgICBib2R5OiB0ZXJtLmNvbnRlbnQuYm9keSxcbiAgICAgICAgZW52XG4gICAgICB9KSBcbiAgICAgIGNhc2UgXCJhcHBcIjogcmV0dXJuIGFwcGx5KFxuICAgICAgICBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQuZm4sIGVudiksXG4gICAgICAgIHRlcm0uY29udGVudC5hcmdzLm1hcChhcmcgPT4gZXZhbHVhdGUoYXJnLCBlbnYpKVxuICAgICAgKVxuICAgICAgY2FzZSBcImxldFwiOntcbiAgICAgICAgbGV0IHZhbDogVmFsdWU7XG4gICAgICAgIHRyeXtcbiAgICAgICAgICB2YWwgPSBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQudmFsdWUsIGVudik7XG4gICAgICAgIH1jYXRjaChlKXtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICAgICAgdmFsID0gbWtBc3QoXCJlcnJvclwiLCB7bWVzc2FnZTogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpLCBjb250ZW50OiBcIlwifSlcbiAgICAgICAgICB2YWwuc3BhbiA9IHRlcm0uY29udGVudC52YWx1ZS5zcGFuXG4gICAgICAgICAgdGVybS5jb250ZW50LnZhbHVlID0gdmFsXG4gICAgICAgICAgcmV0dXJuIGV2YWx1YXRlKHRlcm0uY29udGVudC5ib2R5LCBlbnYpXG4gICAgICAgIH1cbiAgICAgICAgYW5ub3QodGVybS5jb250ZW50LnZhciwgdmFsLnR5cGUpXG4gICAgICAgIHJldHVybiBldmFsdWF0ZSh0ZXJtLmNvbnRlbnQuYm9keSwgey4uLmVudiwgW3Rlcm0uY29udGVudC52YXIuY29udGVudC5uYW1lXToge2JpbmRlcjogdGVybS5jb250ZW50LnZhciwgdmFsLH19KVxuICAgICAgfVxuICAgICAgY2FzZSBcIm51bWJlclwiOiByZXR1cm4gYW5ub3QodGVybSwgTlVNQkVSKVxuICAgICAgY2FzZSBcInN0cmluZ1wiOiByZXR1cm4gdGVybVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBldmFsdWF0ZSB0ZXJtIG9mIHR5cGUgJHt0ZXJtLiR9YClcbiAgfVxuXG4gIGxldCByZXMgPSBnbyh0ZXJtLCBlbnYpXG4gIGFubm90KHRlcm0sIHJlcy50eXBlKVxuICByZXR1cm4gcmVzXG5cblxufVxuZXZhbHVhdGUgPSBkZWJ1Z0NhbGwoZXZhbHVhdGUpXG5cbmNvbnN0IGFwcGx5ID0gKGZuOiBWYWx1ZSwgYXJnczogVmFsdWVbXSk6IFZhbHVlID0+IHtcbiAgaWYgKGZuLiQgPT0gXCJmdW5jdGlvblwiKXtcbiAgICBpZiAoZm4uY29udGVudC52YXJzLmxlbmd0aCAhPSBhcmdzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2ZuLmNvbnRlbnQudmFycy5sZW5ndGh9IGFyZ3VtZW50cywgZ290ICR7YXJncy5sZW5ndGh9YClcbiAgICBsZXQgZW52ID0gey4uLmZuLmNvbnRlbnQuZW52fVxuICAgIGZuLmNvbnRlbnQudmFycy5mb3JFYWNoKChiaW5kZXIsaSk9PiBlbnZbYmluZGVyLmNvbnRlbnQubmFtZV0gPSB7IGJpbmRlciwgdmFsOiBhcmdzW2ldfSlcbiAgICByZXR1cm4gZXZhbHVhdGUoZm4uY29udGVudC5ib2R5LCBlbnYpXG4gIH1cbiAgXG4gIGlmIChmbi4kID09IFwidmFyXCIpe1xuICAgIGxldCBuYW1lID0gZm4uY29udGVudC5uYW1lXG4gICAgaWYgKGJ1aWx0aW5zW25hbWUgYXMgQnVpbHRpbktleV0pIHJldHVybiBidWlsdGluc1tuYW1lIGFzIEJ1aWx0aW5LZXldLmltcGwoLi4uYXJncylcbiAgfVxuXG4gIGxldCByZXMgOiBWYWx1ZSA9IG1rQXN0KFwiYXBwXCIsIHtmbiwgYXJnc30pXG4gIHJldHVybiByZXNcbn1cblxubGV0IGNvdW50ZXIgPSAwO1xuXG5sZXQgcmVhZGJhY2sgPSAodmFsOiBWYWx1ZSk6IEFTVCA9PiB7XG4gIGlmICh2YWwuJCA9PSBcImZ1bmN0aW9uXCIpe1xuICAgIGxldCB2YXJzID0gdmFsLmNvbnRlbnQudmFycy5tYXAoeD0+IGFubm90KG1rdmFyKHguY29udGVudC5uYW1lICsgXCJfXCIgKyBjb3VudGVyKyspLCB4LnR5cGUpKVxuICAgIHJldHVybiBta2Z1bih2YXJzLCByZWFkYmFjayhhcHBseSh2YWwsIHZhcnMpKSlcbiAgfVxuICBpZiAodmFsLiQgPT0gXCJhcHBcIikgcmV0dXJuIG1rYXBwKHJlYWRiYWNrKHZhbC5jb250ZW50LmZuKSwgdmFsLmNvbnRlbnQuYXJncy5tYXAocmVhZGJhY2spKVxuICByZXR1cm4gdmFsXG59XG5cbnJlYWRiYWNrID0gZGVidWdDYWxsKHJlYWRiYWNrKVxuXG5leHBvcnQgY29uc3QgcnVuID0gKGFzdDogQVNUKSA9PiB7XG4gIGNvdW50ZXIgPTBcbiAgcmV0dXJuIHJlYWRiYWNrKGV2YWx1YXRlKGFzdCwge30pKVxufVxuXG4iLAogICAgIlxuXG5cblxuaW1wb3J0IHsgYm9keSwgaHRtbCwgc3BhbiAsIGZyb21IVE1MLCBoMiwgZGl2fSBmcm9tIFwiLi9odG1sXCI7XG5pbXBvcnQgeyBlZGl0b3IgfSBmcm9tIFwiLi9lZGl0b3JcIjtcbmltcG9ydCB7IGJ1aWxkQXN0TWFwLCBwYXJzZSwgdHlwZSBBU1QsIHR5cGUgU3BhbiwgdHlwZSBTeW50YXhOb2RlLCBwcmV0dHlBU1R9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgZ2V0ZGVmIH0gZnJvbSBcIi4vbHNwXCJcbmltcG9ydCB7IEFOWSwgcnVuIH0gZnJvbSBcIi4vcnVudGltZVwiXG5pbXBvcnQgeyBjb2xvciB9IGZyb20gXCIuL2h0bWxcIjtcblxuXG5cbmNvbnN0IGFib3V0X3RleHQgOiBzdHJpbmcgPSBgXG5cbi8vIFRoaXMgaXMgYSB0b3kgY29kZSBlZGl0b3Igc3RpbGwgaW4gZGV2ZWxvcG1lbnQuXG5cbi8vIHRoZSBnb2FsIGlzIHRvIGJ1aWxkIGEgbGFuZ3VhZ2Ugd2l0aDpcblxuLy8gZXh0cmVtZWx5IG1pbmltYWwgc3ludGF4XG4vLyBmaXJzdCBjbGFzcyBzdXBwb3J0IGZvciB0eXBlcyBhcyB2YWx1ZXNcbi8vIGZpcnN0IGNhc3MgTFNQIHByb2dyYW1uZyBpbiBhIHN0cmFpZ2h0Zm9yd2FyZCB3YXkuXG5cbi8vIGhvdmVyIG92ZXIgeCB0byBzZWUgaXRzIGluZmVycmVkIHR5cGVcbmxldCBuID0gMjIgaW5cblxuLy8gdGhpcyBpcyBob3cgdHlwZXMgYXJlIGFubm90YXRlZC4gdHlwZXMgYXJlIGVzc2VudGlhbGx5IGp1c3QgZnVuY3Rpb25zIG92ZXIgdmFsdWVzLlxubGV0IGsgPSAobnVtYmVyIDMzKSBpblxubGV0IHUgPSAoc3RyaW5nIFwiaGxsb1wiKSBpblxuXG4vLyB1bnR5cGVkIGlkXG5sZXQgaWQgPSBmbiB4ID0+IHggaW5cblxuLy8gbnVtYmVyIHR5cGVkIGlkXG5sZXQgaWRuID0gZm4geCA9PiAobnVtYmVyIHgpIGluXG5cbi8vIHR5cGUgb2YgbnVtYmVyIC0+IG51bWJlclxubGV0IFQgPSBmbiBmID0+IGZuIChudW1iZXIgeCkgPT4gKG51bWJlciAoZiB4KSkgaW5cblxubGV0IF9pZCA9IChUIGlkKSBpblxuXG4vL2xldCBiYWQgPSAoX2lkIFwiZVwiKSBpblxuXG5sZXQgciA9IChpZCBcIjJcIikgaW5cblxuLy8gdGhpcyBpcyB3aWxsIHJlc3VsdCBpbiB0eXBlIGVycm9yLlxuLy8gbGV0IEJBRCA9IChpZG5fIFwiMlwiKSBpblxuXG4obnVtYmVyIHN0KVxuYDtcblxuXG5cblxubGV0IG91dHZpZXcgPSBodG1sKCdwcmUnKSgpLnN0eWxlKHtcbiAgYm9yZGVyVG9wOiBcIjFweCBzb2xpZCBcIitjb2xvci5jb2xvcixcbiAgcGFkZGluZ1RvcDogXCIxNnB4XCIsXG59KVxuXG5sZXQgYXN0OiBBU1QgfCB1bmRlZmluZWRcbmxldCBjdXJyZW50QXN0TWFwOiAoU3ludGF4Tm9kZSB8IHVuZGVmaW5lZClbXSA9IFtdXG5cblxubGV0IGNvZGU6c3RyaW5nID0gJydcblxubGV0IEVkaXQgPSBlZGl0b3IoXG4gIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwibGluZXNcIikgPz8gYWJvdXRfdGV4dCxcbiAgKGNvZGUpPT4ge1xuICAgIHRyeXtcblxuICAgICAgbGV0IHBhcnNlZCA9IHBhcnNlKGNvZGUpXG4gICAgICBhc3QgPSBwYXJzZWQuYXN0XG4gICAgICBjb2RlID0gY29kZVxuICAgICAgXG4gICAgICBsZXQgcmVzID0gcnVuKGFzdClcblxuICAgICAgY3VycmVudEFzdE1hcCA9IGJ1aWxkQXN0TWFwKGFzdCwgcGFyc2VkLmNvbW1lbnRzKVxuXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gcHJldHR5QVNUKHJlcylcbiAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwibGluZXNcIiwgY29kZSlcblxuICAgIH1jYXRjaChlKXtcbiAgICAgIGFzdCA9IHVuZGVmaW5lZFxuICAgICAgY3VycmVudEFzdE1hcCA9IFtdXG4gICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICBvdXR2aWV3LmVsLnRleHRDb250ZW50ID0gZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG4gICAgfVxuICB9LFxuICAoKT0+IGN1cnJlbnRBc3RNYXAsXG4gIChyZXEpID0+IHtcbiAgICBsZXQgZGVmID0gcmVxLiQgPT0gXCJ2YXJcIiA/IGdldGRlZihhc3QhLCByZXEpIDogdW5kZWZpbmVkXG4gICAgaWYgKGRlZikgRWRpdC5zZXRDdXJzb3Ioe3JvdzogZGVmLnNwYW4uc3RhcnQubGluZS0xLCBjb2w6IGRlZi5zcGFuLnN0YXJ0LmNvbC0xfSlcbiAgfSxcbiAgKG5vZGUpID0+IHtcbiAgICBpZiAobm9kZS4kID09PSBcImNvbW1lbnRcIikgcmV0dXJuIFsnJywgW11dXG5cbiAgICBsZXQgc3RyID0gKG5vZGUuJCArIFwiOiBcIilcbiAgICBsZXQgbWFwIDogKFN5bnRheE5vZGUgfCB1bmRlZmluZWQpW10gPSBzdHIuc3BsaXQoJycpLm1hcChjPT4gdW5kZWZpbmVkKVxuXG4gICAgbGV0IGFzdDpBU1QgPSBub2RlLnR5cGUgPyBub2RlLnR5cGUgOiBBTllcblxuICAgIGxldCBjbyA9IHByZXR0eUFTVChhc3QpXG4gICAgLy8gbWFwLnB1c2goLi4ucGFyc2UoY28pLmFzdG1hcClcbiAgICBzdHIgKz0gY29cblxuICAgIHJldHVybiBbc3RyLCBtYXBdXG4gIH1cbilcblxuXG5cblxuYm9keS5zdHlsZSh7cGFkZGluZzogXCI0NHB4XCIsZm9udEZhbWlseTogXCJzYW5zLXNlcmlmXCIsfSlcblxuXG5sZXQgYnV0dG4gPSAodDpzdHJpbmcsIG9uQ2xpY2s6KCkgPT4gdm9pZCkgPT4gc3Bhbih0LCBvbkNsaWNrKS5zdHlsZSh7Y29sb3I6IFwiZ3JheVwiLCBib3JkZXI6IFwiMXB4IHNvbGlkIGdyYXlcIiwgYm9yZGVyUmFkaXVzOiBcIjRweFwiLCBwYWRkaW5nOiBcIjJweCA0cHhcIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KVxuXG5ib2R5LmFwcGVuZChcbiAgZGl2KFxuICAgIHNwYW4oJ+KciO+4jicpLnN0eWxlKHtmb250U2l6ZTogXCIzZW1cIiwgbWFyZ2luUmlnaHQ6IFwiOHB4XCJ9KSxcbiAgICBzcGFuKFwiTWlHXCIpLnN0eWxlKHtmb250U2l6ZTogXCIxLjVlbVwiLCBmb250V2VpZ2h0OiBcImJvbGRcIiwgZm9udEZhbWlseTogXCJtb25vc3BhY2VcIn0pXG4gICkuc3R5bGUoe2Rpc3BsYXk6IFwiZmxleFwiLCBhbGlnbkl0ZW1zOiBcImNlbnRlclwiLCBtYXJnaW5Cb3R0b206IFwiMTZweFwiLCBjb2xvcjogXCJncmF5XCJ9KSxcblxuICBFZGl0LmVsLFxuICBvdXR2aWV3LFxuICBidXR0bihcImFib3V0XCIsICgpID0+IEVkaXQuc2V0VGV4dChhYm91dF90ZXh0KSksXG4gIGJ1dHRuKFwiZ2l0aHViXCIsICgpID0+IHdpbmRvdy5vcGVuKFwiaHR0cHM6Ly9naXRodWIuY29tL2Rrb3JtYW5uL215ZWRpdG9yXCIpKVxuKVxuXG5cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFjTyxJQUFNLE9BQU8sQ0FBeUMsUUFBVSxJQUFJLGFBQW9EO0FBQUEsRUFDN0gsSUFBSSxVQUFVLFNBQVMsS0FBSyxPQUFLLE9BQU8sTUFBTSxVQUFVO0FBQUEsRUFDeEQsSUFBSSxLQUFLLFNBQVUsU0FBUyxjQUFjLEdBQUcsQ0FBQyxFQUFFLE9BQU8sR0FBSSxTQUFTLE9BQU8sT0FBSyxPQUFPLE1BQU0sVUFBVSxDQUFzQjtBQUFBLEVBQzdILElBQUk7QUFBQSxJQUFTLEdBQUcsR0FBSSxVQUFXO0FBQUEsRUFFL0IsT0FBTztBQUFBO0FBSUYsSUFBTSxXQUFZLENBQTBCLE9BQW1CO0FBQUEsRUFFcEUsSUFBSSxPQUFpQjtBQUFBLElBQ25CLEdBQUc7QUFBQSxJQUNIO0FBQUEsSUFDQSxRQUFRLElBQUksYUFBOEI7QUFBQSxNQUN4QyxTQUFTLFFBQVEsV0FBUztBQUFBLFFBQ3hCLElBQUksT0FBTyxVQUFVO0FBQUEsVUFBVSxHQUFHLFlBQVksU0FBUyxlQUFlLEtBQUssQ0FBQztBQUFBLFFBQ3ZFO0FBQUEsYUFBRyxZQUFZLE1BQU0sRUFBRTtBQUFBLE9BQzdCO0FBQUEsTUFDRCxPQUFPO0FBQUE7QUFBQSxJQUVULFNBQVMsQ0FBQyxNQUE2QjtBQUFBLE1BQ3JDLEdBQUcsVUFBVTtBQUFBLE1BQ2IsT0FBTztBQUFBO0FBQUEsSUFFVCxnQkFBZ0IsSUFBSSxhQUE4QjtBQUFBLE1BQ2hELEdBQUcsZ0JBQWdCO0FBQUEsTUFDbkIsT0FBTyxLQUFLLE9BQU8sR0FBRyxRQUFRO0FBQUE7QUFBQSxJQUVoQyxPQUFPLENBQUMsV0FBeUM7QUFBQSxNQUMvQyxPQUFPLE9BQU8sR0FBRyxPQUFPLE1BQU07QUFBQSxNQUM5QixPQUFPLFNBQVMsRUFBRTtBQUFBO0FBQUEsSUFFcEIsUUFBUSxDQUFD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LENBQUM7QUFBQSxJQUNmLFFBQVEsR0FBRyxjQUFjLGFBQWEsUUFBUSxFQUFFLFVBQVUsT0FBTyxDQUFDO0FBQUE7QUFBQSxHQUd0RSxNQUFLLGVBQ0wsQ0FBQyxRQUFRO0FBQUEsRUFDUCxJQUFJLE1BQU0sSUFBSSxLQUFLLFFBQVEsT0FBTyxLQUFNLEdBQUcsSUFBSTtBQUFBLEVBQy9DLElBQUk7QUFBQSxJQUFLLEtBQUssVUFBVSxFQUFDLEtBQUssSUFBSSxLQUFLLE1BQU0sT0FBSyxHQUFHLEtBQUssSUFBSSxLQUFLLE1BQU0sTUFBSSxFQUFDLENBQUM7QUFBQSxHQUVqRixDQUFDLFNBQVM7QUFBQSxFQUNSLElBQUksS0FBSyxNQUFNO0FBQUEsSUFBVyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7QUFBQSxFQUV4QyxJQUFJLE1BQU8sS0FBSyxJQUFJO0FBQUEsRUFDcEIsSUFBSSxNQUFtQyxJQUFJLE1BQU0sRUFBRSxFQUFFLElBQUksT0FBQztBQUFBLElBQUc7QUFBQSxHQUFTO0FBQUEsRUFFdEUsSUFBSSxPQUFVLEtBQUssT0FBTyxLQUFLLE9BQU87QUFBQSxFQUV0QyxJQUFJLEtBQUssVUFBVSxJQUFHO0FBQUEsRUFFdEIsT0FBTztBQUFBLEVBRVAsT0FBTyxDQUFDLEtBQUssR0FBRztBQUFBLENBRXBCO0FBS0EsS0FBSyxNQUFNLEVBQUMsU0FBUyxRQUFPLFlBQVksYUFBYSxDQUFDO0FBR3RELElBQUksUUFBUSxDQUFDLEdBQVUsWUFBdUIsS0FBSyxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUMsT0FBTyxRQUFRLFFBQVEsa0JBQWtCLGNBQWMsT0FBTyxTQUFTLFdBQVcsYUFBYSxNQUFLLENBQUM7QUFFM0ssS0FBSyxPQUNILElBQ0UsS0FBSyxJQUFHLEVBQUUsTUFBTSxFQUFDLFVBQVUsT0FBTyxhQUFhLE1BQUssQ0FBQyxHQUNyRCxLQUFLLEtBQUssRUFBRSxNQUFNLEVBQUMsVUFBVSxTQUFTLFlBQVksUUFBUSxZQUFZLFlBQVcsQ0FBQyxDQUNwRixFQUFFLE1BQU0sRUFBQyxTQUFTLFFBQVEsWUFBWSxVQUFVLGNBQWMsUUFBUSxPQUFPLE9BQU0sQ0FBQyxHQUVwRixLQUFLLElBQ0wsU0FDQSxNQUFNLFNBQVMsTUFBTSxLQUFLLFFBQVEsVUFBVSxDQUFDLEdBQzdDLE1BQU0sVUFBVSxNQUFNLE9BQU8sS0FBSyxzQ0FBc0MsQ0FBQyxDQUMzRTsiLAogICJkZWJ1Z0lkIjogIkMzN0ZGODQwNEU4NDlCRDQ2NDc1NkUyMTY0NzU2RTIxIiwKICAibmFtZXMiOiBbXQp9
