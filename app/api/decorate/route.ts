import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

const maxImageSizeBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const minWallConfidence = 0.8;

type WallValidationResult = {
  is_wall_photo: boolean;
  confidence: number;
  reason: string;
};

function extractFirstJsonObject(input: string) {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return input.slice(start, end + 1);
}

function extractOutputText(response: unknown) {
  if (
    typeof response === "object" &&
    response !== null &&
    "output_text" in response &&
    typeof (response as { output_text?: unknown }).output_text === "string"
  ) {
    return (response as { output_text: string }).output_text;
  }
  return "";
}

function extractGeneratedImageBase64(response: unknown) {
  if (
    !response ||
    typeof response !== "object" ||
    !("output" in response) ||
    !Array.isArray((response as { output?: unknown[] }).output)
  ) {
    return null;
  }

  const output = (response as { output: unknown[] }).output;
  for (const item of output) {
    if (
      item &&
      typeof item === "object" &&
      (item as { type?: string }).type === "image_generation_call" &&
      typeof (item as { result?: unknown }).result === "string"
    ) {
      return (item as { result: string }).result;
    }
  }
  return null;
}

async function validateWallPhoto(params: {
  model: string;
  fileId: string;
  openai: ReturnType<typeof getOpenAIClient>;
}) {
  const validator = await params.openai.responses.create({
    model: params.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              'You are validating whether an uploaded image is suitable for wall decoration editing. ' +
              'Return only JSON with keys: is_wall_photo (boolean), confidence (0 to 1), reason (string). ' +
              "Mark true only when this is a real photo where a wall is clearly visible and usable for decor editing. " +
              "Mark false for selfies, people-focused photos, pets, documents, objects, outdoor scenes, food, or unclear/low-visibility walls.",
          },
          {
            type: "input_image",
            file_id: params.fileId,
            detail: "auto",
          },
        ],
      },
    ],
  });

  const outputText = extractOutputText(validator);
  const jsonBlock = extractFirstJsonObject(outputText);
  if (!jsonBlock) {
    return {
      ok: false,
      verdict: {
        is_wall_photo: false,
        confidence: 0,
        reason: "Validator could not confirm this as a wall photo.",
      } satisfies WallValidationResult,
    };
  }

  try {
    const parsed = JSON.parse(jsonBlock) as Partial<WallValidationResult>;
    const verdict: WallValidationResult = {
      is_wall_photo: Boolean(parsed.is_wall_photo),
      confidence:
        typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : 0,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "Image is not suitable for wall decoration.",
    };
    const ok = verdict.is_wall_photo && verdict.confidence >= minWallConfidence;
    return { ok, verdict };
  } catch {
    return {
      ok: false,
      verdict: {
        is_wall_photo: false,
        confidence: 0,
        reason: "Validator response was invalid.",
      } satisfies WallValidationResult,
    };
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { message: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const image = form.get("image");
    const style = String(form.get("style") ?? "").trim();
    const roomType = String(form.get("roomType") ?? "").trim();
    const colorPalette = String(form.get("colorPalette") ?? "").trim();
    const mustHaveItems = String(form.get("mustHaveItems") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();

    if (!(image instanceof File)) {
      return NextResponse.json({ message: "Please upload a wall image." }, { status: 400 });
    }

    if (!allowedImageTypes.has(image.type)) {
      return NextResponse.json(
        { message: "Unsupported image type. Use JPG, PNG, or WEBP." },
        { status: 400 },
      );
    }

    if (image.size > maxImageSizeBytes) {
      return NextResponse.json(
        { message: "Image is too large. Max size is 8MB." },
        { status: 400 },
      );
    }

    if (!style || !roomType) {
      return NextResponse.json(
        { message: "Style and room type are required." },
        { status: 400 },
      );
    }

    const promptSummary = [
      `Decorate this ${roomType} wall in a ${style} style.`,
      colorPalette ? `Preferred palette: ${colorPalette}.` : "",
      mustHaveItems ? `Must-have items: ${mustHaveItems}.` : "",
      notes ? `Extra notes: ${notes}.` : "",
      "Preserve the exact room structure, wall geometry, perspective, and camera angle.",
      "Keep lighting realistic and cohesive with the original scene.",
      "Do not change the wall into a different room or architectural layout.",
    ]
      .filter(Boolean)
      .join(" ");

    const bytes = Buffer.from(await image.arrayBuffer());
    const originalBase64 = bytes.toString("base64");
    const originalImage = `data:${image.type};base64,${originalBase64}`;

    const openai = getOpenAIClient();
    const imageFile = new File([bytes], image.name || "wall-image.png", { type: image.type });

    const uploadedFile = await openai.files.create({
      file: imageFile,
      purpose: "vision",
    });

    const validation = await validateWallPhoto({
      model: "gpt-5.5",
      fileId: uploadedFile.id,
      openai,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          message: "Please upload a clear photo of a plain or mostly plain wall.",
          reason: validation.verdict.reason,
          confidence: validation.verdict.confidence,
        },
        { status: 422 },
      );
    }

    const result = await openai.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: promptSummary,
            },
            {
              type: "input_image",
              file_id: uploadedFile.id,
              detail: "auto",
            },
          ],
        },
      ],
      tools: [
        {
          type: "image_generation",
          quality: "high",
        },
      ],
    });

    const b64 = extractGeneratedImageBase64(result);
    if (!b64) {
      return NextResponse.json(
        { message: "Image generation did not return an image." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      originalImage,
      generatedImage: `data:image/png;base64,${b64}`,
      promptSummary,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    if (typeof error === "object" && error !== null && "status" in error) {
      const status = (error as { status?: unknown }).status;
      if (status === 429) {
        return NextResponse.json(
          { message: "OpenAI rate limit reached. Please retry in a moment." },
          { status: 502 },
        );
      }
      if (typeof status === "number" && status >= 500) {
        return NextResponse.json(
          { message: "OpenAI service is temporarily unavailable. Please retry." },
          { status: 502 },
        );
      }
    }
    return NextResponse.json(
      { message: "Failed to decorate image. Please try again." },
      { status: 500 },
    );
  }
}
