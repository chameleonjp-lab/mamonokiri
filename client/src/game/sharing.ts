export async function shareOrCopy(
  text: string,
  url: string,
  setStatus: (message: string) => void,
  isCurrent: () => boolean = () => true
): Promise<void> {
  if (!isCurrent()) return;
  setStatus("");
  if (navigator.share) {
    try {
      await navigator.share({ title: "墨霞の剣", text, url });
      if (isCurrent()) setStatus("共有先へ渡しました。");
      return;
    } catch (error: unknown) {
      if (!isCurrent()) return;
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("共有を取り消しました。");
        return;
      }
    }
  }
  if (!isCurrent()) return;
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    if (isCurrent()) setStatus("シェア文をコピーしました。");
  } catch {
    if (isCurrent())
      setStatus("シェア文をコピーできませんでした。長押しで選択してください。");
  }
}
