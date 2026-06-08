# myeditor

This is a toy code editor still in development. [try it](https://dkormann.github.io/myeditor)

## goals
The main goal is to bring zig's comptime capabilities to a scripting language.

also if possible I want to make the code linter programmable in a very straightforward way.


## development

this uses bun as a terminal runtime; no package manager; no bundler!

`bun run build.ts` watches src for changes than builds a static page into dist and launches a development server to port 3030
