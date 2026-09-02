import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VOYAGE_API_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = [
  {
    author: "Marcus Aurelius",
    work: "Meditations",
    wikisource: true,
    urls: [
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_1&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_2&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_3&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_4&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_5&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_6&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_7&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_8&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_9&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_10&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_11&prop=text&format=json",
      "https://en.wikisource.org/w/api.php?action=parse&page=The_Meditations_of_the_Emperor_Marcus_Antoninus/Book_12&prop=text&format=json",
    ],
  },
  {
    author: "Epictetus",
    work: "Discourses and Enchiridion",
    url: "https://www.gutenberg.org/files/10661/10661-0.txt",
    startMarker: "DISCOURSE I",
    endMarker: "End of the Project Gutenberg",
  },
  {
    author: "Seneca",
    work: "Morals",
    url: "https://www.gutenberg.org/files/56075/56075-0.txt",
    startMarker: "OF A HAPPY LIFE",
    endMarker: "End of the Project Gutenberg",
  },
  {
    author: "Seneca",
    work: "On Benefits",
    url: "https://www.gutenberg.org/files/3794/3794.txt",
    startMarker: "BOOK I",
    endMarker: "End of the Project Gutenberg",
  },
];

const MIN_CHUNK_CHARS = 150;
const MAX_CHUNK_CHARS = 800;
const EMBED_BATCH_SIZE = 8;
const EMBED_DELAY_MS = 500;

// Fetch and extract plain text from Wikisource rendered HTML
async function fetchWikisourceText(url, bookNum) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = await res.json();
  const html = data.parse.text["*"];
  
  // Strip all HTML tags
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  
  // Find where numbered entries begin (the actual Meditations content)
  const startIdx = text.search(/\s1\.\s/);
  if (startIdx === -1) {
    console.warn(`  Could not find start of content for Book ${bookNum}`);
    return text;
  }
  
  // Find where content ends (before footer navigation)
  const endMarkers = ["Retrieved from", "Categories:", "Navigation menu"];
  let endIdx = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  
  return text.slice(startIdx, endIdx).trim();
}

function chunkText(text, author, work, sectionPrefix) {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks = [];
  let buffer = "";
  let sectionLabel = sectionPrefix || "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (/^(BOOK|CHAPTER|LETTER|SECTION|PART)\s+[IVXLCDM\d]+/i.test(trimmed)) {
      sectionLabel = trimmed.replace(/\n/g, " ").slice(0, 80);
      continue;
    }
    buffer += (buffer ? "\n\n" : "") + trimmed;
    if (buffer.length >= MAX_CHUNK_CHARS) {
      const sentences = buffer.split(/(?<=[.!?])\s+/);
      let current = "";
      for (const s of sentences) {
        if ((current + s).length > MAX_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
          chunks.push({ author, work, section: sectionLabel, passage: current.trim() });
          current = s;
        } else {
          current += (current ? " " : "") + s;
        }
      }
      buffer = current;
    }
  }
  if (buffer.length >= MIN_CHUNK_CHARS) {
    chunks.push({ author, work, section: sectionLabel, passage: buffer.trim() });
  }
  return chunks;
}

async function embedBatch(texts) {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: "voyage-3", input: texts }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.data.map((e) => e.embedding);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchGutenbergText(source) {
  console.log(`  Downloading ${source.work}...`);
  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${source.url}`);
  let text = await res.text();
  const start = text.indexOf(source.startMarker);
  const end = text.indexOf(source.endMarker);
  if (start === -1) {
    console.warn(`  Could not find start marker for ${source.work}, using full text`);
    return text;
  }
  return text.slice(start, end === -1 ? undefined : end);
}

async function ingest() {
  console.log("Stoic Mirror — Text Ingestion\n");

  console.log("Clearing existing passages...");
  await supabase
    .from("stoic_passages")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  let totalInserted = 0;

  for (const source of SOURCES) {
    console.log(`\nProcessing: ${source.author} — ${source.work}`);

    let allChunks = [];

    if (source.wikisource) {
      // Handle Wikisource multi-URL sources
      for (let i = 0; i < source.urls.length; i++) {
        const url = source.urls[i];
        const bookNum = i + 1;
        console.log(`  Fetching Book ${bookNum}...`);
        try {
          const text = await fetchWikisourceText(url, bookNum);
          const chunks = chunkText(text, source.author, source.work, `Book ${bookNum}`);
          allChunks.push(...chunks);
          console.log(`  Book ${bookNum}: ${chunks.length} passages`);
          await sleep(500); // Be polite to Wikisource API
        } catch (err) {
          console.error(`  Book ${bookNum} failed: ${err.message}`);
        }
      }
    } else {
      // Handle Gutenberg plain text sources
      let rawText;
      try {
        rawText = await fetchGutenbergText(source);
      } catch (err) {
        console.error(`  Download failed: ${err.message}`);
        continue;
      }
      allChunks = chunkText(rawText, source.author, source.work, "");
    }

    console.log(`  ${allChunks.length} total passages extracted`);

    const rows = [];
    for (let i = 0; i < allChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => c.passage);
      process.stdout.write(
        `  Embedding batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / EMBED_BATCH_SIZE)}...`
      );
      try {
        const embeddings = await embedBatch(texts);
        for (let j = 0; j < batch.length; j++) {
          rows.push({ ...batch[j], embedding: embeddings[j] });
        }
        process.stdout.write(" done\n");
      } catch (err) {
        process.stdout.write(` error: ${err.message}\n`);
      }
      if (i + EMBED_BATCH_SIZE < allChunks.length) await sleep(EMBED_DELAY_MS);
    }

    const INSERT_BATCH = 50;
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const { error } = await supabase.from("stoic_passages").insert(batch);
      if (error) console.error(`  Insert error: ${error.message}`);
    }

    console.log(`  ${rows.length} passages stored`);
    totalInserted += rows.length;
  }

  console.log(`\nDone — ${totalInserted} total passages stored`);
}

ingest().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
