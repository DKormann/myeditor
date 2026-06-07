import { body, button, div, html, span } from "./html";
import { editor } from "./editor";


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
    try{
      outview.el.textContent = eval(s)
    }catch(e){}
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
// This is a toy code editor still in development.

// The main goal is to bring zig's comptime capabilities to a scripting language.

// also if possible I want to make the code linter programmable in a very straightforward way.

// currently the editor might be able to run js code:

22

`)
  })
  .style({ color: "gray", border: "1px solid gray", borderRadius: "4px", padding: "2px 4px", }),


)



