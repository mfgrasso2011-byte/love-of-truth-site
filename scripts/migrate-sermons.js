#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const feedDirectory = process.argv[2] || "/tmp";
const outputPath = path.resolve(process.argv[3] || "content/sermons.json");
const feedFiles = fs.readdirSync(feedDirectory)
  .filter((name) => /^grasso-feed(?:-\d+)?\.xml$/.test(name))
  .sort((a, b) => {
    const page = (name) => Number(name.match(/-(\d+)\.xml$/)?.[1] || 1);
    return page(a) - page(b);
  });

const books = [
  "Song of Solomon", "1 Thessalonians", "2 Thessalonians", "1 Corinthians", "2 Corinthians",
  "1 Chronicles", "2 Chronicles", "Deuteronomy", "Ecclesiastes", "Lamentations", "Philippians",
  "Colossians", "Revelation", "1 Samuel", "2 Samuel", "1 Timothy", "2 Timothy", "1 Peter", "2 Peter",
  "1 Kings", "2 Kings", "1 John", "2 John", "3 John", "Leviticus", "Numbers", "Joshua", "Judges",
  "Nehemiah", "Esther", "Psalms", "Proverbs", "Isaiah", "Jeremiah", "Ezekiel", "Daniel", "Hosea",
  "Obadiah", "Habakkuk", "Zephaniah", "Zechariah", "Matthew", "Romans", "Galatians", "Ephesians",
  "Philemon", "Hebrews", "Genesis", "Exodus", "Ruth", "Ezra", "Job", "Joel", "Amos", "Jonah",
  "Micah", "Nahum", "Haggai", "Malachi", "Mark", "Luke", "John", "Acts", "James", "Titus", "Jude"
];

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", quot: '"', lt: "<", gt: ">", nbsp: " " };
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function textContent(value) {
  return decodeEntities(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item, name) {
  return item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "";
}

function inferBook(title, description) {
  if (/^Psalm\b/i.test(title)) return "Psalms";
  if (/^Song of Songs\b/i.test(title)) return "Song of Solomon";
  if (/^1st Peter\b/i.test(title)) return "1 Peter";
  const titleMatch = books.find((book) => new RegExp(`^${book.replace(/ /g, "\\s+")}\\b`, "i").test(title));
  if (titleMatch) return titleMatch;
  const scriptureMatch = books.find((book) => new RegExp(`\\b${book.replace(/ /g, "\\s+")}\\s+\\d`, "i").test(description));
  return scriptureMatch || "";
}

const sermonsById = new Map();

for (const filename of feedFiles) {
  const xml = fs.readFileSync(path.join(feedDirectory, filename), "utf8");
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  for (const item of items) {
    const title = textContent(tag(item, "title"));
    const sourceUrl = textContent(tag(item, "link"));
    const guid = textContent(tag(item, "guid"));
    const rawDescription = textContent(tag(item, "description"));
    const description = rawDescription.replace(/\s*The post .*? appeared first on New Covenant OPC\.?$/i, "").trim();
    const enclosure = item.match(/<enclosure\s+[^>]*url="([^"]+)"/i)?.[1] || "";
    const id = guid.match(/[?&]p=(\d+)/)?.[1] || sourceUrl.split("/").filter(Boolean).pop();
    const date = new Date(textContent(tag(item, "pubDate"))).toISOString().slice(0, 10);

    if (!title || !sourceUrl || !id) continue;
    sermonsById.set(String(id), {
      id: String(id),
      title,
      book: inferBook(title, description),
      date,
      description,
      audioUrl: decodeEntities(enclosure),
      sourceUrl
    });
  }
}

const sermons = [...sermonsById.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ sermons }, null, 2)}\n`);

const missingBooks = sermons.filter(({ book }) => !book).length;
console.log(`Migrated ${sermons.length} sermons from ${feedFiles.length} feed pages to ${outputPath}.`);
console.log(`${sermons.filter(({ audioUrl }) => audioUrl).length} include MP3 audio; ${missingBooks} need a book assigned manually.`);
