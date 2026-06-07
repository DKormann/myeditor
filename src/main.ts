import { body, button, div, html, span } from "./html";
import { editor } from "./editor";
import { parse } from "./parser";


(async ()=>{
  let version = await fetch("/version").then(res => res.text())
  while (true){
    await new Promise(r => setTimeout(r, 100))
    try{
      if (await fetch("/version").then(res => res.text()) != version) window.location.reload()
    }catch(e){break;}
  }
})();

let outview = html('pre')().style({
  borderTop: "1px solid white",
  paddingTop: "16px",
})


let Edit = editor(s=> {
    // try{
    //   outview.el.textContent = eval(s)
    // }catch(e){}

    try{
      let ast = parse(s)
      outview.el.textContent = JSON.stringify(ast, null, 2)
    }catch(e){
      outview.el.textContent = e instanceof Error ? e.message : String(e)
    }

  })

body.style({
  padding: "44px",
  color: "white",
  backgroundColor: "black",
  fontFamily: "sans-serif",
})




.append(
  Edit.el,
  outview,

  span(" ⚙ about this", ()=>{
    Edit.setText(`
// This is a toy code editor still in development. [https://github.com/dkormann/myeditor]

// The main goal is to bring zig's comptime capabilities to a scripting language.

// also if possible I want to make the linter programmable from the code in a straightforward way.


`)
  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", }),


)



