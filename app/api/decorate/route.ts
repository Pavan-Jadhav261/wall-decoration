import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

const maxImageSizeBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const minWallConfidence = 0.55;
const minWallCoverage = 0.35;
const validatorModel = process.env.OPENAI_WALL_VALIDATOR_MODEL || "gpt-4.1-mini";
const generationModel = process.env.OPENAI_IMAGE_ORCHESTRATOR_MODEL || "gpt-5.5";
const fallbackGenerationModel =
  process.env.OPENAI_IMAGE_ORCHESTRATOR_FALLBACK_MODEL || "gpt-4.1";

type WallValidationResult = {
  is_wall_photo: boolean;
  confidence: number;
  reason: string;
  wall_coverage_ratio?: number;
  has_editable_wall_surface?: boolean;
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

function getApiErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    if ("error" in error) {
      const apiError = (error as { error?: { message?: unknown } }).error;
      if (apiError && typeof apiError.message === "string") {
        return apiError.message;
      }
    }
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  return "Unknown OpenAI error.";
}

function isRetryableGenerationModelError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  const message = getApiErrorMessage(error).toLowerCase();
  if (status === 400 || status === 404) {
    return (
      message.includes("does not support") ||
      message.includes("unsupported") ||
      message.includes("tool") ||
      message.includes("image_generation")
    );
  }
  return false;
}

async function generateDecoratedImage(params: {
  openai: ReturnType<typeof getOpenAIClient>;
  promptSummary: string;
  fileId: string;
}) {
  const modelsToTry = [generationModel, fallbackGenerationModel].filter(
    (value, index, list) => value && list.indexOf(value) === index,
  );

  let lastError: unknown = null;
  for (const model of modelsToTry) {
    try {
      return await params.openai.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: params.promptSummary,
              },
              {
                type: "input_image",
                file_id: params.fileId,
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
    } catch (error) {
      lastError = error;
      if (!isRetryableGenerationModelError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("No compatible generation model succeeded.");
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
              "Return only JSON with keys: is_wall_photo (boolean), has_editable_wall_surface (boolean), wall_coverage_ratio (0 to 1), confidence (0 to 1), reason (string). " +
              "A valid image can be indoor or outdoor. Mark true when a wall-like surface is clearly visible and takes a meaningful portion of the frame for decoration editing. " +
              "Do not reject only because people, trees, benches, columns, or street elements are in side areas if the wall is still dominant and editable. " +
              "Mark false for selfies, portraits without visible wall area, documents, products close-up, food, animals, or scenes where wall area is too small/unclear.",
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
    const wallCoverageRatio =
      typeof parsed.wall_coverage_ratio === "number" &&
      Number.isFinite(parsed.wall_coverage_ratio)
        ? Math.max(0, Math.min(1, parsed.wall_coverage_ratio))
        : 0;

    const hasEditableWallSurface = Boolean(parsed.has_editable_wall_surface);

    const verdict: WallValidationResult = {
      is_wall_photo: Boolean(parsed.is_wall_photo),
      has_editable_wall_surface: hasEditableWallSurface,
      wall_coverage_ratio: wallCoverageRatio,
      confidence:
        typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : 0,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim()
          : "Image is not suitable for wall decoration.",
    };
    const ok =
      verdict.is_wall_photo &&
      (verdict.has_editable_wall_surface || wallCoverageRatio >= minWallCoverage) &&
      verdict.confidence >= minWallConfidence;
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
      model: validatorModel,
      fileId: uploadedFile.id,
      openai,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          message: "Please upload a photo where a wall surface is clearly visible and editable.",
          reason: validation.verdict.reason,
          confidence: validation.verdict.confidence,
          wallCoverageRatio: validation.verdict.wall_coverage_ratio ?? 0,
        },
        { status: 422 },
      );
    }

    const result = await generateDecoratedImage({
      openai,
      promptSummary,
      fileId: uploadedFile.id,
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
      if (typeof status === "number" && status >= 400 && status < 500) {
        return NextResponse.json(
          { message: `OpenAI request failed: ${getApiErrorMessage(error)}` },
          { status: 502 },
        );
      }
    }
    return NextResponse.json(
      { message: `Failed to decorate image. ${getApiErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
