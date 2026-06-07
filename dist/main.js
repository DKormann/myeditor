var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// src/html.ts
var html = (tag) => (...children) => {
  let onclick = children.find((c) => typeof c === "function");
  let el = fromHTML(document.createElement(tag)).append(...children.filter((c) => typeof c !== "function"));
  if (onclick)
    el.onclick(onclick);
  return el;
}, fromHTML = (el) => {
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
    onclick: (handler) => {
      el.addEventListener("click", handler);
      return fromHTML(el);
    }
  };
  return node;
}, div, span, p, body, h1, h2, h3, h4, canvas, button;
var init_html = __esm(() => {
  document.createElement;
  div = html("div");
  span = html("span");
  p = html("p");
  body = fromHTML(document.body);
  h1 = html("h1");
  h2 = html("h2");
  h3 = html("h3");
  h4 = html("h4");
  canvas = html("canvas");
  button = html("button");
});

// src/editor.ts
var editor = (oninput) => {
  let lines = localStorage.getItem("lines")?.split(`
`) || [""];
  let cursor = { col: 0, row: 0 };
  let el = html("pre")().style({
    userSelect: "none"
  });
  let elements = new WeakMap;
  let setCursor = (pos) => {
    cursor = pos;
    render();
  };
  const render = () => {
    console.log("render");
    localStorage.setItem("lines", lines.join(`
`));
    oninput(lines.join(`
`));
    let scol = Math.min(cursor.col, lines[cursor.row].length);
    el.replaceChilren(...lines.map((line, row) => {
      let par = p(...line.split("").concat(" ").map((char, col) => {
        let chr = span(char, (e) => elements.set(chr.el, { row, col })).style(row == cursor.row && col == scol ? { backgroundColor: "white", color: "black" } : {});
        return chr;
      }), (e) => elements.set(par.el, { row, col: line.length })).style({ margin: "0" });
      return par;
    }));
  };
  window.addEventListener("keydown", (e) => {
    if (e.key.length === 1) {
      if (e.metaKey) {
        if (e.key == "r")
          return;
      }
      lines[cursor.row] = lines[cursor.row].substring(0, cursor.col) + e.key + lines[cursor.row].substring(cursor.col);
      cursor.col++;
      render();
    }
    if (e.key === "Backspace") {
      if (e.metaKey && cursor.col > 0) {
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
        if (cursor.col > 0) {
          cursor.col = 0;
        } else if (cursor.row > 0) {
          cursor.row--;
          cursor.col = lines[cursor.row].length;
        }
      } else if (cursor.col > 0) {
        cursor.col--;
      } else if (cursor.row > 0) {
        cursor.row--;
        cursor.col = lines[cursor.row].length;
      }
    }
    if (e.key === "ArrowRight") {
      if (e.metaKey) {
        if (cursor.col < lines[cursor.row].length)
          cursor.col = lines[cursor.row].length;
        else if (cursor.row < lines.length - 1) {
          cursor.row++;
          cursor.col = 0;
        }
      } else if (cursor.col < lines[cursor.row].length)
        cursor.col++;
      else if (cursor.row < lines.length - 1) {
        cursor.row++;
        cursor.col = 0;
      }
    }
    if (e.key === "ArrowUp") {
      if (e.metaKey)
        cursor.row = 0;
      else if (cursor.row > 0)
        cursor.row--;
    }
    if (e.key === "ArrowDown") {
      if (e.metaKey)
        cursor.row = lines.length - 1;
      else if (cursor.row < lines.length - 1)
        cursor.row++;
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
    e.preventDefault();
    render();
  });
  window.addEventListener("click", (e) => {
    if (elements.has(e.target)) {
      setCursor(elements.get(e.target));
    }
  });
  render();
  return { el, setText: (text) => {
    lines = text.split(`
`);
    setCursor({ row: 0, col: 0 });
    render();
  } };
};
var init_editor = __esm(() => {
  init_html();
});

// src/main.ts
var require_main = __commonJS((exports, module) => {
  init_html();
  init_editor();
  (async () => {
    let version = await fetch("/version").then((res) => res.text());
    while (true) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        if (await fetch("/version").then((res) => res.text()) != version)
          window.location.reload();
      } catch (e) {
        break;
      }
    }
  })();
  var outview = html("pre")().style({
    borderTop: "1px solid white",
    paddingTop: "16px"
  });
  var Edit = editor((s) => {
    try {
      outview.el.textContent = eval(s);
    } catch (e) {}
  });
  body.style({
    padding: "44px",
    color: "white",
    backgroundColor: "black",
    fontFamily: "sans-serif"
  }).append(Edit.el, outview, span(" ⚙ about this", () => {
    Edit.setText(`
// This is a toy code editor still in development. [https://github.com/dkormann/myeditor]

// The main goal is to bring zig's comptime capabilities to a scripting language.

// also if possible I want to make the code linter programmable in a very straightforward way.

// currently the editor might be able to run js code:

22

`);
  }).style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px" }));
});
export default require_main();
