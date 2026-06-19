

import {readdir} from "fs/promises"
import {stat} from "fs/promises"

let version = 0
let last_mtime = 0

let builderr: string = ""

setInterval(async () => {

  let newmtimt = await (readdir("src").then((ds:string[]) =>
    Promise.all(ds.map(name=>stat("src/"+name).then(st=>st.mtimeMs))).then(tms=> tms.reduce((a,c)=> a > c ? a : c))));

  if (newmtimt > last_mtime){
    last_mtime = newmtimt
    await Bun.spawn(["bun", "build", "src/main.ts", "--outdir", "dist", "--sourcemap=inline"], {
      stderr: "pipe"
    }).stderr.text().then(err=>{builderr = err})
    version ++
    console.log("built version: ", version)
  }

}, 100)



console.log("serve at http://localhost:3030")
Bun.serve({
  port: 3030,
  routes: {
    "/": async (req) => {
      const html = await Bun.file("index.html").text()
      return new Response(html, {
        headers: {
          "Content-Type": "text/html"
        }
      })
    },
    "/dist/*": async (req) => {
      const path = "./dist/" + req.url.split("/dist/")[1];
      let file =  Bun.file(path)
      if (!(await file.exists())) {
        return new Response("Not found", {status: 404})
      }
      return new Response(await file.arrayBuffer(), {headers: {"Content-Type": "application/javascript"}})
    },
    "/builderr": (req)=> new Response(builderr),
    "/version": async (req) => {
      return new Response(version.toString())
    }
  }
});
