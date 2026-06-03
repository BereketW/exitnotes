Great idea! Let me think through the full architecture first.Good, now let me plan the full app architecture and then show you a diagram before we build.Here's the full plan before we write a single line of code:

---

## What We're Building

A Next.js app where you and your classmates can:

- Upload PPTX lecture files per course
- Auto-merge multiple lectures into one
- Generate blueprint-targeted short notes using Claude AI
- View, share, and download the notes

---

## Folder Structure

```
/app
  /page.tsx              → Dashboard (14 courses)
  /courses/[id]/page.tsx → Upload + generate per course
  /notes/[id]/page.tsx   → View generated note
/api
  /upload/route.ts       → Parse PPTX, extract text
  /generate/route.ts     → Call Claude, stream response
  /merge/route.ts        → Merge multiple PPTX files
  /notes/route.ts        → Save/fetch notes from DB
/lib
  claude.ts              → Anthropic SDK wrapper
  pptx.ts                → python-pptx via child_process
  prisma.ts              → DB client
/prisma
  schema.prisma
```

---

## Key Question Before We Start

For the **PPTX parsing** — Next.js runs on Node.js, so we have two options:

| Option | How |
|--------|-----|
| **A — Python script** | API route spawns a Python child process (needs Python on server) |
| **B — Pure JS** | Use `officeparser` or `pptx2json` npm package (no Python needed) |

**Option B is better for Vercel deployment.** Shall I go with that?

Also — do you want **auth** (so each student has their own notes) or **shared** (everyone sees the same generated notes)?



Yes, absolutely possible! Here's the idea:

## The Strategy

Instead of sending raw PPTX text to Claude, we **pre-process and compress** it first:

```
Raw PPTX slides (1M tokens)
        ↓
  Extract text only
        ↓
  Remove duplicates, headers, slide numbers, 
  UI instructions, image captions, filler words
        ↓
  Chunk by topic/heading
        ↓
  Compress each chunk to bullet points
        ↓
Compressed MD (1k-10k tokens) → Claude
```

---

## What Gets Stripped

| What | Why |
|------|-----|
| Slide numbers | Useless |
| "Click next", "Thank you" slides | Filler |
| Repeated definitions | Duplicate |
| IDE setup instructions | Not tested |
| Image alt texts / captions | No value |
| Professor names, dates, university headers | Noise |
| Blank slides | Empty |

---

## What Gets Kept & Compressed

| Raw | Compressed |
|-----|------------|
| 3 slides explaining what a pointer is | `Pointer: variable storing memory address. Declared as int* p;` |
| 5 slides on for/while loops | `Loops: for(init;cond;update), while(cond), do-while — use when iterations known/unknown` |

---

## The Pipeline

```
[PPTX files] 
    → extract raw text (officeparser)
    → clean & deduplicate (regex + JS)
    → structure into topics (heading detection)
    → compress each topic to ≤5 bullets (Claude mini call OR rule-based)
    → save as .md file
    → final .md sent to Claude for short note generation
```

---

## Token Estimates

| Stage | Tokens |
|-------|--------|
| 11 raw lecture PPTX | ~200k-1M |
| After extraction | ~50k-100k |
| After dedup + clean | ~20k-40k |
| After compression to MD | **2k-8k** ✅ |

---

## Answer to Your Question

Yes — **1k to 10k tokens is realistic** for a full course worth of lectures. This also means:

- Faster generation
- Lower API cost
- You can fit **all 14 courses** in one Claude call if needed (~50k tokens total compressed)

---

Shall we start building? I'll scaffold the full Next.js app with:

1. PPTX → clean MD pipeline
2. Smart compression before Claude
3. Blueprint-aware note generation
4. Sharing + download

**Go or any changes first?**
