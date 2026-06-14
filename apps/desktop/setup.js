const fs = require("fs");
const path = require("path");

const example = path.join(__dirname, ".env.example");
const local = path.join(__dirname, ".env.local");

if (fs.existsSync(local)) {
  console.log("✓ .env.local already exists — skipping");
  process.exit(0);
}

if (!fs.existsSync(example)) {
  console.error("✕ .env.example not found");
  process.exit(1);
}

fs.copyFileSync(example, local);
console.log("✓ Created .env.local from .env.example");
console.log("  → Open apps/desktop/.env.local and fill in your NEXUS_SECRET");