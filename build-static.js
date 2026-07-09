const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

copyDir(path.join(root, "IMAGE_FIXX"), path.join(publicDir, "IMAGE_FIXX"));
fs.copyFileSync(path.join(root, "data", "store.json"), path.join(publicDir, "store.json"));
