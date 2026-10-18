"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n/provider";
import { localizeHref } from "../i18n/core";

type PackResultShareProps = {
  packId: string;
  title: string;
  score: number;
  completed: number;
  solved: number;
  /** Generate a private-to-public link only on explicit sharing. Never pass the run credential here. */
  createShareId: () => Promise<string>;
  revokeShare?: () => Promise<void>;
  existingShareId?: string | null;
};

type ImageAsset = { file: File; previewUrl: string };

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function fitLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text.trim().replace(/\s+/g, " "))) {
    if (current && ctx.measureText(current + char).width > maxWidth) {
      lines.push(current.trimEnd());
      current = char.trimStart();
      if (lines.length === maxLines) break;
    } else {
      current += char;
    }
  }
  if (lines.length < maxLines && current) lines.push(current.trimEnd());
  if (lines.length === maxLines) {
    const original = lines.join("") + current;
    if (original.length < text.trim().replace(/\s+/g, " ").length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(last + "…").width > maxWidth) last = Array.from(last).slice(0, -1).join("");
      lines[maxLines - 1] = last.trimEnd() + "…";
    }
  }
  return lines;
}

function paintResultCard(canvas: HTMLCanvasElement, data: Pick<PackResultShareProps, "packId"|"title"|"score"|"completed"|"solved">, url: string, korean: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#5247d7");
  bg.addColorStop(0.52, "#7363ec");
  bg.addColorStop(1, "#322682");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(1010, 90, 300, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.10;
  ctx.beginPath(); ctx.arc(10, 1170, 350, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 54px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText("quizdip", 84, 119);
  ctx.fillStyle = "#FFD36E";
  ctx.beginPath(); ctx.arc(287, 107, 11, 0, Math.PI * 2); ctx.fill();

  ctx.font = '700 27px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#dad5ff";
  ctx.fillText(korean ? "나의 퀴즈팩 기록" : "MY QUIZ PACK RESULT", 86, 228);

  ctx.font = '800 64px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#ffffff";
  const titleLines = fitLines(ctx, data.title, 905, 4);
  titleLines.forEach((line, i) => ctx.fillText(line, 84, 318 + i * 85));

  const panelY = 680;
  roundedRect(ctx, 66, panelY, 948, 385, 44);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#272341";
  ctx.font = '700 27px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(korean ? "나의 도전 결과" : "HOW I DID", 111, panelY + 67);

  ctx.fillStyle = "#6255E8";
  ctx.font = '900 110px system-ui, "Apple SD Gothic Neo", sans-serif';
  const scoreText = new Intl.NumberFormat(korean ? "ko-KR" : "en-US").format(data.score);
  ctx.fillText(scoreText, 111, panelY + 206);
  const scoreWidth = ctx.measureText(scoreText).width;
  ctx.fillStyle = "#696B82";
  ctx.font = '700 27px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(korean ? "점" : "PTS", 131 + scoreWidth, panelY + 203);

  ctx.fillStyle = "#e8e6f2";
  ctx.fillRect(110, panelY + 251, 860, 2);

  ctx.font = '800 43px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#252642";
  ctx.fillText(String(data.solved) + " / " + String(data.completed), 111, panelY + 317);
  ctx.fillText(String(data.completed), 585, panelY + 317);
  ctx.font = '600 23px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#696B82";
  ctx.fillText(korean ? "맞힌 문제" : "CORRECT", 111, panelY + 350);
  ctx.fillText(korean ? "완료한 문제" : "COMPLETED", 585, panelY + 350);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 32px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillText(korean ? "당신도 이 퀴즈팩에 도전해 보세요!" : "Think you can beat my result?", 86, 1155);
  ctx.font = '600 25px system-ui, "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = "#e7e3ff";
  const urlLines = fitLines(ctx, url, 898, 2);
  urlLines.forEach((line, i) => ctx.fillText(line, 86, 1211 + i * 36));
}

function renderPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG generation failed")), "image/png");
  });
}

/**
 * This is a presentation-only export of the server-returned finished run.
 * The shared link always points to the public pack, never to a private run token.
 */
