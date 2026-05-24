import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

const maxImageSizeBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const budgetRange = String(form.get("budgetRange") ?? "").trim();
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

    if (!budgetRange || !style || !roomType) {
      return NextResponse.json(
        { message: "Budget, style, and room type are required." },
        { status: 400 },
      );
    }

    const promptSummary = [
      `Decorate this ${roomType} wall in a ${style} style.`,
      `Budget range: ${budgetRange}.`,
      colorPalette ? `Preferred palette: ${colorPalette}.` : "",
      mustHaveItems ? `Must-have items: ${mustHaveItems}.` : "",
      notes ? `Extra notes: ${notes}.` : "",
      "Preserve room structure and perspective. Keep result realistic and cohesive.",
    ]
      .filter(Boolean)
      .join(" ");

    const bytes = Buffer.from(await image.arrayBuffer());
    const originalBase64 = bytes.toString("base64");
    const originalImage = `data:${image.type};base64,${originalBase64}`;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        originalImage,
        generatedImage: originalImage,
        promptSummary: `${promptSummary} (Preview mode: set OPENAI_API_KEY for AI generation.)`,
      });
    }

    const openai = getOpenAIClient();
    const file = new File([bytes], image.name || "wall-image.png", { type: image.type });
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt: promptSummary,
      size: "1536x1024",
    });

    const b64 = result.data?.[0]?.b64_json;
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
    return NextResponse.json(
      { message: "Failed to decorate image. Please try again." },
      { status: 500 },
    );
  }
}
