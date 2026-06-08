

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

document.createElement


export const div = html("div");
export const span = html("span");
export const p = html("p");
export const body = fromHTML(document.body);
export const h1 = html("h1");
export const h2 = html("h2");
export const h3 = html("h3");
export const h4 = html("h4");

export const canvas = html("canvas");

export const button = html("button");
