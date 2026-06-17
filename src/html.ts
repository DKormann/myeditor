

export type NODE <H extends HTMLElement = HTMLElement> =  {
  $ : "NODE",
  el: H,
  append: (...children: (NODE | string)[]) => NODE,
  replaceChilren: (...children: (NODE | string)[]) => NODE,
  style: (styles: Partial<CSSStyleDeclaration>) => NODE,
  assign: (htmlProps: Partial<HTMLElement>) => NODE
}

export type ARG = NODE | string | ((e:MouseEvent)=>void)

export const html = <K extends keyof HTMLElementTagNameMap> (tag:K) => (...children:ARG[]): NODE <HTMLElementTagNameMap[K]> => {
  let onclick = children.find(c => typeof c === "function") as Function
  let el = fromHTML (document.createElement(tag)).append(... children.filter(c => typeof c !== "function") as (NODE | string)[]) as NODE <HTMLElementTagNameMap[K]>;
  if (onclick) el.el. onclick = (onclick as (e:MouseEvent)=>void)
  
  return el
}


export const fromHTML  = <H extends HTMLElement>  (el:H): NODE <H> => {
  let node : NODE<H> = {
    $: "NODE",
    el,
    append: (...children:(NODE| string)[]) => {
      children.forEach(child => {
        if (typeof child === "string") el.appendChild(document.createTextNode(child));
        else el.appendChild(child.el);

      });
      return fromHTML(el);
    },
    replaceChilren: (...children:(NODE| string)[]) => {
      el.replaceChildren()
      return node.append(...children)
    },
    style: (styles: Partial<CSSStyleDeclaration>) => {
      Object.assign(el.style, styles);
      return fromHTML(el);
    },
    assign: (htmlProps: Partial<HTMLElement>) => {
      Object.assign(el, htmlProps);
      return fromHTML(el);
    }
  };
  return node
}


export const div = html("div");
export const span = html("span");
export const p = html("p");
export const body = fromHTML(document.body);
export const h1 = html("h1");
export const h2 = html("h2");
export const h3 = html("h3");
export const h4 = html("h4");
export const table = html("table");
export const tr = html("tr");
export const td = html("td");
export const pre = html("pre")

export const canvas = html("canvas");

export const button = html("button");



let globstyle = document.createElement("style")
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
`

document.head.appendChild(globstyle)


export const color = {
  red: "var(--red)",
  green: "var(--green)",
  blue: "var(--blue)",
  yellow: "var(--yellow)",
  purple: "var(--purple)",
  cyan: "var(--cyan)",

  gray: "var(--gray)",
  color: "var(--color)",
  background: "var(--background)"
}


body.el.style =`
background: ${color.background};
color: ${color.color};
`
