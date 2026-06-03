import { inflateRawSync } from "node:zlib";

export type SlideText = {
  slideNumber: number;
  text: string;
};

export type ExtractedDeck = {
  fileName: string;
  slides: SlideText[];
  rawText: string;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

export function extractPptxText(fileName: string, bytes: ArrayBuffer) {
  const buffer = Buffer.from(bytes);
  const entries = unzip(buffer);
  const slides = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
    .map((entry) => ({
      slideNumber: Number(entry.name.match(/slide(\d+)\.xml$/)?.[1] ?? 0),
      text: xmlToText(entry.data.toString("utf8")),
    }))
    .filter((slide) => slide.text.length > 0)
    .sort((a, b) => a.slideNumber - b.slideNumber);

  return {
    fileName,
    slides,
    rawText: slides
      .map((slide) => `Slide ${slide.slideNumber}\n${slide.text}`)
      .join("\n\n"),
  } satisfies ExtractedDeck;
}

function unzip(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Invalid PPTX ZIP central directory.");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error(`Invalid PPTX ZIP local header for ${name}.`);
    }

    if (compressionMethod === 0) {
      entries.push({ name, data: compressed });
    } else if (compressionMethod === 8) {
      entries.push({ name, data: inflateRawSync(compressed) });
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("This file is not a readable PPTX ZIP package.");
}

function xmlToText(xml: string) {
  const matches = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)];
  return matches
    .map((match) => decodeXml(match[1]))
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