export default function PackResultShare({ packId, title, score, completed, solved,
  createShareId, revokeShare, existingShareId }: PackResultShareProps) {
  const locale = useLocale();
  const korean = locale === "ko";
  const [packUrl, setPackUrl] = useState("");
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [notice, setNotice] = useState("");
  const [renderError, setRenderError] = useState("");
  const [shareId, setShareId] = useState(existingShareId || "");
  const creatingShareRef = useRef<Promise<string> | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    setPackUrl(new URL(localizeHref("/packs/" + packId, locale), window.location.origin).href);
  }, [packId, locale]);

  useEffect(() => {
    if (!packUrl) return;
    let active = true;
    let previewUrl: string | undefined;
    setAsset(null);
    setRenderError("");
    void (async () => {
      try {
        await document.fonts?.ready;
        if (!active) return;
        const canvas = document.createElement("canvas");
        paintResultCard(canvas, { packId, title, score, completed, solved }, packUrl, korean);
        const blob = await renderPng(canvas);
        if (!active) return;
        previewUrl = URL.createObjectURL(blob);
        setAsset({ file: new File([blob], "quizdip-pack-result.png", { type: "image/png" }), previewUrl });
      } catch {
        if (active) setRenderError(korean ? "결과 이미지를 만들지 못했어요. 링크는 공유할 수 있어요." : "Couldn't create the image. You can still share the link.");
      }
    })();
    return () => { active = false; if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [packId, title, score, completed, solved, packUrl, korean]);

  const resultUrl = shareId && packUrl
    ? new URL(localizeHref("/results/" + shareId, locale), new URL(packUrl).origin).href : "";

  async function publicResultUrl() {
    if (resultUrl) return resultUrl;
    if (!packUrl) throw new Error("Pack link is unavailable");
    if (!creatingShareRef.current) creatingShareRef.current = createShareId();
    try {
      const id = await creatingShareRef.current;
      setShareId(id);
      return new URL(localizeHref("/results/" + id, locale), new URL(packUrl).origin).href;
    } finally {
      creatingShareRef.current = null;
    }
  }

  function downloadImage() {
    if (!asset) return;
    const anchor = document.createElement("a");
    anchor.href = asset.previewUrl;
    anchor.download = asset.file.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setNotice(korean ? "이미지를 저장했어요. 링크도 함께 공유해 주세요." : "Image saved. Include the pack link when posting.");
  }

  /** A single link-based share action: let each receiving app render its own OG preview.
   * Do not attach the PNG: several apps (including Facebook) discard the URL for file shares.
   * A public result is created only after the user explicitly taps this button.
   */
  async function shareResult() {
    if (!packUrl || shareBusy) return;
    setNotice("");
    setShareBusy(true);
    try {
      const url = await publicResultUrl();
      if (navigator.share) {
        try {
          // On iOS, Facebook's share extension can silently discard a URL-only
          // Web Share attachment after briefly showing it in the composer.
          // Send the absolute public result link as ordinary text instead,
          // mirroring the manual paste flow that Facebook handles correctly.
          // Other platforms retain the native URL attachment.
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
          await navigator.share(isIOS ? { text: url } : { url });
          setNotice(korean
            ? "공유할 앱에서 링크와 미리보기를 확인해 주세요."
            : "Check the link and preview in the destination app.");
          return;
        } catch (error) {
          // A canceled native share must not trigger a surprise clipboard copy.
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setNotice(korean
          ? "결과 링크를 복사했어요. 원하는 앱에 붙여 넣으세요."
          : "Result link copied. Paste it into any app.");
      } catch {
        // Mobile Safari may expire user activation while generating a new share ID.
        // Still expose the exact public URL rather than silently losing the share.
        setNotice((korean ? "결과 링크를 길게 눌러 복사해 주세요: " : "Long-press to copy the result link: ") + url);
      }
    } catch {
      setNotice(korean ? "결과 공유 링크를 만들지 못했어요. 다시 시도해 주세요." : "Couldn't prepare the result link. Try again.");
    } finally {
      setShareBusy(false);
    }
  }

  async function unshare() {
    if(!revokeShare || !shareId)return;
    if(!window.confirm(korean ? "공개된 결과 링크를 비활성화할까요? 기존에 공유한 링크도 열리지 않아요." :
      "Disable this result link? Previously shared posts will no longer open it."))return;
    setShareBusy(true);
    try {
      await revokeShare();
      setShareId("");
      setNotice(korean ? "공개 링크를 비활성화했어요." : "Public result link disabled.");
    } catch {
      setNotice(korean ? "공유 취소에 실패했어요." : "Could not disable the share link.");
    } finally {setShareBusy(false);}
  }

  return <section className="pack-result-share" aria-label={korean ? "결과 이미지 공유" : "Share result image"}>
    <div className="pack-result-share-heading">
      <h3>{korean ? "내 기록을 공유해 보세요" : "Share your result"}</h3>
      <p>{korean ? "퀴즈팩 제목과 내 점수를 한 장의 카드로!" : "Your quiz pack and your results, in one image."}</p>
    </div>
    {asset ? <img className="pack-result-share-preview" src={asset.previewUrl}
      alt={korean ? `${title} · ${score}점 · ${completed}문제 중 ${solved}문제 정답` : `${title} · ${score} points · ${solved} out of ${completed} correct`} /> :
      <div className="pack-result-share-placeholder" role="status">{renderError || (korean ? "결과 카드 만드는 중…" : "Preparing your result card…")}</div>}
    <div className="pack-result-share-actions">
      <button type="button" className="btn btn-primary" onClick={() => void shareResult()} disabled={!packUrl||shareBusy}>
        {korean ? "결과 링크 공유하기 ↗" : "Share result link ↗"}
      </button>
      <button type="button" className="btn btn-outline" onClick={downloadImage} disabled={!asset}>
        {korean ? "이미지 저장" : "Save image"}
      </button>
    </div>
    {resultUrl && <div className="pack-result-share-manage">
      <a href={resultUrl} target="_blank" rel="noopener noreferrer">
        {korean ? "공개 결과 확인 ↗" : "View shared result ↗"}
      </a>
      {revokeShare && <button type="button" disabled={shareBusy} onClick={() => void unshare()}>
        {korean ? "공유 중지" : "Stop sharing"}
      </button>}
    </div>}
    <p className="pack-result-share-note">{korean
      ? "링크를 공유하면 누구나 내 점수와 결과를 볼 수 있어요. 이미지는 별도로 저장할 수 있어요."
      : "Anyone with your result link can view your score. Save the image separately if you wish."}</p>
    {notice && <p role="status" className="pack-result-share-notice">{notice}</p>}
  </section>;
}
